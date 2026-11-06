const WebAppDeployer = (() => {
  const scriptId = ScriptApp.getScriptId();

  const client_ = {
    key_: `tokens:${scriptId}`,
    load() {
      const raw =
        PropertiesService.getUserProperties().getProperty(this.key_) || '';
      let tokens = {};
      if (raw) {
        try {
          tokens = JSON.parse(raw);
        } catch (err) {
          console.error(err);
        }
      }
      return {
        tokens,
        user: Session.getEffectiveUser().getEmail(),
        state: Utilities.getUuid(),
      };
    },
    storeTokens(tokens) {
      PropertiesService.getUserProperties().setProperty(
        this.key_,
        JSON.stringify(tokens),
      );
    },
  };

  const withAuth_ = (operation) => {
    const client = client_.load();

    const api = AppsScript.api(client);

    const { tokens, error, ...result } = operation(api);
    console.error('returned', tokens, error, result);
    if (tokens) client_.storeTokens(tokens);
    console.error('LOADED', client_.load());

    if (error) throw new Error(error);

    return result;
  };

  /**
   *
   * @param {string} entryPointType
   *
   * @returns {DeploymentResponse}
   */
  const create = (entryPointType = 'WEB_APP') => {
    // Create a version.
    const { version } = withAuth_((api) =>
      api.projects.versions.create(scriptId, {
        description: 'Webapp version',
      }),
    );

    // Deploy the webapp.
    const { deployment } = withAuth_((api) =>
      api.projects.deployments.create(scriptId, version, {
        description: 'Initial deployment',
      }),
    );
    Logger.log(JSON.stringify(deployment));

    // Save the deployment details.
    Config.data.appsScript.versionNumber =
      deployment.deploymentConfig.versionNumber;
    Config.data.appsScript.deploymentId = deployment.deploymentId;

    const entryPoint = deployment.entryPoints.find(
      (entryPoint) => entryPoint.entryPointType === entryPointType,
    );
    Config.data.appsScript.webappUrl =
      entryPoint.webApp.url +
      (Config.data.appsScript.entryRoute
        ? `?route=${Config.data.appsScript.entryRoute}`
        : '');
    Config.save();

    return deployment;
  };

  /**
   *
   * @param {string} deploymentId
   * @param {string} entryPointType
   *
   * @returns {DeploymentResponse}
   */
  const update = (
    deploymentId = Config.data.appsScript.deploymentId,
    entryPointType = 'WEB_APP',
  ) => {
    if (!deploymentId) throw new Error('deploymentId is required');

    // Create a version.
    const { version } = withAuth_((api) =>
      api.projects.versions.create(scriptId, {
        description: 'Update',
      }),
    );
    console.error('version created!');

    // Update the deployment.
    const { deployment } = withAuth_((api) =>
      api.projects.deployments.update(scriptId, deploymentId, version),
    );

    // Save the deployment details.
    Config.data.appsScript.versionNumber =
      deployment.deploymentConfig.versionNumber;
    const entryPoint = deployment.entryPoints.find(
      (entryPoint) => entryPoint.entryPointType === entryPointType,
    );
    Config.data.appsScript.webappUrl =
      entryPoint.webApp.url +
      (Config.data.appsScript.entryRoute
        ? `?route=${Config.data.appsScript.entryRoute}`
        : '');
    Config.save();

    return deployment;
  };

  /**
   *
   */
  const reset = () => {
    // Delete the deployments.
    const { deployments } = withAuth_((api) =>
      api.projects.deployments.list(scriptId),
    );
    for (const deployment of deployments)
      withAuth_((api) =>
        api.projects.deployments.delete(scriptId, deployment.deploymentId),
      );
    Logger.log('Deleted all deployments');
  };

  /**
   *
   */
  const clean = () => {
    // Delete the extra deployments.
    const { deployments } = withAuth_((api) =>
      api.projects.deployments.list(scriptId),
    );
    for (const deployment of deployments) {
      if (deployment.deploymentId !== Config.data.appsScript.deploymentId)
        withAuth_((api) =>
          api.projects.deployments.delete(scriptId, deployment.deploymentId),
        );
    }
    Logger.log('Deleted all deployments except for current');
  };

  return {
    create,
    update,
    reset,
    clean,
  };
})();
