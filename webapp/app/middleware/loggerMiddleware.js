const LoggerMiddleware = (() => {
  const log = (req, _res, next) => {
    console.log(`[${req.method}] ${req.route}`);
    return next();
  };

  return { log };
})();