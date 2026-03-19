const ViewsController = (() => {
  const home = (req) => {
    return HtmlResponse.page('webapp/client/pages/index', {
      view: 'webapp/client/views/user-scores',
      pageTitle: 'Home',
    });
  };

  const scores = (req) => {
    const userId = req.params.userId || null;

    return HtmlResponse.page('webapp/client/pages/index', {
      view: 'webapp/client/views/user-scores',
      pageTitle: 'Scores',
      userId,
    });
  };

  const notFound = (req) => {
    return HtmlResponse.page('webapp/client/pages/index', {
      view: 'webapp/client/views/404',
      pageTitle: 'Not Found',
    });
  };

  const error = (req) => {
    return HtmlResponse.page('webapp/client/pages/index', {
      view: 'webapp/client/views/500',
      pageTitle: 'Error',
    });
  };

  return {
    home,
    scores,
    notFound,
    error,
  };
})();
