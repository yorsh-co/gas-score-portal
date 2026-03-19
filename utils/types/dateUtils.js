/**
 * Utility functions for working with Date objects.
 * @module DateUtils
 */
const DateUtils = (() => {
  /**
   * Checks if a value is a valid Date object.
   * @param {Date} testDate - The date to validate.
   * @returns {boolean} True if the input is a valid Date, false otherwise.
   */
  const isValidDate = (testDate) => {
    return testDate instanceof Date && !isNaN(testDate.getTime());
  };

  /**
   *
   * @param {Date} dateA
   * @param {Date} dateB
   * @returns
   */
  const isSameDate = (dateA, dateB) =>
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate();

  return {
    isValidDate,
    isSameDate,
  };
})();
