/**
 * CsvDb utility for Apps Script
 * Store, read, and update CSV files in Google Drive.
 */
const CsvDb = {
  /**
   * Load CSV into a 2D array
   * @param {string} fileId - Google Drive file ID
   * @returns {string[][]} Parsed CSV as array of rows
   */
  load(fileId) {
    const file = DriveApp.getFileById(fileId);
    const csv = file.getBlob().getDataAsString();
    return Utilities.parseCsv(csv);
  },

  /**
   * Save a 2D array back to CSV (overwrite file)
   * @param {string} fileId - Google Drive file ID
   * @param {string[][]} data - 2D array
   */
  save(fileId, data) {
    const csv = data.map((row) => row.join(',')).join('\n');
    DriveApp.getFileById(fileId).setContent(csv);
  },

  /**
   * Update a single cell
   * @param {string} fileId
   * @param {number} row - zero-based index
   * @param {number} col - zero-based index
   * @param {string} value - new value
   */
  updateCell(fileId, row, col, value) {
    const data = load(fileId);
    data[row][col] = value;
    save(fileId, data);
  },

  /**
   * Append a row at the bottom
   * @param {string} fileId
   * @param {string[]} row - array of values
   */
  appendRow(fileId, row) {
    const data = load(fileId);
    data.push(row);
    save(fileId, data);
  },

  /**
   * Find rows matching a condition
   * @param {string} fileId
   * @param {function(string[]): boolean} predicate
   * @returns {string[][]} Matching rows
   */
  findRows(fileId, predicate) {
    const data = load(fileId);
    return data.filter(predicate);
  },
};
