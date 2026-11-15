/** Kinds of toast, each with its own emoji and log level. */
type ToastType = 'busy' | 'loading' | 'ready' | 'success' | 'warning' | 'error';

/**
 * Toast messages shown in the spreadsheet, logged alongside.
 */
const Toast = (() => {
  const toastLogger = createModuleLogger_('toast');

  /**
   * Shows a toast and logs it at `info`; failures are logged by their handlers.
   * @param type Kind of toast.
   * @param emoji Emoji prefix of the title.
   * @param defaultTitle Title used when none is given.
   * @param message Message body.
   * @param title Custom title.
   * @param timeout Seconds on screen; `-1` keeps it until replaced.
   */
  const show = (
    type: ToastType,
    emoji: string,
    defaultTitle: string,
    message?: string,
    title?: string,
    timeout?: number,
  ): void => {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      message || '',
      `${emoji} ${title || defaultTitle}`,
      timeout ?? 5,
    );

    toastLogger.info(`${title || ''} ${message || ''}`.trim(), { type });
  };

  return {
    /** Busy toast, shown until replaced. */
    busy: (message?: string, title?: string) =>
      show('busy', '🔵', tr_('toast.busy'), message, title, -1),
    /** Loading toast, shown until replaced. */
    loading: (message?: string, title?: string) =>
      show('loading', '🔵', tr_('toast.loading'), message, title, -1),
    /** Ready toast. */
    ready: (message?: string, title?: string) =>
      show('ready', '🟢', tr_('toast.ready'), message, title),
    /** Success toast. */
    success: (message?: string, title?: string) =>
      show('success', '🟢', tr_('toast.success'), message, title),
    /** Warning toast. */
    warning: (message?: string, title?: string) =>
      show('warning', '🟡', tr_('toast.warning'), message, title),
    /** Error toast, shown for 15 seconds. */
    error: (message?: string, title?: string) =>
      show('error', '🔴', tr_('toast.error'), message, title, 15),
  };
})();
