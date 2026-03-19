const App = (() => {
  const init = () => {
    Router.use(LoggerMiddleware.log);
    
    Routes.registerAll(Router);

    Router.use(ErrorHandler.middleware);
  };

  const handle = (e, method) => {
    return Router.handle(e, method);
  };

  return {
    init,
    handle,
  };
})();
