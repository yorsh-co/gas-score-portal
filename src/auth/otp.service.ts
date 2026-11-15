/** Seconds an OTP stays valid. */
const OTP_TTL_SECONDS = 600;

/** Wrong guesses allowed before an OTP is invalidated. */
const OTP_MAX_ATTEMPTS = 5;

/** Script Property that stores the HMAC key. */
const OTP_HMAC_KEY_PROPERTY = 'otp.hmacKey';

/** Largest multiple of 10^6 that fits in 24 bits, used to avoid modulo bias. */
const OTP_SAMPLE_LIMIT = 16000000;

/** Minimum duration of an OTP request, so the response time hides whether a mail was sent. */
const OTP_MIN_RESPONSE_MS = 2500;

/** Minimum duration of a verification, so the response time hides whether a code was live. */
const VERIFY_MIN_RESPONSE_MS = 2500;

/** An OTP as stored in the cache. Only the HMAC of the code is kept. */
interface OtpEntry {
  codeHmac: string;
  attempts: number;
  expiresAt: number;
}

/** What the OTP service needs from the platform and the app. */
interface OtpServiceDeps {
  cache: GoogleAppsScript.Cache.Cache;
  /** HMAC-SHA256 of a value with the secret key, as hex. */
  hmac(value: string): string;
  /** Random UUID source. */
  uuid(): string;
  now(): number;
  /** Blocks for the given milliseconds. */
  sleep(ms: number): void;
  isRespondent(email: string): boolean;
  mailer: OtpMailer;
  getLocale(): string;
  logger: Pick<GasLogger, 'error'>;
}

/** Issues and verifies one-time codes. */
interface OtpService {
  /**
   * Mails a code when the email belongs to a respondent. Returns without a
   * difference in outcome for unknown emails.
   */
  request(email: string): void;
  /** Whether the code is valid for the email; a valid code is consumed. */
  verify(email: string, code: string): boolean;
}

/**
 * Whether a value looks like an email. Deliberately loose: the respondent
 * lookup is the real check.
 * @param email Normalized email.
 */
function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Converts the signed bytes returned by `Utilities` into a hex string.
 * @param bytes Signed byte array.
 */
function bytesToHex(bytes: readonly number[]): string {
  return bytes
    .map((byte) => ((byte + 256) % 256).toString(16).padStart(2, '0'))
    .join('');
}

/** HMAC key memoized for the current execution. */
let otpHmacKey: string | undefined;

/**
 * Returns the HMAC key, creating it on first use. The key is 32 random bytes
 * taken from two UUIDs and is stored once, under the script lock. It is read
 * from Script Properties once per execution. The trailing underscore keeps it
 * out of `google.script.run`.
 */
function getOtpHmacKey_(): string {
  if (otpHmacKey) return otpHmacKey;
  const properties = PropertiesService.getScriptProperties();
  const existing = properties.getProperty(OTP_HMAC_KEY_PROPERTY);
  if (existing) return (otpHmacKey = existing);
  otpHmacKey = GasLock.withLock('script', () => {
    const stored = properties.getProperty(OTP_HMAC_KEY_PROPERTY);
    if (stored) return stored;
    const key = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    properties.setProperty(OTP_HMAC_KEY_PROPERTY, key);
    return key;
  });
  return otpHmacKey;
}

/**
 * Computes HMAC-SHA256 as hex with the stored key.
 * The trailing underscore keeps it out of `google.script.run`.
 * @param value Value to sign.
 */
function computeOtpHmac_(value: string): string {
  return bytesToHex(
    Utilities.computeHmacSha256Signature(value, getOtpHmacKey_()),
  );
}

/**
 * Compares two strings without returning early at the first difference.
 * @param a First string.
 * @param b Second string.
 */
