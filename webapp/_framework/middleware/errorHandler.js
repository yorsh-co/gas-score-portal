const ErrorHandler = (() => {
  const isApiRoute = (route) => route.startsWith('/api');

  const handleError = (err, req, res, _next) => {
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

      res.locals.pageTitle = err.code === 404 ? 'Not Found' : 'Error';
      res.locals.message = err.message;

      return res.status(err.code).render(err.code === 404 ? '404' : '500');
    }

    if (isApiRoute(route)) {
      return res.status(500).json({
        error: {
          type: 'INTERNAL_ERROR',
          message: 'Unexpected server error',
        },
      });
    }

    res.locals.pageTitle = 'Error';
    return res.status(500).render('500');
  };

  return { handleError };
})();
