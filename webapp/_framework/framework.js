const Framework = (() => {
  const createApp = ({ routes, middleware = [], config }) => {
    if (config) HtmlResponse.setConfig(config);

    const router = Router.create();

    const init = () => {
      (middleware || []).forEach((mw) => router.use(mw));

      if (typeof routes === 'function') routes(router);

      router.use((req, _res, next) => {
        next(HttpError.notFound(`Route not found: ${req.route}`));
      });

      router.use(ErrorHandler.handleError);
    };

    init();

    const handle = (e, method) => router.handle(e, method);

    return { init, handle };
  };

  return { createApp };
})();
