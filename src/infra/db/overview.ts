/** Warning shown when someone edits the generated overview. */
const OVERVIEW_PROTECTION_NOTE =
  'Generated from the Scores table. Edits are overwritten.';

/** The parts of a table that the overview formula needs. */
type OverviewSource = Pick<_GasSheetDbTable, 'sheetName' | 'rowNumbers'> & {
  schema: Pick<_GasSheetDbTable['schema'], 'ensureColumns' | 'columnKeys'>;
};

/**
 * Converts a 1-based column index to its A1 letters.
 * @param index Column index, starting at 1.
 */
function columnLetter(index: number): string {
  let letters = '';
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26))
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  return letters;
}

/**
 * Builds an open-ended A1 range over the data rows of a table column.
 * @param table Source table.
 * @param key Column key; created when missing.
 */
function tableColumnRange(table: OverviewSource, key: string): string {
  table.schema.ensureColumns([key]);
  const letter = columnLetter(table.schema.columnKeys.indexOf(key) + 1);
  const first = table.rowNumbers.firstData;
  return `'${table.sheetName}'!${letter}${first}:${letter}`;
}

/** The separators that a spreadsheet locale expects inside a formula. */
interface FormulaSeparators {
  /** Between function arguments. */
  arg: string;
  /** Between the columns of an array literal. */
  column: string;
}

/** Separators of locales with a decimal point. */
const FORMULA_SEPARATORS_POINT: FormulaSeparators = { arg: ',', column: ',' };

/** Separators of locales with a decimal comma, such as `pt_BR`. */
const FORMULA_SEPARATORS_COMMA: FormulaSeparators = { arg: ';', column: '\\' };

/**
 * Finds which separators the spreadsheet locale accepts. `setFormula` parses
 * the formula in the spreadsheet locale, so `IF(a, b, c)` is a parse error
 * in locales with a decimal comma. Writes to the top-left cell of the sheet.
 * @param sheet Sheet to probe.
 */
function detectFormulaSeparators(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
): FormulaSeparators {
  const cell = sheet.getRange(1, 1);
  cell.setFormula('=IF(TRUE, 1, 0)');
  SpreadsheetApp.flush();
  return cell.getDisplayValue() === '#ERROR!'
    ? FORMULA_SEPARATORS_COMMA
    : FORMULA_SEPARATORS_POINT;
}

/**
 * Builds the formula that pivots scores into one row per respondent and one
 * column per form. Columns are labelled by title, with a URL suffix when
 * titles repeat and the URL when the title is blank. Soft-deleted rows are excluded.
 * @param forms `Forms` table.
 * @param respondents `Respondents` table.
 * @param scores `Scores` table.
 * @param separators Separators of the spreadsheet locale.
 */
function buildOverviewFormula(
  forms: OverviewSource,
  respondents: OverviewSource,
  scores: OverviewSource,
  separators: FormulaSeparators = FORMULA_SEPARATORS_POINT,
): string {
  const a = `${separators.arg} `;
  const c = `${separators.column} `;
  const scoreEmail = tableColumnRange(scores, 'email');
  const scoreForm = tableColumnRange(scores, 'formUrl');
  const scoreValue = tableColumnRange(scores, 'score');
  const formUrl = tableColumnRange(forms, 'url');
  const formTitle = tableColumnRange(forms, 'title');
  const respondentEmail = tableColumnRange(respondents, 'email');
  const respondentName = tableColumnRange(respondents, 'name');

  const scoreDeleted = tableColumnRange(scores, '_isDeleted');
  const formDeleted = tableColumnRange(forms, '_isDeleted');

  const flag = (range: string) => `ARRAYFORMULA(IF(${range}=TRUE${a}1${a}0))`;
  const lookup = (key: string, table: string, fallback: string) =>
    `ARRAYFORMULA(IFERROR(VLOOKUP(${key}${a}${table}${a}2${a}FALSE)${a}${fallback}))`;

  const label = `ARRAYFORMULA(IF(${formTitle}=""${a}${formUrl}${a}IF(COUNTIF(${formTitle}${a}${formTitle})>1${a}${formTitle}&" ("&RIGHT(${formUrl}${a}6)&")"${a}${formTitle})))`;
  const name = lookup(
    scoreEmail,
    `{${respondentEmail}${c}${respondentName}}`,
    '""',
  );
  const title = lookup(scoreForm, `{${formUrl}${c}${label}}`, scoreForm);
  const scoreGone = flag(scoreDeleted);
  const formGone = lookup(
    scoreForm,
    `{${formUrl}${c}${flag(formDeleted)}}`,
    '0',
  );
  // The query language keeps its own comma syntax in every locale.
  const query =
    "select Col1, Col2, max(Col4) where Col1 <> '' and Col5 = 0 and Col6 = 0 group by Col1, Col2 pivot Col3 label Col1 'Email', Col2 'Name'";
  const data = `{${[scoreEmail, name, title, scoreValue, scoreGone, formGone].join(c)}}`;

  return `=IFERROR(QUERY(${data}${a}"${query}"${a}0)${a}"")`;
}

/**
 * Creates or refreshes the read-only `Overview` sheet: a people-friendly
 * matrix of scores, driven by a single formula over the data tables.
 * @param spreadsheet Target spreadsheet.
 * @param forms `Forms` table.
 * @param respondents `Respondents` table.
 * @param scores `Scores` table.
 */
function refreshOverview(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet = SpreadsheetApp.getActiveSpreadsheet(),
  forms: OverviewSource = getFormsTable(),
  respondents: OverviewSource = getRespondentsTable(),
  scores: OverviewSource = getScoresTable(),
): GoogleAppsScript.Spreadsheet.Sheet {
  const sheet =
    spreadsheet.getSheetByName(DB_SHEET_NAMES.overview) ??
    spreadsheet.insertSheet(DB_SHEET_NAMES.overview);

  sheet.clear();
  const separators = detectFormulaSeparators(sheet);
  sheet
    .getRange(1, 1)
    .setFormula(buildOverviewFormula(forms, respondents, scores, separators));
  sheet.setFrozenRows(1);

  if (!sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) {
    sheet
      .protect()
      .setWarningOnly(true)
      .setDescription(OVERVIEW_PROTECTION_NOTE);
  }
  return sheet;
}
