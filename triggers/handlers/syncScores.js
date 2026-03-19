/**
 *
 * @param {GoogleAppsScript.Events.TimeDriven} e
 */
const timedSyncScores = (e) => {
  ExecutionLock().releaseAll();

  try {
    new FormsImporter().run();
  } catch (err) {
    console.error('Forms importer failed', err);
  }

  const cursor = FormsCursor.initialize();
  new RespondentScoreSynchronizer(cursor).run();
};

/**
 *
 * @param {GoogleAppsScript.Events.TimeDriven} e
 */
const continueSyncScores = (e) => {
  const triggerId = e.triggerUid;
  TriggerUtils.deleteDisabled();

  const cursorKey = CacheUtil.get(triggerId, true);
  if (!cursorKey)
    throw new Error(`Failed to retrieve cursor key from script properties`);

  const cursor = FormsCursor.load(cursorKey);
  if (!cursor)
    throw new Error(`Failed to retrieve cursor from script properties`);

  new RespondentScoreSynchronizer(cursor).run();
};
