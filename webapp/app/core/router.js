const Router = (() => {
  const stack = [];

  const use = (handler) =>
    stack.push({
      method: null,
      path: null,
      handler,
    });

  const register = (method, path, ...handlers) =>
    handlers.forEach((handler) => {
      stack.push({
        method,
        path,
        handler,
      });
    });

  const get = (path, ...handlers) => register('GET', path, ...handlers);
  const post = (path, ...handlers) => register('POST', path, ...handlers);

  const match = (layer, req) => {
    if (layer.method && layer.method !== req.method) return false;
    if (!layer.path) return true;

    const routeParts = req.route.split('/');
    const layerParts = layer.path.split('/');

    if (routeParts.length !== layerParts.length) return false;

    const params = {};

    for (let i = 0; i < layerParts.length; i++) {
      const lp = layerParts[i];
      const rp = routeParts[i];

      if (lp.startsWith(':')) {
        params[lp.slice(1)] = rp;
      } else if (lp !== rp) {
        return false;
      }
    }

    req.params = params;
    return true;
  };

  const run = (req, res) => {
    let i = 0;

    console.log(
      stack.map((l) => ({
        method: l.method,
        path: l.path,
        name: l.handler.name || 'anonymous',
      })),
    );

    const next = (err) => {
      const layer = stack[i++];
      if (!layer) return;

      if (!match(layer, req)) return next(err);

      const { handler } = layer;

      if (err)
        return handler.length === 4 ? handler(err, req, res, next) : next(err);

      if (handler.length === 4) return next();

      try {
        console.log('Running:', handler.name || 'anonymous');
        return handler(req, res, next);
      } catch (e) {
        return next(e);
      }
    };

    next();
  };

  const handle = (e, method) => {
    const route = (e.parameter.route || '/').replace(/\/$/, '') || '/';

    const req = Request.create(e, method);
    req.route = route;

    const res = Response.create();

    run(req, res);

    return res._get();
  };

  return { get, post, use, handle };
})();
