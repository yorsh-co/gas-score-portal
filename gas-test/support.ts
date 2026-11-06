/** The three data tables of one test run, on prefixed sheets. */
interface TestTables {
  forms: _GasSheetDbTable;
  respondents: _GasSheetDbTable;
  scores: _GasSheetDbTable;
}

/**
 * Creates the `Forms`, `Respondents` and `Scores` tables on sheets named with
 * the run prefix, so the real tables of the spreadsheet are never touched.
 * @param ctx Test context.
 */
function createTestTables(ctx: GasTestContext): TestTables {
  const db = new GasSheetDb({
    spreadsheet: ctx.spreadsheet,
    lockScope: 'script',
  });
  return {
    forms: db.table({ sheetName: `${ctx.prefix}Forms` }),
    respondents: db.table({ sheetName: `${ctx.prefix}Respondents` }),
    scores: db.table({ sheetName: `${ctx.prefix}Scores` }),
  };
}

/**
 * Creates the repositories over a set of tables.
 * @param tables Backing tables.
 */
function createTestRepos(tables: TestTables) {
  return {
    forms: createFormsRepo(tables.forms),
    respondents: createRespondentsRepo(tables.respondents),
    scores: createScoresRepo(tables.scores),
  };
}
