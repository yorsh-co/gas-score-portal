/**
 *
 */
const menuDeploy = () => {
  try {
    // Update an existing deployment.
    if (Config.data.appsScript.deploymentId) {
      Toast.loading('Atualizando o WebApp');
      WebAppDeployer.update();
      Toast.success('WebApp atualizado');

      const ui = SpreadsheetApp.getUi();
      ui.alert(
        '📲 WebApp Atualizado',
        `O WebApp foi atualizado e pode ser acessado no link abaixo:\n\n${Config.data.appsScript.webappUrl}`,
        ui.ButtonSet.OK,
      );
    }
    // Create a webapp deployment.
    else {
      Toast.loading('Publicando o WebApp');
      WebAppDeployer.create();
      Toast.success('WebApp publicado');

      const ui = SpreadsheetApp.getUi();
      ui.alert(
        '📲 WebApp Publicado',
        `O WebApp foi publicado e pode ser acessado no link abaixo:\n\n${Config.data.appsScript.webappUrl}`,
        ui.ButtonSet.OK,
      );
    }
  } catch (err) {
    Toast.error(err);
    throw new Error(err);
  }
};
