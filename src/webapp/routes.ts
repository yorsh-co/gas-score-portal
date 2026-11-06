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
  createModuleLogger('webapp').info(`${req.method} ${req.originalPath}`);
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
  const webApp = new GasWebApp({ logger: createModuleLogger('webapp') });
  webApp.use(logRequest);
  webApp.use('/api', createApiRouter(service));
  return webApp;
}
