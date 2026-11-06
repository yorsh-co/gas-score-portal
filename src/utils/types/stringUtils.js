/**
 * Utility functions for string manipulation and JSON parsing.
 * @module StringUtils
 */
const StringUtils = (() => {
  /**
   * Converts a string to Proper Case (first letter of each word capitalized).
   * Non-alphanumeric characters are replaced with spaces.
   * @param {string} str - The input string.
   * @returns {string} Proper-cased string.
   */
  const toProperCase = (str) => {
    const cleaned = str.replace(/[^\p{L}\p{N}'\s-]/gu, ' ');

    return cleaned
      .split(/\s+/)
      .map((word) =>
        word
          .split('-')
          .map((part) =>
            part
              ? part[0].toLocaleUpperCase() + part.slice(1).toLocaleLowerCase()
              : '',
          )
          .join('-'),
      )
      .join(' ');
  };

  /**
   * Converts a string to camelCase.
   * Non-alphanumeric characters are removed, words are joined with the first word in lowercase.
   * @param {string} str - The input string.
   * @returns {string} CamelCased string.
   */
  const toCamelCase = (str) => {
    return str
      .toLowerCase()
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .split(/[\s_]+/)
      .map((word, index) =>
        index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1),
      )
      .join('');
  };

  /**
   *
   * @param {String} str
   * @returns {String}
   */
  const normalize = (str = '') =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]/gu, '');

  /**
   *
   * @param {String} str
   * @returns {String}
   */
  const normalizeEmail = (str = '') =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}@._+-]/gu, '');

  /**
   * Escape characters in a string for a regex.
   * @param {String} str - This input string.
   * @returns {String} - The escaped regex string.
   */
  const escapeRegExp = (str) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  /**
   * Checks if a string is a valid email.
   * @param {string} email
   * @returns {boolean}
   */
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  /**
   *
   * @param {string} email
   * @returns {string}
   */
  const maskEmail = (email) => {
    console.error('masking email', email);
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    const visible = local.slice(0, 2);
    return `${visible}...@${domain}`;
  };

  /**
   * Replace placeholders in a string using data from an object.
   * The keys from the object are using as the placeholders, between curly brackets.
   * @param {String} str
   * @param {Object} data
   * @returns {String}
   */
  const replacePlaceholders = (str, data) => {
    Object.entries(data).forEach(
      ([placeholder, value]) =>
        (str = str.replace(
          `{${StringUtils.escapeRegExp(placeholder)}}`,
          value || '',
        )),
    );
    return str;
  };

  /**
   * Replace placeholders in a string using data from a (possibly nested) object.
   * Placeholders must use dot-notation paths wrapped in curly brackets.
   *
   * Example placeholder: {user.name}
   *
   * @param {string} str
   * @param {Object} data
   * @returns {string}
   */
  const replacePlaceholdersForNestedObj = (str, data) => {
    const replaceRecursive = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        if (
          typeof value === 'object' &&
          !Array.isArray(value) &&
          value !== null
        ) {
          replaceRecursive(value, currentPath);
        } else {
          const placeholder = `{${StringUtils.escapeRegExp(currentPath)}}`;
          str = str.replace(new RegExp(placeholder, 'g'), value ?? '');
        }
      }
    };

    replaceRecursive(data);
    return str;
  };

  /**
   * Splits a string into an array of substrings, each with a maximum character length.
   * @param {string} string - The string to split.
   * @param {number} charLim - Maximum length of each substring.
   * @returns {string[]} Array of substrings.
   */
  const getArrayFromStringByCharLim = (string, charLim) => {
    charLim = charLim ?? (MAX_STRING_LENGTH || 50000);

    /**
     * Recursively splits a string.
     * @param {string} str
     * @returns {string[]}
     */
    const splitString = (str) =>
      str.length <= charLim
        ? [str]
        : [str.slice(0, charLim), ...splitString(str.slice(charLim))];

    const arr = splitString(string.toString());
    Logger.log('Split string into %s items', arr.length);
    return arr;
  };

  /**
   * Parses JSON from an array of strings by joining them first.
   * @param {string[]} arr - Array of strings representing JSON content.
   * @returns {Object|undefined} Parsed JSON object, or undefined if parsing fails.
   */
  const parseJsonFromStringArray = (arr) => {
    const string = arr.join('');
    try {
      return JSON.parse(string);
    } catch (e) {
      console.error('Failed to parse JSON from array', arr, '. Error:', e);
      return undefined;
    }
  };

  return {
    toProperCase,
    toCamelCase,
    normalize,
    normalizeEmail,
    escapeRegExp,
    isValidEmail,
    maskEmail,
    replacePlaceholders,
    replacePlaceholdersForNestedObj,
    getArrayFromStringByCharLim,
    parseJsonFromStringArray,
  };
})();
