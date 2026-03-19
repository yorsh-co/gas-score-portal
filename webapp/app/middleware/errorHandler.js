const ErrorHandler = (() => {
  const isApiRoute = (route) => route.startsWith('/api');

  const handleError  = (err, req, res, _next) => {
    console.error(err);

    const route = req.route;

    if (err instanceof HttpError.HttpError) {
      if (isApiRoute(route)) {
        return res.status(err.code).json({
          error: {
            type: err.type,
            message: err.message,
            details: err.details,
          },
        });
      }

      return res.status(err.code).html('webapp/client/pages/index', {
        view:
          err.code === 404
            ? 'webapp/client/views/404'
            : 'webapp/client/views/500',
        pageTitle: err.code === 404 ? 'Not Found' : 'Error',
        message: err.message,
      });
    }

    if (isApiRoute(route)) {
      return res.status(500).json({
        error: {
          type: 'INTERNAL_ERROR',
          message: 'Unexpected server error',
        },
      });
    }

    return res.status(500).html('webapp/client/pages/index', {
      view: 'webapp/client/views/500',
      pageTitle: 'Error',
    });
  };

  return { handleError };
})();
