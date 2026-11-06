/**
 *
 */
const menuInstall = () => {
  try {
    if (
      ScriptApp.getAuthorizationInfo(
        ScriptApp.AuthMode.FULL,
      ).getAuthorizationStatus() === ScriptApp.AuthorizationStatus.REQUIRED
    ) {
      ScriptApp.invalidateAuth();
      Logger.log('Prompting for required authorization');
      ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
    }

    Toast.busy('Instalando o Script');
    Config.loadFromSheet();

    // Triggers.
    Config.triggers.install();
    installTriggers();

    // Configurations.
    Toast.busy(
      'Os acionadores foram instalados. Verificando as configurações...',
    );
    Utilities.sleep(1 * 1000);
    Config.load();

    // Timezone.
    SS.setSpreadsheetTimeZone(Session.getScriptTimeZone());
    Toast.busy(
      'Acesse o editor do Apps Script para alterar',
      `Fuso horário configurado para ${Session.getScriptTimeZone()}`,
    );
    Utilities.sleep(1 * 1000);

    // WebApp.
    Toast.loading('Publicando o WebApp');
    PropertiesService.getUserProperties().deleteProperty(`tokens:${ScriptApp.getScriptId()}`);
    WebAppDeployer.create();
    Toast.success('WebApp publicado');

    // Display a popup confirmation
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      '✅ Instalação Concluída',
      `O WebApp foi publicado e pode ser acessado no link abaixo:\n\n${Config.data.appsScript.webappUrl}`,
      ui.ButtonSet.OK,
    );

    Toast.success('O Script foi instalado');
  } catch (err) {
    Toast.error(err);
    throw new Error(
      err.toString().includes(':') ? err.toString().split(':')[1] : err,
    );
  }
};

/**
 *
 */
const menuUninstall = () => {
  try {
    // Confirm.
    const ui = SpreadsheetApp.getUi();
    const confirmation = ui.alert(
      '⚠️ Uninstall',
      'This will remove all triggers and delete all stored values like API keys and configuration values.\n\nThis action can only be reversed by re-installing the script from the menu.\n\n🆗 Click OK to uninstall.',
      ui.ButtonSet.OK_CANCEL,
    );
    if (confirmation !== ui.Button.OK) throw new Error('Cancelled by the user');

    // Delete triggers
    Toast.warning('Removing triggers', 'Uninstalling');
    ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));

    Utilities.sleep(2 * 1000);

    // Clear script properties.
    Toast.warning(
      'Deleting stored properties and configurations',
      'Uninstalling',
    );
    PropertiesService.getScriptProperties().deleteAllProperties();

    Utilities.sleep(2 * 1000);

    Toast.warning('', 'Uninstall complete');
  } catch (error) {
    Toast.error(error);
    throw new Error(
      err.toString().includes(':') ? err.toString().split(':')[1] : err,
    );
  }
};

/**
 *
 */
const menuSystemReset = () => {
  try {
    // Confirm.
    const ui = SpreadsheetApp.getUi();
    const selectedButton = ui.alert(
      '⛔ Reset do Sistema',
      `⚠️ Zona de perigo!\n\nTodos os Forms e as Notas serão removidos do sistema. Além disso, o WebApp e suas permissões serão revertidos. Para reinicar o sistema, você deverá seguir todas as etapas de instalação, após o reset.\n\n👉 Clique em OK para continuar.`,
      ui.ButtonSet.OK_CANCEL,
    );
    if (selectedButton !== ui.Button.OK)
      throw new Error('Cancelado pelo usuário');

    Config.loadFromSheet();

    // Check for the template sheets.
    const missing = SHEETS.templates.filter(
      (sheetName) => !SS.getSheetByName(sheetName),
    );
    if (missing.length)
      throw new Error(
        `Abas de reset não encontradas: ${JSON.stringify(missing)}`,
      );

    // Reset the sheets.
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
      const newSheet = SS.getSheetByName(sheetName)
        .copyTo(SS)
        .setName(sheetName.replace('TEMPLATE', '').trim());
      SS.setActiveSheet(newSheet);
      SS.moveActiveSheet(i + 1);
    });
    SS.deleteSheet(tempSheet);
    Config.loadFromSheet();

    // Reset the apps script webapp.
    try {
      WebAppDeployer.reset();
    } catch (err) {
      console.error(err);
    }

    // Revoke permissions.
    ScriptApp.invalidateAuth();
    Config.data.appsScript.authStatus = 'Revocado';
    Config.save();

    Toast.success();
  } catch (err) {
    console.error(err);
    Toast.error(err);
    throw new Error(err);
  }
};
