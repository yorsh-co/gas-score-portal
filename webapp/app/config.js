const AppConfig = {
  appName: Config.data.appsScript.webappTitle,

  html: {
    basePaths: {
      assets: 'webapp/client/assets',
      css: 'webapp/client/assets/css',
      js: 'webapp/client/assets/js',
      components: 'webapp/client/components',
      layouts: 'webapp/client/layouts',
      partials: 'webapp/client/partials',
      views: 'webapp/client/views',
    },

    defaultLayout: 'main',

    favicon: Config.data.appsScript.faviconUrl,
  },
};
