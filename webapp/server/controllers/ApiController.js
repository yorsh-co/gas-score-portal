const ApiController = (() => {
  const getUserScores = (req) => {
    const userId = req.params.userId;

    if (!userId)
      throw HttpError.badRequest('ID do usuário vazio');
    
    const scores = ScoresService.getByUser(userId);
    if (!scores) throw HttpError.notFound('Usuário não encontrado');

    return JsonResponse.success(scores);
  };

  return {
    getUserScores,
  };
})();
