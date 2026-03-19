const HtmlResponse = (() => {
  const include = (filename) =>
    HtmlService.createHtmlOutputFromFile(filename).getContent();

  const render = (view, model = {}, options = {}) => {
    const template = HtmlService.createTemplateFromFile(view);

    Object.assign(template, model);
    template.helpers = {
      // Use <?!= helpers.include('...') ?>
      include,
    };

    const output = template.evaluate();

    if (options.title || Config.data.appsScript.webappTitle)
      output.setTitle(options.title || Config.data.appsScript.webappTitle);
    if (options.favicon || Config.data.appsScript.faviconUrl)
      output.setFaviconUrl(
        options.favicon || Config.data.appsScript.faviconUrl,
      );
    return (
      output
        .setSandboxMode(HtmlService.SandboxMode.IFRAME)
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('apple-mobile-web-app-capable', 'no')
        .addMetaTag('mobile-web-app-capable', 'no')
        //.addMetaTag('google-site-verification', '')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    );
  };

  const page = (view, model = {}, options = {}) => render(view, model, options);

  return {
    render,
    page,
  };
})();
