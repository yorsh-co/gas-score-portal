/** Seconds a session token stays valid. */
const SESSION_TTL_SECONDS = 1800;

/** What the session service needs from the platform. */
interface SessionServiceDeps {
  cache: GoogleAppsScript.Cache.Cache;
  /** HMAC-SHA256 of a value with the secret key, as hex. */
  hmac(value: string): string;
  /** Random UUID source. */
  uuid(): string;
}

/** Issues and resolves session tokens. */
interface SessionService {
  /** Creates a session for the email and returns its token. */
  create(email: string): string;
  /** Returns the email of a live session, or `null`. */
  resolve(token: string): string | null;
}

/**
 * Creates the session service. Sessions are stored under the HMAC of the
 * token, so the cache never holds a usable token.
 * @param deps Platform dependencies.
 */
function createSessionService_(deps: SessionServiceDeps): SessionService {
  const cacheKey = (token: string) => `session:${deps.hmac(`token:${token}`)}`;

  return {
    create(email) {
      const token = deps.uuid();
      deps.cache.put(cacheKey(token), email, SESSION_TTL_SECONDS);
      return token;
    },
    resolve(token) {
      if (!token) return null;
      return deps.cache.get(cacheKey(token));
    },
  };
}
