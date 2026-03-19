/**
 * Refresh cols reference for the sheet in `SHEETS` using the colNames reference.
 * @param {String} sheetName
 */
const refreshColNumsForSheet = (sheetName) => {
  const headers = getSheetHeaders({ sheetName: sheetName });
  const sheetRef =
    SHEETS[
      Object.keys(SHEETS).find(
        (sheetKey) => SHEETS[sheetKey].name === sheetName
      )
    ];

  Object.entries(sheetRef.colNames).forEach(
    ([key, header]) => (sheetRef.cols[key] = headers.indexOf(header) + 1 || sheetRef.cols[key])
  );

  Logger.log('Refresh col nums for %s', sheetName);
};
