/** Matches an email, raw or percent-encoded, inside free text. */
const EMAIL_PATTERN = /[^\s/@%]+(?:@|%40)[^\s/@%]+\.[^\s/@%]+/gi;

/**
 * Masks every email found in a string, array or object, recursively.
 * @param value Log field.
 * @param depth Remaining nesting depth.
 */
function redactEmails(value: unknown, depth = 4): unknown {
  if (typeof value === 'string') {
    return value.replace(EMAIL_PATTERN, (match) =>
      StringUtils.maskEmail(match.replace(/%40/i, '@')),
    );
  }
  if (depth === 0 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redactEmails(v, depth - 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, redactEmails(v, depth - 1)]),
  );
}

/**
 * Creates the logger handed to gas-webapp, which logs request paths. The
 * respondent email is part of the lookup path, so it is masked first.
 */
function createWebAppLogger(): GasLogger {
  const logger = createModuleLogger('webapp');
  const redacted =
    (level: 'debug' | 'info' | 'warn' | 'error') =>
    (message: string, meta?: GasLoggerMeta) =>
      logger[level](
        message,
        meta === undefined ? undefined : (redactEmails(meta) as GasLoggerMeta),
      );
  return {
    debug: redacted('debug'),
    info: redacted('info'),
    warn: redacted('warn'),
    error: redacted('error'),
  } as unknown as GasLogger;
}

/**
 * Logs each request.
 * @param req Request.
 * @param _res Response.
 * @param next Continues the stack.
 */
function logRequest(
  req: GasWebAppRequest,
  _res: GasWebAppResponse,
  next: GasWebAppNext,
): void {
  createModuleLogger('webapp').info(
    `${req.method} ${redactEmails(req.originalPath) as string}`,
  );
  next();
}

/**
 * Creates the API router.
 * @param service Scores service.
 */
function createApiRouter(service: ScoresService): GasWebAppRouter {
  const api = new GasWebAppRouter();

  api.get('/users/:userId/scores', (req, res) => {
    const userId = req.params.userId;
    if (!userId) throw new GasValidationError('Empty user ID');

    const scores = service.getByUser(userId);
    if (!scores) throw new GasNotFoundError('Respondent not found');

    res.json(scores);
  });

  return api;
}

/**
 * Creates the web app with its middleware and routes.
 * @param service Scores service.
 */
function createWebApp(service: ScoresService): GasWebApp {
  const webApp = new GasWebApp({ logger: createWebAppLogger() });
  const ack = createAckTracker();
  webApp.use(ack.middleware);
  webApp.get('/ack', ack.handler);
  webApp.use(logRequest);
  webApp.use('/api', createApiRouter(service));
  return webApp;
}
