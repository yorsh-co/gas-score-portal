const ViewsController = (() => {
  const home = (_req, res) => {
    return res.status(200).html('webapp/client/pages/index', {
      view: 'webapp/client/views/user-scores',
      pageTitle: 'Home',
    });
  };

  const scores = (req, res) => {
    return res.status(200).html('webapp/client/pages/index', {
      view: 'webapp/client/views/user-scores',
      pageTitle: 'Scores',
      userId: req.params.userId || null,
    });
  };

  const notFound = (_req, res) => {
    return res.status(404).html('webapp/client/pages/index', {
      view: 'webapp/client/views/404',
      pageTitle: 'Not Found',
    });
  };

  const error = (_req, res) => {
    return res.status(404).html('webapp/client/pages/index', {
      view: 'webapp/client/views/500',
      pageTitle: 'Error',
    });
  };

  return { home, scores, notFound, error };
})();