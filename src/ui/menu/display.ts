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
    .createMenu('⚙️ Configurações')
    .addItem('🛠️ Abrir as configurações', 'menuSettings')
    .addSeparator()
    .addItem('💽 Instalar o Script', 'menuInstall')
    .addItem('💿 Desinstalar o Script', 'menuUninstall')
    .addSeparator()
    .addItem('⛔ Reset do Sistema', 'menuSystemReset');

  const formsMenu = ui
    .createMenu('🟪 Forms')
    .addItem('✔️ Importar do Drive', 'menuImportDriveForms')
    .addItem('➕ Adicionar Forms individual', 'menuLinkNewForm')
    .addItem('➖ Remover Forms selecionado(s)', 'menuRemoveForms');

  ui.createMenu('🔶 Sistema de Notas')
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
