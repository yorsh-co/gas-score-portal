const AppConfig = {
  appName: Config.data.appsScript.webappTitle,

  html: {
    basePaths: {
      assets: 'web/legacy-client/assets',
      css: 'web/legacy-client/assets/css',
      js: 'web/legacy-client/assets/js',
      components: 'web/legacy-client/components',
      layouts: 'web/legacy-client/layouts',
      partials: 'web/legacy-client/partials',
      views: 'web/legacy-client/views',
    },

    defaultLayout: 'main',

    favicon: Config.data.appsScript.faviconUrl,
  },
};
