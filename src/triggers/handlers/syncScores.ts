/**
 * Scheduled run: imports new Forms, then starts a score synchronization. One
 * timer, started here, bounds both steps.
 */
function timedSyncScores(): void {
  const logger = createModuleLogger('trigger.sync');
  const timer = createSyncTimer();
  try {
    new FormsImporter({ timer }).run();
  } catch (err) {
    GasError.handle(err, { logger, rethrow: false, method: 'forms-importer' });
  }

  new RespondentScoreSynchronizer(
    FormsCursor.initialize(),
    createSyncDeps(timer),
  ).run();
}

/**
 * Continuation run: resumes the synchronization from the saved cursor.
 * @param e Trigger event.
 */
function continueSyncScores(e: GoogleAppsScript.Events.TimeDriven): void {
  const logger = createModuleLogger('trigger.sync');
  const timer = createSyncTimer();
  const cursorKey = TriggerUtils.consumeContinuation(e.triggerUid);
  TriggerUtils.deleteDisabled();

  const cursor = cursorKey ? FormsCursor.load(cursorKey) : undefined;
  if (!cursor) {
    logger.info('No cursor to resume, skipping', { triggerId: e.triggerUid });
    return;
  }

  new RespondentScoreSynchronizer(cursor, createSyncDeps(timer)).run();
}
