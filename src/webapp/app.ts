let app: GasWebApp | undefined;

/**
 * Returns the web app, created on first use. It is not built at load time
 * because clasp loads the files alphabetically, so the functions it uses may
 * not be defined yet. Tables are resolved per request, so creating it touches
 * no sheet.
 */
function getApp(): GasWebApp {
  if (!app) {
    app = createWebApp(
      createScoresService(() => ({
        forms: createFormsRepo(getFormsTable()),
        respondents: createRespondentsRepo(getRespondentsTable()),
        scores: createScoresRepo(getScoresTable()),
        getExcludedUrls: getExcludedFormUrls,
        getLocale: () => getConfig().get('locale') ?? 'en',
      })),
    );
  }
  return app;
}
