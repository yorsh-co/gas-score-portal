const Router = (() => {
  const routes = {};
  const preMiddleware = [];
  const postMiddleware = [];

  const register = (method, path, ...handlers) => {
    if (!routes[path]) routes[path] = {};
    routes[path][method] = handlers;
  };

  const get = (path, ...handlers) => register('GET', path, ...handlers);
  const post = (path, ...handlers) => register('POST', path, ...handlers);
  const use = (mw) => {
    if (mw.length === 4)
      postMiddleware.push(mw); // Error middleware
    else preMiddleware.push(mw);
  };

  const runChain = (handlers, req, res) => {
    let i = 0;

    const next = (err) => {
      const handler = handlers[i++];
      if (!handler) return;

      // Error case → only call error middleware
      if (err) {
        if (handler.length === 4) {
          return handler(err, req, res, next);
        }
        return next(err);
      }

      // Normal case → skip error middleware
      if (handler.length === 4) {
        return next();
      }

      try {
        return handler(req, res, next);
      } catch (e) {
        return next(e);
      }
    };

    return next();
  };

  const handle = (e, method) => {
    const route = (e.parameter.route || '/').replace(/\/$/, '') || '/';

    const handlers = routes?.[route]?.[method];

    const req = Request.create(e, method);
    req.route = route;

    const res = Response.create();

    if (!handlers) {
      const notFoundMiddleware = (route) => (_req, _res, next) =>
        next(HttpError.notFound(`Route not found: ${route}`));
      return runChain(
        [...preMiddleware, notFoundMiddleware(route), ...postMiddleware],
        req,
        res,
      );
    }

    runChain([...preMiddleware, ...handlers, ...postMiddleware], req, res);

    return res._get();
  };

  return { get, post, use, handle };
})();
