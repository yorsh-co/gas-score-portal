const App = (() => {
  const init = () => {
    Router.use(LoggerMiddleware.logRequest);

    Routes.registerAll(Router);

    Router.use((req, _res, next) => {
      next(HttpError.notFound(`Route not found: ${req.route}`));
    });

    Router.use(ErrorHandler.handleError);
  };

  const handle = (e, method) => Router.handle(e, method);

  return {
    init,
    handle,
  };
})();
