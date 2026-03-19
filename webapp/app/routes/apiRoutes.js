const ApiRoutes = (() => {
  const register = (router) => {
    router.get(
      '/api/users/scores',
      // AuthMiddleware.requireAuth,
      ApiController.getUserScores
    );
  };

  return { register };
})();