/**
 * Object-related helper utilities.
 *
 * @namespace ObjectUtils
 */
const ObjectUtils = (() => {
  /**
   * Checks whether a value should be considered "empty".
   *
   * A value is considered empty if it is:
   * - `null` or `undefined`
   * - an empty string (after trimming)
   * - an empty array
   * - an empty plain object
   *
   * Numbers (including `0`) and booleans are NOT considered empty.
   *
   * @private
   * @param {*} value
   * @returns {boolean} True if the value is empty
   */
  const isEmpty = (value) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0
    ) {
      return true;
    }
    return false;
  };

  /**
   * Recursively scans an object and returns the paths of all empty values.
   *
   * Nested properties are represented using dot notation.
   *
   * @example
   * ObjectUtils.findEmptyValues({
   *   user: { name: '', email: 'a@b.com' }
   * });
   * // → ['user.name']
   *
   * @param {Object} obj
   *   The object to scan for empty values.
   * @param {string} [path='']
   *   Internal recursion path. Do not supply manually.
   * @returns {string[]}
   *   An array of dot-notation paths pointing to empty values.
   */
  const findEmptyValues = (obj, path = '') => {
    const emptyFields = [];

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (isEmpty(value)) {
        emptyFields.push(currentPath);
        continue;
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        emptyFields.push(...findEmptyValues(value, currentPath));
      }
    }

    return emptyFields;
  };

  /**
   * Recursively scans an object and returns the paths of all parameters.
   *
   * Nested properties are represented using dot notation.
   *
   * @example
   * ObjectUtils.listPaths({
   *   user: { name: 'a', email: 'a@b.com' }
   * });
   * // → ['user.name', 'user.email']
   *
   * @param {Object} obj
   *   The object to scan for key-value pairs.
   * @param {string} [path='']
   *   Internal recursion path. Do not supply manually.
   * @returns {string[]}
   *   An array of dot-notation paths.
   */
  const listPaths = (obj, path = '') => {
    const paths = [];

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (typeof value === 'object' && !Array.isArray(value)) {
        paths.push(...listPaths(value, currentPath));
      } else {
        paths.push(currentPath);
      }
    }

    return paths;
  };

  /**
   * Determines whether an object contains at least one empty value.
   *
   * @param {Object} obj
   *   The object to check.
   * @returns {boolean}
   *   True if one or more empty values are found.
   */
  const hasEmptyValues = (obj) => findEmptyValues(obj).length > 0;

  return {
    findEmptyValues,
    hasEmptyValues,
    listPaths,
  };
})();
