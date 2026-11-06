/**
 * Writes a generated `💯 Notas` matrix to a prefixed sheet and reads it back,
 * so the migration sees the types that Sheets really returns.
 * @param ctx Test context.
 * @param name Sheet name after the run prefix; unique per test.
 */
function readGeneratedLegacyScores(
  ctx: GasTestContext,
  name: string,
): unknown[][] {
  const synced = new Date('2025-05-05T10:00:00Z');
  const rows = [
    ['', '', '', 'u1', 'u2', 'u3'],
    ['', '', '', synced, '', ''],
    ['', '', '', 10, 20, ''],
    ['', '', '', 'T4 - Alpha', 'Beta', 'Gamma'],
    ['Ana@X.org', 'Ana Souza', '', 10, 0, ''],
    ['bob@x.org', 'Bob', 'ana@x.org', '', 15, 'n/a'],
    ['', 'No email', '', 9, 9, 9],
  ];
  const sheet = ctx.spreadsheet.insertSheet(`${ctx.prefix}${name}`);
  sheet.getRange(1, 1, rows.length, rows[0]!.length).setValues(rows);
  return sheet.getDataRange().getValues();
}

test('migrates a generated legacy matrix into the real tables', (ctx) => {
  const repos = createTestRepos(createTestTables(ctx));
  const scores = readGeneratedLegacyScores(ctx, 'legacy_migrate');
  const forms = [['u1', 'Alpha', 'Vinculado ao sistema', '']];

  const counts = migrateLegacyData({ forms, scores }, repos);

  assert(counts.forms === 3, `forms: ${counts.forms}`);
  assert(counts.respondents === 2, `respondents: ${counts.respondents}`);
  assert(counts.scores === 3, `scores: ${counts.scores}`);
  assert(counts.invalidScores === 1, `invalid: ${counts.invalidScores}`);
  assert(repos.scores.getByForm('u2').get('ana@x.org') === 0, 'zero is kept');
  assert(repos.forms.get('u2')?.maxPoints === 20, 'max points are migrated');
});

test('migration is idempotent on the real tables', (ctx) => {
  const repos = createTestRepos(createTestTables(ctx));
  const scores = readGeneratedLegacyScores(ctx, 'legacy_rerun');

  migrateLegacyData({ forms: [], scores }, repos);
  const again = migrateLegacyData({ forms: [], scores }, repos);

  assert(
    again.forms === 0 && again.respondents === 0 && again.scores === 0,
    `a rerun wrote ${JSON.stringify(again)}`,
  );
});
