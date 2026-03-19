const ViewRoutes = (() => {
  const register = (router) => {
    router.get('/', ViewsController.home);
    router.get('/users/scores', ViewsController.scores);
  };

  return { register };
})();