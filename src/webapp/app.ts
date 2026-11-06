/** The web app. Tables are resolved per request, so loading touches no sheet. */
const app = createWebApp(
  createScoresService(() => ({
    forms: createFormsRepo(getFormsTable()),
    respondents: createRespondentsRepo(getRespondentsTable()),
    scores: createScoresRepo(getScoresTable()),
    getExcludedUrls: getExcludedFormUrls,
    getLocale: () => getConfig().get('locale') ?? 'en',
  })),
);
