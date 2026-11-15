/** Name of the sheet that receives warnings and errors. */
const LOG_SHEET_NAME = 'Log';

/**
 * Application-wide logger. Writes `info` and above to the execution log and
 * `error` to the `Log` sheet. The sheet is resolved lazily, so
 * creating the logger touches no Apps Script service.
 */
const appLogger = new GasLogger({
  level: 'info',
  sheetLevel: 'error',
  sheetConfig: {
    spreadsheet: () => SpreadsheetApp.getActiveSpreadsheet(),
    sheetName: LOG_SHEET_NAME,
  },
});

/**
 * Returns a logger bound to a module name.
 * @param module Module name added to every entry.
 */
function createModuleLogger_(module: string): GasLogger {
  return appLogger.child({ module });
}
