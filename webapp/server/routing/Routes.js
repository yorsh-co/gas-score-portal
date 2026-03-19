const Routes = {
  '/': {
    GET: ViewsController.home
  },

  '/users/scores': {
    GET: ViewsController.scores
  },

  '/api/users/scores': {
    GET: ApiController.getUserScores,
  },
};
