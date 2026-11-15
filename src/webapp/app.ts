let app: GasWebApp | undefined;

/**
 * Returns the web app, created on first use. It is not built at load time
 * because clasp loads the files alphabetically, so the functions it uses may
 * not be defined yet. Tables are resolved per request, so creating it touches
 * no sheet.
 */
function getApp_(): GasWebApp {
  if (!app) {
    app = createWebApp_(
      createScoresService_(() => ({
        forms: createFormsRepo_(getFormsTable_()),
        respondents: createRespondentsRepo_(getRespondentsTable_()),
        scores: createScoresRepo_(getScoresTable_()),
        getExcludedUrls: getExcludedFormUrls_,
        getTitleStripPatterns: getFormTitleStripPatterns_,
        getLocale: getLocale_,
      })),
      createAuthServices_(
        () => createRespondentsRepo_(getRespondentsTable_()),
        createModuleLogger_('auth'),
      ),
    );
  }
  return app;
}
