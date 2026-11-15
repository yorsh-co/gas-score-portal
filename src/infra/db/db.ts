/** Sheet names of the data tables. Fixed in English; only the UI is localized. */
const DB_SHEET_NAMES = {
  forms: 'Forms',
  respondents: 'Respondents',
  scores: 'Scores',
  overview: 'Overview',
} as const;

/** The subset of a gas-sheetdb table that the repositories use. */
type DbTable = Pick<
  _GasSheetDbTable,
  | 'find'
  | 'findWhere'
  | 'findOneWhere'
  | 'insert'
  | 'insertMany'
  | 'updateWhere'
  | 'updateOneWhere'
>;

let sheetDbInstance: GasSheetDb | null = null;
const dbTables: Partial<Record<string, _GasSheetDbTable>> = {};

/** Returns the database over the active spreadsheet, guarded by the script lock. */
function getSheetDb_(): GasSheetDb {
  if (!sheetDbInstance) {
    sheetDbInstance = new GasSheetDb({
      useActiveSpreadsheet: true,
      lockScope: 'script',
      logger: createModuleLogger_('sheetdb'),
    });
  }
  return sheetDbInstance;
}

/**
 * Returns the table backed by a sheet, creating the sheet on first use.
 * @param sheetName Sheet name; one of `DB_SHEET_NAMES`.
 */
function getDbTable_(sheetName: string): _GasSheetDbTable {
  let table = dbTables[sheetName];
  if (!table) {
    table = getSheetDb_().table({ sheetName });
    dbTables[sheetName] = table;
  }
  return table;
}

/** Returns the `Forms` table. */
function getFormsTable_(): _GasSheetDbTable {
  return getDbTable_(DB_SHEET_NAMES.forms);
}

/** Returns the `Respondents` table. */
function getRespondentsTable_(): _GasSheetDbTable {
  return getDbTable_(DB_SHEET_NAMES.respondents);
}

/** Returns the `Scores` table. */
function getScoresTable_(): _GasSheetDbTable {
  return getDbTable_(DB_SHEET_NAMES.scores);
}

/**
 * Converts a stored cell to a string. Empty cells become `''`.
 * @param value Cell value.
 */
function cellToString_(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

/**
 * Converts a stored cell to a finite number, or `null` when empty or invalid.
 * `0` is a real value and is preserved.
 * @param value Cell value.
 */
function cellToNumber_(value: unknown): number | null {
  if (value === '' || value === undefined || value === null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Converts a stored cell to a valid date, or `null`.
 * @param value Cell value.
 */
function cellToDate_(value: unknown): Date | null {
  return Object.prototype.toString.call(value) === '[object Date]' &&
    !isNaN((value as Date).getTime())
    ? (value as Date)
    : null;
}
