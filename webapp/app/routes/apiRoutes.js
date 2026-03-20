const ApiRoutes = (() => {
  const register = (router) => {
    router.get(
      '/api/users/:userId/scores',
      // AuthMiddleware.requireAuth,
      ApiController.getUserScores
    );
  };

  return { register };
})();