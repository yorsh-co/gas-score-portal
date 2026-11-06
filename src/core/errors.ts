/** Message of the error thrown when the user dismisses a confirmation. */
const CANCELLED_BY_USER_MESSAGE = 'Cancelado pelo usuário';

/**
 * Creates the error thrown when the user cancels a prompt or confirmation.
 * It is an expected failure, so it is logged at `warn`, not `error`.
 */
function createCancelledError(): GasError {
  return new GasError(CANCELLED_BY_USER_MESSAGE, { statusCode: 409 });
}

/**
 * Extracts a user-facing message from any thrown value.
 * @param err Thrown value.
 */
function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Whether an error is a script lock wait timeout, as thrown by `LockService`
 * through gas-lock and gas-sheetdb, which do not wrap it in a typed error.
 * @param err Thrown value.
 */
function isLockTimeoutError(err: unknown): boolean {
  return (
    /lock/i.test(getErrorMessage(err)) &&
    /timeout|timed out|obtain/i.test(getErrorMessage(err))
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
function runMenuAction(logger: GasLogger, action: () => void): void {
  try {
    action();
  } catch (err) {
    if (isLockTimeoutError(err)) {
      logger.warn('Menu action skipped: the script lock is busy', {
        error: getErrorMessage(err),
      });
      Toast.warning(
        'Há uma sincronização em andamento. Tente novamente em instantes.',
      );
      return;
    }
    GasError.handle(err, { logger, rethrow: false, method: 'menu' });
    Toast.error(getErrorMessage(err));
    throw err;
  }
}
