/** Interval of the scheduled synchronization, in minutes. */
const SYNC_INTERVAL_MINUTES = 30;

/**
 * Installs the project triggers.
 * @throws {GasForbiddenError} When the caller does not run the script with
 *   their own authority.
 */
function installTriggers(): void {
  if (!isCallerEffectiveUser()) throw new GasForbiddenError();
  TriggerUtils.installTimedMinutes('timedSyncScores', SYNC_INTERVAL_MINUTES);
}
