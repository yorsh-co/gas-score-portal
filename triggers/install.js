/**
 *
 */
const installTriggers = () => {
  // Install ScoreSync trigger.
  TriggerUtils.installTimedMinutes('timedSyncScores', 30);
};
