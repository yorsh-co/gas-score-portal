/**
 * Creates the middleware that requires a live session token in the `token`
 * query parameter and sets `req.user` to the session's email.
 * @param sessions Session service.
 * @param getLocale Locale of the error message.
 */
function createSessionAuth_(
  sessions: SessionService,
  getLocale: () => string,
): GasWebAppHandler {
  return (req, _res, next) => {
    const email = sessions.resolve(req.query.token ?? '');
    if (!email) {
      throw new GasUnauthorizedError(t(getLocale(), 'auth.sessionInvalid'));
    }
    req.user = { email };
    next();
  };
}

/** The auth services the web app routes use. */
interface AuthServices {
  otp: OtpService;
  sessions: SessionService;
  /** HMAC-SHA256 as hex, used to key rate limit counters. */
  hmac(value: string): string;
}

/**
 * Creates the auth services from the app's real dependencies.
 * @param respondents Resolves the respondents repository.
 * @param logger Logger of the web app.
 */
function createAuthServices_(
  respondents: () => RespondentsRepo,
  logger: Pick<GasLogger, 'error'>,
): AuthServices {
  const cache = CacheService.getScriptCache();
  const hmac = computeOtpHmac_;
  const uuid = () => Utilities.getUuid();
  return {
    otp: createOtpService_({
      cache,
      hmac,
      uuid,
      now: () => Date.now(),
      sleep: (ms) => Utilities.sleep(ms),
      isRespondent: (email) => respondents().findByEmail(email) !== null,
      mailer: createOtpMailer_(
        () => getConfig_().get('portalTitle') ?? 'Score Portal',
        getLocale_,
      ),
      getLocale: getLocale_,
      logger,
    }),
    sessions: createSessionService_({ cache, hmac, uuid }),
    hmac,
  };
}

/**
 * Reads the normalized email from a request body, or an empty string.
 * @param req Request.
 */
function bodyEmail_(req: GasWebAppRequest): string {
  const body = req.body as { email?: unknown } | null | undefined;
  return typeof body?.email === 'string' ? normalizeEmail_(body.email) : '';
}
