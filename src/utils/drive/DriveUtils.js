const DriveUtils = {
  /**
   *
   * @param {string} url
   * @returns {string}
   */
  extractIdFromUrl(url) {
    const match = url.match(/[-\w]{25,}/);
    return match ? match[0] : null;
  },
  /**
   * 
   * @param {string} str 
   * @returns {string}
   */
  escapeSearchQueryString(str = '') {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  },
};
