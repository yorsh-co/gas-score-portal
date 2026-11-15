/**
 * Creates the error thrown when the user cancels a prompt or confirmation.
 * It is an expected failure, so it is logged at `warn`, not `error`.
 */
function createCancelledError_(): GasError {
  return new GasError(tr_('error.cancelled'), { statusCode: 409 });
}

/**
 * Extracts a user-facing message from any thrown value.
 * @param err Thrown value.
 */
function getErrorMessage_(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Whether an error is a script lock wait timeout, as thrown by `LockService`
 * through gas-lock and gas-sheetdb, which do not wrap it in a typed error.
 * @param err Thrown value.
 */
function isLockTimeoutError_(err: unknown): boolean {
  return (
    /lock/i.test(getErrorMessage_(err)) &&
    /timeout|timed out|obtain/i.test(getErrorMessage_(err))
  );
}

/**
 * Runs a menu action. A failure is logged through `GasError.handle`, shown as
 * an error toast, and rethrown so Apps Script records the execution as failed.
 * A lock timeout means a synchronization is running: it is shown as a warning
 * and not rethrown.
 * @param logger Logger of the calling module.
 * @param action Action to run.
 */
function runMenuAction_(logger: GasLogger, action: () => void): void {
  try {
    action();
  } catch (err) {
    if (isLockTimeoutError_(err)) {
      logger.warn('Menu action skipped: the script lock is busy', {
        error: getErrorMessage_(err),
      });
      Toast.warning(tr_('error.syncRunning'));
      return;
    }
    GasError.handle(err, { logger, rethrow: false, method: 'menu' });
    Toast.error(getErrorMessage_(err));
    throw err;
  }
}
