/**
 * Object-related helper utilities.
 *
 * @namespace arrayUtils
 */
const ArrayUtils = (() => {
  /**
   *
   * @param {Array} arr
   * @returns {number}
   */
  const lastNonEmptyIndex = (arr) => {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i] !== '') return i;
    }
    return -1;
  };

  /**
   *
   * @param {Array} data
   * @param {*} fill
   * @returns {Array}
   */
  const normalizeRows = (data, fill = '') => {
    const maxLength = getLongestRowLength(data);
    return data.map((row) => [
      ...row,
      ...Array(maxLength - row.length).fill(fill),
    ]);
  };

  const getLongestRowLength = (data) => Math.max(...data.map((row) => row.length));

  return {
    lastNonEmptyIndex,
    normalizeRows,
    getLongestRowLength,
  };
})();
