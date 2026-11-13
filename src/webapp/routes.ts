/** Matches an email, raw or percent-encoded, inside free text. */
const EMAIL_PATTERN = /[^\s/@%]+(?:@|%40)[^\s/@%]+\.[^\s/@%]+/gi;

/**
 * Masks every email found in a string, array or object, recursively. Past the
 * depth limit, objects are serialized to JSON and masked as a string so deeply
 * nested untrusted data cannot bypass the masking; a value that cannot be
 * serialized, such as a circular or BigInt-holding one, becomes
 * `'[unserializable]'`.
 * @param value Log field.
 * @param depth Remaining nesting depth.
 */
function redactEmails(value: unknown, depth = 4): unknown {
  if (typeof value === 'string') {
    return value.replace(EMAIL_PATTERN, (match) =>
      StringUtils.maskEmail(match.replace(/%40/i, '@')),
    );
  }
  if (value === null || typeof value !== 'object') return value;
  if (depth === 0) {
    try {
      return redactEmails(JSON.stringify(value));
    } catch {
      return '[unserializable]';
    }
  }
  if (Array.isArray(value)) return value.map((v) => redactEmails(v, depth - 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, redactEmails(v, depth - 1)]),
  );
}

/**
 * Creates a module logger that masks emails in the message and every log field
 * before they are logged, such as the respondent email in a lookup path.
 * @param module Module name of the logger.
 */
function createRedactedLogger(module = 'webapp'): GasLogger {
  const logger = createModuleLogger(module);
  const redacted =
    (level: 'debug' | 'info' | 'warn' | 'error') =>
    (message: string, meta?: GasLoggerMeta) =>
      logger[level](
        redactEmails(message) as string,
        meta === undefined ? undefined : (redactEmails(meta) as GasLoggerMeta),
      );
  return {
    debug: redacted('debug'),
    info: redacted('info'),
    warn: redacted('warn'),
    error: redacted('error'),
  } as unknown as GasLogger;
}

/** Client error reports allowed across all visitors in each window. */
const CLIENT_ERROR_LIMIT = 30;

/** Rate limit window of the client error route, in seconds. */
const CLIENT_ERROR_WINDOW_SECONDS = 60;

/** Requests allowed per email in each OTP rate limit window. */
const OTP_EMAIL_LIMIT = 3;

/** Rate limit window of the auth routes, in seconds. */
const OTP_WINDOW_SECONDS = 900;

/** OTP requests allowed across all emails in each window. */
const OTP_GLOBAL_LIMIT = 50;

/** Verification attempts allowed per email in each window. */
const VERIFY_EMAIL_LIMIT = 10;

/** Verification attempts allowed across all emails in each window. */
const VERIFY_GLOBAL_LIMIT = 200;

/** Verification attempts allowed per email in each daily window. */
const VERIFY_EMAIL_DAILY_LIMIT = 20;

/** Daily rate limit window, in seconds. */
const VERIFY_DAILY_WINDOW_SECONDS = 86400;

/** Request log keys that are always masked, on top of the library defaults. */
const LOG_REDACT_KEYS = [
  'token',
  'password',
  'secret',
  'key',
  'auth',
  'authorization',
  'code',
];

/**
 * Reads the request email, rejecting a malformed one.
 * @param req Request.
 */
function requireBodyEmail(req: GasWebAppRequest): string {
  const email = bodyEmail(req);
  if (!isValidEmail(email)) {
    throw new GasValidationError(tr('auth.invalidEmail'));
  }
  return email;
}

/**
 * Creates the unauthenticated auth router.
 * @param auth Auth services.
 */
