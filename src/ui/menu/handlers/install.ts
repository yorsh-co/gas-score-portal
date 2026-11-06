const installMenuLogger = createModuleLogger('menu.install');

/** Pause that lets the user read a toast before the next one replaces it. */
const TOAST_PAUSE_MS = 1000;
/** Pause between the uninstall steps. */
const UNINSTALL_PAUSE_MS = 2000;

/**
 * Requests authorization if needed, installs the triggers and sets the
 * spreadsheet time zone.
 */
function menuInstall(): void {
  runMenuAction(installMenuLogger, () => {
    if (
      ScriptApp.getAuthorizationInfo(
        ScriptApp.AuthMode.FULL,
      ).getAuthorizationStatus() === ScriptApp.AuthorizationStatus.REQUIRED
    ) {
      ScriptApp.invalidateAuth();
      installMenuLogger.info('Prompting for required authorization');
      ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
    }

    Toast.busy('Instalando o Script');
    installTriggers();

    Toast.busy('Os acionadores foram instalados.');
    Utilities.sleep(TOAST_PAUSE_MS);

    const timeZone = Session.getScriptTimeZone();
    SpreadsheetApp.getActiveSpreadsheet().setSpreadsheetTimeZone(timeZone);
    Toast.busy(
      'Acesse o editor do Apps Script para alterar',
      `Fuso horário configurado para ${timeZone}`,
    );
    Utilities.sleep(TOAST_PAUSE_MS);

    Toast.success('O Script foi instalado');
  });
}

/**
 * Removes every trigger and all stored script properties.
 */
function menuUninstall(): void {
  runMenuAction(installMenuLogger, () => {
    const ui = SpreadsheetApp.getUi();
    const confirmation = ui.alert(
      '⚠️ Uninstall',
      'This will remove all triggers and delete all stored values like API keys and configuration values.\n\nThis action can only be reversed by re-installing the script from the menu.\n\n🆗 Click OK to uninstall.',
      ui.ButtonSet.OK_CANCEL,
    );
    if (confirmation !== ui.Button.OK) throw createCancelledError();

    Toast.warning('Removing triggers', 'Uninstalling');
    ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
    Utilities.sleep(UNINSTALL_PAUSE_MS);

    Toast.warning(
      'Deleting stored properties and configurations',
      'Uninstalling',
    );
    PropertiesService.getScriptProperties().deleteAllProperties();
    Utilities.sleep(UNINSTALL_PAUSE_MS);

    Toast.warning('', 'Uninstall complete');
  });
}

/**
 * Clears the data tables and revokes the script permissions.
 */
function menuSystemReset(): void {
  runMenuAction(installMenuLogger, () => {
    const ui = SpreadsheetApp.getUi();
    const selectedButton = ui.alert(
      '⛔ Reset do Sistema',
      `⚠️ Zona de perigo!\n\nTodos os Forms e as Notas serão removidos do sistema. Além disso, as permissões do script serão revertidas. Para reinicar o sistema, você deverá seguir todas as etapas de instalação, após o reset.\n\n👉 Clique em OK para continuar.`,
      ui.ButtonSet.OK_CANCEL,
    );
    if (selectedButton !== ui.Button.OK) throw createCancelledError();

    Toast.busy('Resetando...');
    GasLock.withLock('script', () => {
      for (const table of [
        getScoresTable(),
        getRespondentsTable(),
        getFormsTable(),
      ])
        table.deleteWhere(() => true);
      FormsCursor.deleteTrailing('cursor:', '');
      TriggerUtils.deleteContinuations(CONTINUATION_HANDLER);
    });

    ScriptApp.invalidateAuth();

    Toast.success();
  });
}
