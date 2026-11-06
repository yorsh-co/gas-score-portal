/** Interval of the scheduled synchronization, in minutes. */
const SYNC_INTERVAL_MINUTES = 30;

/**
 * Installs the project triggers.
 */
function installTriggers(): void {
  TriggerUtils.installTimedMinutes('timedSyncScores', SYNC_INTERVAL_MINUTES);
}
