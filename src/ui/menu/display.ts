/**
 * Adds the custom menu when the spreadsheet opens. It has no caller guard: as
 * a simple trigger it can run with a blank active user, which a guard would
 * refuse, and from the web app `SpreadsheetApp.getUi` fails before any side
 * effect.
 */
function onOpen(): void {
  displayMenu_();
}

/**
 * Builds the custom menu.
 */
function displayMenu_(): void {
  const ui = SpreadsheetApp.getUi();

  const settingsMenu = ui
    .createMenu(tr_('menu.settings'))
    .addItem(tr_('menu.openSettings'), 'menuSettings')
    .addSeparator()
    .addItem(tr_('menu.install'), 'menuInstall')
    .addItem(tr_('menu.uninstall'), 'menuUninstall')
    .addSeparator()
    .addItem(tr_('menu.systemReset'), 'menuSystemReset');

  const formsMenu = ui
    .createMenu(tr_('menu.forms'))
    .addItem(tr_('menu.importDrive'), 'menuImportDriveForms')
    .addItem(tr_('menu.linkForm'), 'menuLinkNewForm')
    .addItem(tr_('menu.removeForms'), 'menuRemoveForms');

  ui.createMenu(tr_('menu.root'))
    .addSubMenu(formsMenu)
    .addSubMenu(settingsMenu)
    .addToUi();

  createModuleLogger_('menu').info('Custom menu added to the UI');
}

/**
 * Opens the settings dialog.
 * @throws {GasForbiddenError} When the caller does not run the script with
 * their own authority.
 */
function menuSettings(): void {
  assertCallerEffectiveUser_();
  getConfig_().showDialog(SpreadsheetApp.getUi());
}
