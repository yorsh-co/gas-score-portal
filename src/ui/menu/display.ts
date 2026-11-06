/**
 * Adds the custom menu when the spreadsheet opens.
 */
function onOpen(): void {
  displayMenu();
}

/**
 * Builds the custom menu.
 */
function displayMenu(): void {
  const ui = SpreadsheetApp.getUi();

  const settingsMenu = ui
    .createMenu(tr('menu.settings'))
    .addItem(tr('menu.openSettings'), 'menuSettings')
    .addSeparator()
    .addItem(tr('menu.install'), 'menuInstall')
    .addItem(tr('menu.uninstall'), 'menuUninstall')
    .addSeparator()
    .addItem(tr('menu.systemReset'), 'menuSystemReset');

  const formsMenu = ui
    .createMenu(tr('menu.forms'))
    .addItem(tr('menu.importDrive'), 'menuImportDriveForms')
    .addItem(tr('menu.linkForm'), 'menuLinkNewForm')
    .addItem(tr('menu.removeForms'), 'menuRemoveForms');

  ui.createMenu(tr('menu.root'))
    .addSubMenu(formsMenu)
    .addSubMenu(settingsMenu)
    .addToUi();

  createModuleLogger('menu').info('Custom menu added to the UI');
}

/**
 * Opens the settings dialog.
 */
function menuSettings(): void {
  getConfig().showDialog(SpreadsheetApp.getUi());
}