function constantTimeEquals(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * Generates a uniformly distributed 6-digit code from UUID entropy. UUID v4
 * fixes the version and variant digits, so only the fully random ones are used.
 * @param uuid Random UUID source.
 */
function generateOtpCode(uuid: () => string): string {
  for (;;) {
    const hex = uuid().replace(/-/g, '');
    const random = hex.slice(0, 12) + hex.slice(20, 32);
    for (let i = 0; i + 6 <= random.length; i += 6) {
      const sample = parseInt(random.slice(i, i + 6), 16);
      if (sample < OTP_SAMPLE_LIMIT) {
        return String(sample % 1000000).padStart(6, '0');
      }
    }
  }
}

/**
 * Creates the OTP service.
 * @param deps Platform and app dependencies.
 */
function createOtpService(deps: OtpServiceDeps): OtpService {
  const cacheKey = (email: string) => `otp:${deps.hmac(`email:${email}`)}`;

  /**
   * Puts back the entry a failed send replaced, with its remaining TTL, so
   * the failed attempts are not lost. Removes the key when there was none.
   */
  const restoreEntry = (
    key: string,
    raw: string | null,
    previous: OtpEntry | null,
  ) => {
    GasLock.withLock('user', () => {
      const remaining = previous
        ? Math.ceil((previous.expiresAt - deps.now()) / 1000)
        : 0;
      if (raw && remaining > 0) deps.cache.put(key, raw, remaining);
      else deps.cache.remove(key);
    });
  };

  /** Sleeps whatever is left of the floor, measured from `startedAt`. */
  const padTo = (startedAt: number, minMs: number) => {
    const remaining = minMs - (deps.now() - startedAt);
    if (remaining > 0) deps.sleep(remaining);
  };

  const issue = (rawEmail: string) => {
    const email = normalizeEmail(rawEmail);
    const key = cacheKey(email);

    // Checked before the respondent lookup so an exhausted quota looks the
    // same for every email.
    if (!deps.mailer.hasQuota()) {
      deps.logger.error('Mail quota exhausted; OTP not sent');
      throw new GasError(t(deps.getLocale(), 'auth.tryLater'), {
        statusCode: 503,
      });
    }
    if (!deps.isRespondent(email)) return;

    const code = generateOtpCode(deps.uuid);
    const { previousRaw, previous } = GasLock.withLock('user', () => {
      // A new code voids the live one but keeps its failed attempts.
      const raw = deps.cache.get(key);
      const prior = raw ? (JSON.parse(raw) as OtpEntry) : null;
      const entry: OtpEntry = {
        codeHmac: deps.hmac(code),
        attempts: prior?.attempts ?? 0,
        expiresAt: deps.now() + OTP_TTL_SECONDS * 1000,
      };
      deps.cache.put(key, JSON.stringify(entry), OTP_TTL_SECONDS);
      return { previousRaw: raw, previous: prior };
    });
    try {
      deps.mailer.sendOtp(email, code, OTP_TTL_SECONDS / 60);
    } catch (err) {
      restoreEntry(key, previousRaw, previous);
      deps.logger.error('OTP email failed', {
        email: StringUtils.maskEmail(email),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const check = (rawEmail: string, code: string): boolean => {
    const email = normalizeEmail(rawEmail);
    const key = cacheKey(email);
    return GasLock.withLock('user', () => {
      const raw = deps.cache.get(key);
      if (!raw) return false;
      const entry = JSON.parse(raw) as OtpEntry;
      const remaining = Math.ceil((entry.expiresAt - deps.now()) / 1000);
      if (remaining <= 0 || entry.attempts >= OTP_MAX_ATTEMPTS) {
        deps.cache.remove(key);
        return false;
      }

      if (constantTimeEquals(deps.hmac(code), entry.codeHmac)) {
        deps.cache.remove(key);
        return true;
      }

      entry.attempts += 1;
      if (entry.attempts >= OTP_MAX_ATTEMPTS) {
        deps.cache.remove(key);
      } else {
        deps.cache.put(key, JSON.stringify(entry), remaining);
      }
      return false;
    });
  };

  return {
    request(rawEmail) {
      const startedAt = deps.now();
      try {
        issue(rawEmail);
      } finally {
        padTo(startedAt, OTP_MIN_RESPONSE_MS);
      }
    },

    verify(rawEmail, code) {
      const startedAt = deps.now();
      try {
        return check(rawEmail, code);
      } finally {
        padTo(startedAt, VERIFY_MIN_RESPONSE_MS);
      }
    },
  };
}
