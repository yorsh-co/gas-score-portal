const Router = (() => {
  const normalizeMethod_ = (e, httpMethod) => {
    if (httpMethod === 'GET') return 'GET';
    const override = e.parameter.method;
    return override ? override.toUpperCase() : 'POST';
  };

  const normalizeRoute_ = (route) => {
    if (!route) return '/';
    if (!route.startsWith('/')) {
      route = '/' + route;
    }
    if (route.length > 1 && route.endsWith('/')) {
      route = route.slice(0, -1);
    }
    return route;
  };

  const parseBody_ = (e) => {
    if (!e.postData) return {};
    try {
      return JSON.parse(e.postData.contents);
    } catch {
      return {};
    }
  };

  const isApiRoute_ = (route) => route.startsWith('/api');

  /**
   *
   * @param {GoogleAppsScript.Events.DoGet|GoogleAppsScript.Events.DoPost} e
   * @param {string} httpMethod
   * @returns {JSON|HTMLDocument}
   */
  const handle = (e, httpMethod) => {
    const rawRoute = e.parameter.route || '/';
    const route = normalizeRoute_(rawRoute);
    const method = normalizeMethod_(e, httpMethod);
    const routeHandlers = Routes[route];

    const isApiRequest = isApiRoute_(route);

    if (!routeHandlers) {
      if (isApiRequest) {
        throw HttpError.notFound(`Route not found: ${route}`);
      }
      return ViewsController.notFound({ route });
    }

    const handler = routeHandlers[method];
    if (!handler) {
      if (isApiRequest) {
        throw HttpError.methodNotAllowed(
          `Method ${method} not allowed for ${route}`,
        );
      }
      return ViewsController.notFound({ route });
    }

    const request = {
      route,
      method,
      params: e.parameter,
      body: parseBody_(e),
      event: e,
    };

    try {
      return handler(request);
    } catch (err) {
      console.error(err);

      if (err instanceof HttpError.HttpError) {
        if (isApiRequest) {
          return JsonResponse.error(
            err.code,
            err.type,
            err.message,
            err.details,
          );
        }

        return ViewsController.error({
          message: err.message,
          code: err.code,
        });
      }

      // Unexpected error
      if (isApiRequest) {
        return JsonResponse.error(
          JsonResponse.Errors.INTERNAL_ERROR.code,
          JsonResponse.Errors.INTERNAL_ERROR.type,
          'Unexpected server error',
        );
      }

      return ViewsController.error({
        message: 'Unexpected server error',
      });
    }
  };

  return {
    handle,
  };
})();
