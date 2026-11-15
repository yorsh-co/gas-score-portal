/**
 * Scheduled run: imports new Forms, then starts a score synchronization. One
 * timer, started here, bounds both steps. Runs only from its own trigger or
 * for a caller with their own authority, such as a run from the editor.
 * @param e Trigger event; absent on a manual run.
 */
function timedSyncScores(e?: GoogleAppsScript.Events.TimeDriven): void {
  const logger = createModuleLogger('trigger.sync');
  const timer = createSyncTimer();
  if (
    !TriggerUtils.isProjectTrigger(e?.triggerUid, 'timedSyncScores') &&
    !isCallerEffectiveUser_()
  ) {
    logger.warn('Ignored a call that is not from the trigger or the user');
    return;
  }

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
 * Continuation run: resumes the synchronization from the saved cursor. Runs
 * only from a continuation trigger of this project.
 * @param e Trigger event.
 */
function continueSyncScores(e: GoogleAppsScript.Events.TimeDriven): void {
  const logger = createModuleLogger('trigger.sync');
  const timer = createSyncTimer();
  if (!TriggerUtils.isProjectTrigger(e?.triggerUid, CONTINUATION_HANDLER)) {
    logger.warn('Ignored a call that is not from a continuation trigger');
    return;
  }

  const cursorKey = TriggerUtils.consumeContinuation(e.triggerUid);
  TriggerUtils.deleteDisabled();

  const cursor = cursorKey ? FormsCursor.load(cursorKey) : undefined;
  if (!cursor) {
    logger.info('No cursor to resume, skipping', { triggerId: e.triggerUid });
    return;
  }

  new RespondentScoreSynchronizer(cursor, createSyncDeps(timer)).run();
}
