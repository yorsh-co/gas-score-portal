const StringUtils = {
  /**
   * Converts a string to Proper Case. Characters other than letters, digits,
   * apostrophes, hyphens and spaces become spaces.
   * @param str Input string.
   */
  toProperCase(str: string): string {
    const cleaned = str.replace(/[^\p{L}\p{N}'\s-]/gu, ' ');

    return cleaned
      .split(/\s+/)
      .map((word) =>
        word
          .split('-')
          .map((part) =>
            part
              ? part.charAt(0).toLocaleUpperCase() +
                part.slice(1).toLocaleLowerCase()
              : '',
          )
          .join('-'),
      )
      .join(' ');
  },

  /**
   * Lowercases a string and strips accents and everything but letters and digits.
   * @param str Input string.
   */
  normalize(str = ''): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\p{L}\p{N}]/gu, '');
  },

  /**
   * Lowercases an email and strips accents and characters that cannot be part
   * of an address.
   * @param str Raw email.
   */
  normalizeEmail(str = ''): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\p{L}\p{N}@._+-]/gu, '');
  },

  /**
   * Hides all but the first two characters of the local part of an email.
   * @param email Email address.
   */
  maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    return `${local.slice(0, 2)}...@${domain}`;
  },
};
