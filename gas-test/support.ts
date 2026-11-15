/** The three data tables of one test run, on prefixed sheets. */
interface TestTables {
  forms: _GasSheetDbTable;
  respondents: _GasSheetDbTable;
  scores: _GasSheetDbTable;
}

let testTablesCount = 0;

/**
 * Creates the `Forms`, `Respondents` and `Scores` tables on sheets named with
 * the run prefix and a per-call number, so the real tables of the spreadsheet
 * are never touched and tests of one run do not share rows.
 * @param ctx Test context.
 */
function createTestTables(ctx: GasTestContext): TestTables {
  const db = new GasSheetDb({
    spreadsheet: ctx.spreadsheet,
    lockScope: 'script',
  });
  const prefix = `${ctx.prefix}${++testTablesCount}_`;
  return {
    forms: db.table({ sheetName: `${prefix}Forms` }),
    respondents: db.table({ sheetName: `${prefix}Respondents` }),
    scores: db.table({ sheetName: `${prefix}Scores` }),
  };
}

/**
 * Creates the repositories over a set of tables.
 * @param tables Backing tables.
 */
function createTestRepos(tables: TestTables) {
  return {
    forms: createFormsRepo_(tables.forms),
    respondents: createRespondentsRepo_(tables.respondents),
    scores: createScoresRepo_(tables.scores),
  };
}
