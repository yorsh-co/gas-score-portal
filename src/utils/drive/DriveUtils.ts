const DriveUtils = {
  /**
   * Extracts the file or folder ID from a Drive URL.
   * @param url Drive URL.
   * @returns The ID, or `null` when the URL has none.
   */
  extractIdFromUrl(url: string): string | null {
    const match = url.match(/[-\w]{25,}/);
    return match ? match[0] : null;
  },

  /**
   * Escapes a string for use inside a quoted Drive search query.
   * @param str Raw text.
   */
  escapeSearchQueryString(str = ''): string {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  },
};
