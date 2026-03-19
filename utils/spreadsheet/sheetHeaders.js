/**
 *
 * @param {Object} params
 * @param {String} params.sheetName
 * @param {GoogleAppsScript.Spreadsheet.Sheet} params.sheet
 *
 * @returns {Array}
 */
const getSheetHeaders = ({ sheetName, sheet }) => {
  if (!sheet && !sheetName)
    throw new Error(
      'At least one argument is required to get the sheet headers'
    );
  if (!sheet) sheet = SS.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet ${sheetName} not found`);

  const rowNum = getSheetHeaderRowNumber(sheet);
  const headers = sheet
    .getRange(rowNum, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  Logger.log('Get headers for %s: %s', sheet.getName(), headers);
  return headers;
};

/**
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 *
 * @returns {Number}
 */
const getSheetHeaderRowNumber = (sheet) => {
  const sheetName = sheet.getSheetName();
  const sheetRef =
    SHEETS[Object.keys(SHEETS).find((key) => SHEETS[key].name === sheetName)];
  return sheetRef?.rows?.headers || 1;
};
