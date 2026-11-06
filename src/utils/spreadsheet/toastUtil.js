/**
 * Utility for displaying toast messages in Google Sheets with logging.
 * @module Toast
 */
const Toast = (() => {
  /**
   * Shows a toast with a specific type, emoji, title, and optional timeout.
   * Logs the message using Logger or console.error depending on type.
   *
   * @param {'busy'|'loading'|'ready'|'success'|'warning'|'error'} type - The type of toast.
   * @param {string} emoji - Emoji prefix for the toast title.
   * @param {string} defaultTitle - Default title if none is provided.
   * @param {string} [message] - Message to display in the toast.
   * @param {string} [title] - Optional custom title for the toast.
   * @param {number} [timeout] - Duration in seconds; -1 for indefinite.
   */
  const show = (type, emoji, defaultTitle, message, title, timeout) => {
    SS.toast(message || '', `${emoji} ${title || defaultTitle}`, timeout);

    const logMessage = `${title || ''} ${message || ''}`;
    if (type === 'error' || type === 'warning') {
      console.error(`Toast - ${capitalize(type)}: %s`, logMessage);
    } else {
      Logger.log(`Toast - ${capitalize(type)}: %s`, logMessage);
    }
  };

  /**
   * Capitalizes the first letter of a string.
   * @param {string} str - The string to capitalize.
   * @returns {string} - Capitalized string.
   */
  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

  return {
    /**
     * Shows a busy toast (indefinite duration).
     * @param {string} [message] - Message to display.
     * @param {string} [title] - Custom title.
     */
    busy: (message, title) =>
      show('busy', '🔵', 'Ocupado...', message, title, -1),

    /**
     * Shows a loading toast (indefinite duration).
     * @param {string} [message] - Message to display.
     * @param {string} [title] - Custom title.
     */
    loading: (message, title) =>
      show('loading', '🔵', 'Carregando...', message, title, -1),

    /**
     * Shows a ready toast.
     * @param {string} [message] - Message to display.
     * @param {string} [title] - Custom title.
     */
    ready: (message, title) => show('ready', '🟢', 'Pronto', message, title),

    /**
     * Shows a success toast.
     * @param {string} [message] - Message to display.
     * @param {string} [title] - Custom title.
     */
    success: (message, title) =>
      show('success', '🟢', 'Sucesso', message, title),

    /**
     * Shows a warning toast.
     * @param {string} [message] - Message to display.
     * @param {string} [title] - Custom title.
     */
    warning: (message, title) =>
      show('warning', '🟡', 'Alerta', message, title),

    /**
     * Shows an error toast (15 seconds duration).
     * @param {string} [message] - Message to display.
     * @param {string} [title] - Custom title.
     */
    error: (message, title) => show('error', '🔴', 'Erro', message, title, 15),
  };
})();
