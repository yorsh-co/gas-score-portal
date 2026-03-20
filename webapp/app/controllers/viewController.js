const ViewsController = (() => {
  const home = (_req, res) => {
    res.locals.view = 'webapp/client/views/user-scores';
    res.locals.pageTitle = 'Home';
    return res.status(200).render('webapp/client/pages/index');
  };

  const scores = (req, res) => {
    res.locals.view = 'webapp/client/views/user-scores';
    res.locals.pageTitle = 'Scores';
    res.locals.userId = req.params.userId || null;
    return res.status(200).render('webapp/client/pages/index');
  };

  const notFound = (_req, res) => {
    res.locals.view = 'webapp/client/views/404';
    res.locals.pageTitle = 'Not Found';
    return res.status(404).render('webapp/client/pages/index');
  };

  const error = (_req, res) => {
    res.locals.view = 'webapp/client/views/500';
    res.locals.pageTitle = 'Error';
    return res.status(404).render('webapp/client/pages/index');
  };

  return { home, scores, notFound, error };
})();