function createAuthRouter(auth: AuthServices): GasWebAppRouter {
  const router = new GasWebAppRouter();
  const validateEmail: GasWebAppHandler = (req, _res, next) => {
    requireBodyEmail(req);
    next();
  };
  // The counters are shared across visitors. Under USER_DEPLOYING the user
  // lock is global too, and it does not contend with the synchronizer's
  // script lock.
  const limiter = (
    key: (req: GasWebAppRequest) => string,
    limit: number,
    windowSeconds = OTP_WINDOW_SECONDS,
  ) =>
    createRateLimiter({
      limit,
      windowSeconds,
      lockScope: 'user',
      lockService: GasLock,
      keyFn: key,
    });
  const emailKey = (prefix: string) => (req: GasWebAppRequest) =>
    `${prefix}:${auth.hmac(`limit:${bodyEmail(req)}`)}`;
  const globalLimit = limiter(() => 'otp:global', OTP_GLOBAL_LIMIT);
  const emailLimit = limiter(emailKey('otp'), OTP_EMAIL_LIMIT);
  const verifyGlobalLimit = limiter(() => 'verify:global', VERIFY_GLOBAL_LIMIT);
  const verifyEmailLimit = limiter(emailKey('verify'), VERIFY_EMAIL_LIMIT);
  // Runs after the window limiters so rejected attempts do not use the budget.
  const verifyEmailDailyLimit = limiter(
    emailKey('verify:daily'),
    VERIFY_EMAIL_DAILY_LIMIT,
    VERIFY_DAILY_WINDOW_SECONDS,
  );

  router.post('/otp', validateEmail, globalLimit, emailLimit, (req, res) => {
    auth.otp.request(requireBodyEmail(req));
    res.json({
      message: tr('auth.otpRequested', { minutes: OTP_TTL_SECONDS / 60 }),
    });
  });

  router.post(
    '/verify',
    validateEmail,
    verifyGlobalLimit,
    verifyEmailLimit,
    verifyEmailDailyLimit,
    (req, res) => {
      const email = requireBodyEmail(req);
      const code = (req.body as { code?: unknown }).code;
      if (
        typeof code !== 'string' ||
        !/^\d{6}$/.test(code) ||
        !auth.otp.verify(email, code)
      ) {
        throw new GasUnauthorizedError(tr('auth.invalidCode'));
      }
      res.json({ token: auth.sessions.create(email) });
    },
  );

  return router;
}

/**
 * Creates the API router.
 * @param service Scores service.
 * @param auth Auth services.
 */
function createApiRouter(
  service: ScoresService,
  auth: AuthServices,
): GasWebAppRouter {
  const api = new GasWebAppRouter();
  const requireSession = createSessionAuth(auth.sessions, getLocale);

  api.get('/meta', (_req, res) => {
    const config = getConfig();
    res.json({
      locale: getLocale(),
      portalTitle: config.get('portalTitle') ?? 'Score Portal',
      brand: {
        primaryColor: config.get('primaryColor') ?? null,
        logoUrl: config.get('logoUrl') ?? null,
        faviconUrl: config.get('faviconUrl') ?? null,
      },
    });
  });

  api.get('/me/scores', requireSession, (req, res) => {
    const scores = service.getByUser(req.user?.email ?? '');
    if (!scores) throw new GasNotFoundError(tr('error.respondentNotFound'));

    res.json(scores);
  });

  // The bucket is global because the visitor is anonymous and has no
  // identifiable key.
  api.post(
    '/client-errors',
    createRateLimiter({
      limit: CLIENT_ERROR_LIMIT,
      windowSeconds: CLIENT_ERROR_WINDOW_SECONDS,
      lockScope: 'user',
      lockService: GasLock,
      keyFn: () => 'client-errors:global',
    }),
    createClientErrorHandler(createRedactedLogger('client')),
  );

  api.use('/auth', createAuthRouter(auth));

  return api;
}

/**
 * Creates the web app with its middleware and routes.
 * @param service Scores service.
 * @param auth Auth services.
 */
function createWebApp(service: ScoresService, auth: AuthServices): GasWebApp {
  const webApp = new GasWebApp({ logger: createRedactedLogger() });
  const ack = createAckTracker();
  webApp.use(ack.middleware);
  webApp.get('/ack', ack.handler);
  webApp.use(
    createLoggingMiddleware(createRedactedLogger(), {
      redact: LOG_REDACT_KEYS,
    }),
  );
  webApp.use('/api', createApiRouter(service, auth));
  return webApp;
}
