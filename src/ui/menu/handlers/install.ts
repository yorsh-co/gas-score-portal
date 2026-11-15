const installMenuLogger = createModuleLogger_('menu.install');

/** Pause that lets the user read a toast before the next one replaces it. */
const TOAST_PAUSE_MS = 1000;
/** Pause between the uninstall steps. */
const UNINSTALL_PAUSE_MS = 2000;

/**
 * Requests authorization if needed, installs the triggers and sets the
 * spreadsheet time zone.
 * @throws {GasForbiddenError} When the caller does not run the script with
 * their own authority.
 */
function menuInstall(): void {
  runMenuAction_(installMenuLogger, () => {
    assertCallerEffectiveUser_();
    if (
      ScriptApp.getAuthorizationInfo(
        ScriptApp.AuthMode.FULL,
      ).getAuthorizationStatus() === ScriptApp.AuthorizationStatus.REQUIRED
    ) {
      ScriptApp.invalidateAuth();
      installMenuLogger.info('Prompting for required authorization');
      ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
    }

    Toast.busy(tr_('install.installing'));
    installTriggers_();

    Toast.busy(tr_('install.triggersInstalled'));
    Utilities.sleep(TOAST_PAUSE_MS);

    const timeZone = Session.getScriptTimeZone();
    SpreadsheetApp.getActiveSpreadsheet().setSpreadsheetTimeZone(timeZone);
    Toast.busy(
      tr_('install.timeZoneBody'),
      tr_('install.timeZoneTitle', { timeZone }),
    );
    Utilities.sleep(TOAST_PAUSE_MS);

    Toast.busy(tr_('install.creatingOverview'));
    refreshOverview_();

    Toast.success(tr_('install.installed'));
  });
}

/**
 * Removes every trigger and all stored script properties.
 * @throws {GasForbiddenError} When the caller does not run the script with
 * their own authority.
 */
function menuUninstall(): void {
  runMenuAction_(installMenuLogger, () => {
    assertCallerEffectiveUser_();
    const ui = SpreadsheetApp.getUi();
    const confirmation = ui.alert(
      tr_('uninstall.title'),
      tr_('uninstall.body'),
      ui.ButtonSet.OK_CANCEL,
    );
    if (confirmation !== ui.Button.OK) throw createCancelledError_();

    Toast.warning(
      tr_('uninstall.removingTriggers'),
      tr_('uninstall.toastTitle'),
    );
    ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
    Utilities.sleep(UNINSTALL_PAUSE_MS);

    Toast.warning(
      tr_('uninstall.deletingProperties'),
      tr_('uninstall.toastTitle'),
    );
    PropertiesService.getScriptProperties().deleteAllProperties();
    Utilities.sleep(UNINSTALL_PAUSE_MS);

    Toast.warning('', tr_('uninstall.complete'));
  });
}

/**
 * Clears the data tables and revokes the script permissions.
 * @throws {GasForbiddenError} When the caller does not run the script with
 * their own authority.
 */
function menuSystemReset(): void {
  runMenuAction_(installMenuLogger, () => {
    assertCallerEffectiveUser_();
    const ui = SpreadsheetApp.getUi();
    const selectedButton = ui.alert(
      tr_('reset.title'),
      tr_('reset.body'),
      ui.ButtonSet.OK_CANCEL,
    );
    if (selectedButton !== ui.Button.OK) throw createCancelledError_();

    Toast.busy(tr_('reset.resetting'));
    GasLock.withLock('script', () => {
      for (const table of [
        getScoresTable_(),
        getRespondentsTable_(),
        getFormsTable_(),
      ])
        table.deleteWhere(() => true);
      FormsCursor.deleteTrailing('cursor:', '');
      TriggerUtils.deleteContinuations(CONTINUATION_HANDLER);
    });

    ScriptApp.invalidateAuth();

    Toast.success();
  });
}
