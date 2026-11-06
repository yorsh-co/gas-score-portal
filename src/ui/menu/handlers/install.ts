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
    SS.setSpreadsheetTimeZone(timeZone);
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
 * Restores the template sheets and revokes the script permissions.
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

    const missing = SHEETS.templates.filter(
      (sheetName) => !SS.getSheetByName(sheetName),
    );
    if (missing.length)
      throw new GasNotFoundError(
        `Abas de reset não encontradas: ${JSON.stringify(missing)}`,
      );

    Toast.busy('Resetando...');
    const tempSheet = SS.insertSheet().setName('Resetando...');
    SpreadsheetApp.flush();

    SS.getSheets().forEach((sheet) => {
      const sheetName = sheet.getName();
      if (
        !SHEETS.templates.includes(sheetName) &&
        sheetName !== tempSheet.getName()
      ) {
        SS.deleteSheet(sheet);
      }
    });

    SHEETS.templates.forEach((sheetName, i) => {
      const template = SS.getSheetByName(sheetName);
      if (!template) return;
      const newSheet = template
        .copyTo(SS)
        .setName(sheetName.replace('TEMPLATE', '').trim());
      SS.setActiveSheet(newSheet);
      SS.moveActiveSheet(i + 1);
    });
    SS.deleteSheet(tempSheet);

    ScriptApp.invalidateAuth();

    Toast.success();
  });
}
