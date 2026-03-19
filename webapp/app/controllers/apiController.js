const ApiController = (() => {
  const getUserScores = (req, res) => {
    const userId = req.params.userId;

    if (!userId) {
      return res.error(HttpError.badRequest('ID do usuário vazio'));
    }

    const scores = ScoresService.getByUser(userId);

    if (!scores) {
      return res.error(HttpError.notFound('Usuário não encontrado'));
    }

    return res.status(200).json(scores);
  };

  return { getUserScores };
})();