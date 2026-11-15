/**
 * Reads the pivot rendered by the overview formula into a map keyed by
 * email, then by column header.
 * @param values Sheet values, header row first.
 */
function readOverviewMatrix(values: unknown[][]): {
  headers: string[];
  rows: Record<string, Record<string, unknown>>;
} {
  const headers = (values[0] ?? []).map((cell) => String(cell));
  const rows: Record<string, Record<string, unknown>> = {};
  for (const row of values.slice(1)) {
    const cells: Record<string, unknown> = {};
    headers.forEach((header, col) => (cells[header] = row[col]));
    rows[String(row[0])] = cells;
  }
  return { headers, rows };
}

test('overview formula pivots a real sheet', (ctx) => {
  const tables = createTestTables(ctx);
  const dupA = 'https://forms/aaaaaa1';
  const dupB = 'https://forms/bbbbbb2';
  const blank = 'https://forms/blank33';
  tables.respondents.insertMany([
    { email: 'ana@x.org', name: 'Ana' },
    { email: 'bob@x.org', name: 'Bob' },
  ]);
  tables.forms.insertMany([
    { url: 'u1', title: 'Alpha' },
    { url: dupA, title: 'Dup' },
    { url: dupB, title: 'Dup' },
    { url: blank, title: '' },
    { url: 'gone', title: 'Gone' },
  ]);
  const stored = tables.scores.insertMany([
    { email: 'ana@x.org', formUrl: 'u1', score: 10 },
    { email: 'ana@x.org', formUrl: dupA, score: 5 },
    { email: 'ana@x.org', formUrl: dupA, score: 8 },
    { email: 'ana@x.org', formUrl: dupB, score: 3 },
    { email: 'ana@x.org', formUrl: 'gone', score: 9 },
    { email: 'bob@x.org', formUrl: 'u1', score: 0 },
    { email: 'bob@x.org', formUrl: blank, score: 7 },
    { email: 'bob@x.org', formUrl: dupB, score: 4 },
  ]);
  tables.scores.softDelete(stored[7] as GasSheetDbEntry);
  const goneForm = tables.forms.findOneWhere((e) => e.url === 'gone');
  assert(goneForm !== null, 'the form to delete must exist');
  tables.forms.softDelete(goneForm as GasSheetDbEntry);

  const sheet = ctx.spreadsheet.insertSheet(`${ctx.prefix}Overview`);
  const separators = detectFormulaSeparators_(sheet);
  sheet
    .getRange(1, 1)
    .setFormula(
      buildOverviewFormula_(
        tables.forms,
        tables.respondents,
        tables.scores,
        separators,
      ),
    );
  SpreadsheetApp.flush();
  const { headers, rows } = readOverviewMatrix(
    sheet.getDataRange().getValues(),
  );

  const labelA = `Dup (${dupA.slice(-6)})`;
  const labelB = `Dup (${dupB.slice(-6)})`;
  const expected = ['Email', 'Name', 'Alpha', labelA, labelB, blank];
  assert(
    expected.every((h) => headers.includes(h)) &&
      headers.length === expected.length,
    `unexpected headers ${JSON.stringify(headers)}`,
  );
  const ana = rows['ana@x.org'];
  const bob = rows['bob@x.org'];
  assert(ana !== undefined && bob !== undefined, 'one row per respondent');
  assert(ana['Name'] === 'Ana', 'name is looked up');
  assert(ana['Alpha'] === 10, 'plain score');
  assert(ana[labelA] === 8, 'duplicate rows use max, not sum');
  assert(ana[labelB] === 3, 'repeated titles get distinct columns');
  assert(bob['Alpha'] === 0, 'a zero score is kept');
  assert(bob[blank] === 7, 'a blank title is labelled by its URL');
  assert(bob[labelB] === '', 'a soft-deleted score is excluded');
  assert(!headers.includes('Gone'), 'a soft-deleted form is excluded');
});
