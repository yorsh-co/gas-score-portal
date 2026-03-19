/**
 * @module TriggerUtils
 * Utility functions for installing and managing project triggers in Apps Script.
 */
const TriggerUtils = (() => {
  /**
   * Installs a time-based trigger to run every N minutes.
   * Deletes existing trigger with same handler before creating a new one.
   * @param {string} handler - Function name to run.
   * @param {number} intervalMins - Interval in minutes.
   */
  const installTimedMinutes = (handler, intervalMins) => {
    deleteTrigger(handler);
    ScriptApp.newTrigger(handler)
      .timeBased()
      .everyMinutes(intervalMins)
      .create();
    Logger.log(
      'Installed time-based trigger for `%s` to run every %s minutes',
      handler,
      intervalMins,
    );
  };

  /**
   * Installs an onEdit trigger for the active spreadsheet.
   * Deletes existing trigger with same handler before creating a new one.
   * @param {string} handler - Function name to run.
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} [ss=SS] - Spreadsheet instance (defaults to global SS).
   */
  const installOnEdit = (handler, ss = SS) => {
    deleteTrigger(handler);
    ScriptApp.newTrigger(handler).forSpreadsheet(ss).onEdit().create();
    Logger.log('Installed onEdit trigger for `%s`', handler);
  };

  /**
   * Installs an onOpen trigger for the active spreadsheet.
   * Deletes existing trigger with same handler before creating a new one.
   * @param {string} handler - Function name to run.
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} [ss=SS] - Spreadsheet instance (defaults to global SS).
   */
  const installOnOpen = (handler, ss = SS) => {
    deleteTrigger(handler);
    ScriptApp.newTrigger(handler).forSpreadsheet(ss).onOpen().create();
    Logger.log('Installed onOpen trigger for `%s`', handler);
  };

  /**
   * Installs an onFormSubmit trigger for the provided form.
   * Deletes existing trigger with same handler before creating a new one.
   * @param {String} handler
   * @param {GoogleAppsScript.Forms.Form} form
   */
  const installOnFormSubmit = (handler, form) => {
    deleteTrigger(handler);
    ScriptApp.newTrigger(handler).forForm(form).onFormSubmit().create();
    Logger.log(
      'Installed onFormSubmit trigger `%s` for form %s',
      handler,
      form.getId(),
    );
  };

  /**
   * Deletes all triggers matching the given handler function name.
   * @param {string} handler - Function name to delete triggers for.
   */
  const deleteTrigger = (handler) => {
    ScriptApp.getProjectTriggers().forEach(
      (t) => t.getHandlerFunction() === handler && ScriptApp.deleteTrigger(t),
    );
  };

  /**
   * Deletes all disabled triggers.
   */
  const deleteDisabled = () => {
    ScriptApp.getProjectTriggers().forEach(
      (t) => t.isDisabled() && ScriptApp.deleteTrigger(t),
    );
  };

  /**
   * Creates a continuation trigger that fires once after the specified interval.
   * Stores data in cache with trigger ID for retrieval when the trigger executes.
   * @param {String} handler - Function name to run.
   * @param {Object} options
   * @param {Number} options.interval - Delay in milliseconds.
   * @param {String} options.dataString - Data to store.
   *
   * @returns {String} - Return the trigger UID.
   */
  const createContinuation = (
    handler,
    { interval = 1, dataString = null } = {},
  ) => {
    // Clean up disabled triggers
    deleteDisabled();

    const trigger = ScriptApp.newTrigger(handler)
      .timeBased()
      .after(interval)
      .create();

    const triggerId = trigger.getUniqueId();
    if (dataString) CacheUtil.add(triggerId, dataString);

    Logger.log(
      'Continuation trigger set for `%s` after %s ms. ID %s',
      handler,
      interval,
      triggerId,
    );

    return triggerId;
  };

  return {
    installTimedMinutes,
    installOnEdit,
    installOnOpen,
    installOnFormSubmit,
    deleteTrigger,
    deleteDisabled,
    createContinuation,
  };
})();
