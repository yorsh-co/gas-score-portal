/**
 *
 * @param {*} e
 */
function onOpen(e) {
  displayMenu();
}

/**
 *
 */
const displayMenu = () => {
  const ui = SpreadsheetApp.getUi();

  const settingsMenu = ui
    .createMenu('⚙️ Configurações')
    .addItem('💾 Salvar as configurações', 'menuSaveConfig')
    .addSeparator()
    .addItem('📲 Publicar ou atualizar o WebApp', 'menuDeploy')
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

  Logger.log('Custom menu added to the UI');
};
