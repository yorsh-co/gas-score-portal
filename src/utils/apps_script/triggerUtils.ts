/** Prefix of the Script Property that holds a continuation's data. */
const CONTINUATION_PROPERTY_PREFIX = 'continuation:';

/** Options of `TriggerUtils.createContinuation`. */
interface ContinuationOptions {
  /** Delay in milliseconds. */
  interval?: number;
  /** Data the continuation reads back with `consumeContinuation`. */
  dataString?: string | null;
}

/** Helpers to install and manage the project triggers. */
const TriggerUtils = (() => {
  const triggerLogger = createModuleLogger_('triggers');

  /** Deletes a trigger and the continuation data stored for it. */
  const removeTrigger = (trigger: GoogleAppsScript.Script.Trigger): void => {
    PropertiesService.getScriptProperties().deleteProperty(
      CONTINUATION_PROPERTY_PREFIX + trigger.getUniqueId(),
    );
    ScriptApp.deleteTrigger(trigger);
  };

  /**
   * Deletes every trigger of a handler function.
   * @param handler Handler function name.
   */
  const deleteTrigger = (handler: string): void => {
    ScriptApp.getProjectTriggers().forEach((trigger) => {
      if (trigger.getHandlerFunction() === handler) removeTrigger(trigger);
    });
  };

  /** `isDisabled` exists at runtime but is missing from the type definitions. */
  const isDisabled = (trigger: GoogleAppsScript.Script.Trigger): boolean =>
    (trigger as { isDisabled?: () => boolean }).isDisabled?.() === true;

  /** Deletes the triggers Apps Script disabled. */
  const deleteDisabled = (): void => {
    ScriptApp.getProjectTriggers().forEach((trigger) => {
      if (isDisabled(trigger)) removeTrigger(trigger);
    });
  };

  /**
   * Installs a trigger that runs every N minutes, replacing any trigger of the
   * same handler.
   * @param handler Handler function name.
   * @param intervalMins Interval in minutes.
   */
  const installTimedMinutes = (handler: string, intervalMins: number): void => {
    deleteTrigger(handler);
    ScriptApp.newTrigger(handler)
      .timeBased()
      .everyMinutes(intervalMins)
      .create();
    triggerLogger.info('Installed time-based trigger', {
      handler,
      intervalMins,
    });
  };

  /**
   * Creates a one-off trigger and stores data for it in the cache, keyed by
   * the trigger ID.
   * @param handler Handler function name.
   * @param options Delay and data.
   * @returns The trigger ID.
   */
  const createContinuation = (
    handler: string,
    { interval = 1, dataString = null }: ContinuationOptions = {},
  ): string => {
    deleteDisabled();

    const trigger = ScriptApp.newTrigger(handler)
      .timeBased()
      .after(interval)
      .create();

    const triggerId = trigger.getUniqueId();
    if (dataString)
      PropertiesService.getScriptProperties().setProperty(
        CONTINUATION_PROPERTY_PREFIX + triggerId,
        dataString,
      );

    triggerLogger.info('Continuation trigger set', {
      handler,
      interval,
      triggerId,
    });
    return triggerId;
  };

  /**
   * Reads the data stored for a continuation trigger, then deletes the data
   * and the trigger, which has fired.
   * @param triggerId ID of the trigger that fired.
   * @returns The data, or `null` when none was stored.
   */
  const consumeContinuation = (triggerId: string): string | null => {
    const properties = PropertiesService.getScriptProperties();
    const key = CONTINUATION_PROPERTY_PREFIX + triggerId;
    const data = properties.getProperty(key);
    properties.deleteProperty(key);
    ScriptApp.getProjectTriggers().forEach((trigger) => {
      if (trigger.getUniqueId() === triggerId) ScriptApp.deleteTrigger(trigger);
    });
    return data;
  };

  /**
   * Whether an event comes from a trigger of this project that runs the
   * handler. Handlers reachable through `google.script.run` receive whatever
   * event the caller builds, so they check it before acting on it.
   * @param triggerUid `triggerUid` of the event.
   * @param handler Handler function name.
   */
  const isProjectTrigger = (
    triggerUid: string | undefined,
    handler: string,
  ): boolean =>
    !!triggerUid &&
    ScriptApp.getProjectTriggers().some(
      (trigger) =>
        trigger.getUniqueId() === triggerUid &&
        trigger.getHandlerFunction() === handler,
    );

  /**
   * Deletes the pending triggers of a continuation handler and all stored
   * continuation data.
   * @param handler Handler function name.
   */
  const deleteContinuations = (handler: string): void => {
    deleteTrigger(handler);
    const properties = PropertiesService.getScriptProperties();
    for (const key of properties.getKeys()) {
      if (key.startsWith(CONTINUATION_PROPERTY_PREFIX))
        properties.deleteProperty(key);
    }
  };

  return {
    installTimedMinutes,
    deleteTrigger,
    deleteDisabled,
    createContinuation,
    consumeContinuation,
    isProjectTrigger,
    deleteContinuations,
  };
})();
