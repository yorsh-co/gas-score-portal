const HtmlResponse = (() => {
  const basePaths = {
    views: 'webapp/client/views',
    layouts: 'webapp/client/layouts',
  };
  const resolveView = (view) => {
    if (view.startsWith('webapp/')) return view;

    if (!view.endsWith('.html')) {
      return `${basePaths.views}/${view}.html`;
    }

    return `${basePaths.views}/${view}`;
  };

  const resolveLayout = (layout) => {
    if (layout === false) return null;

    if (!layout) return `${basePaths.layouts}/main.html`;

    if (layout.startsWith('webapp/')) return layout;

    if (!layout.endsWith('.html')) {
      return `${basePaths.layouts}/${layout}.html`;
    }

    return `${basePaths.layouts}/${layout}`;
  };

  const render = (view, locals = {}, options = {}) => {
    // render cache
    const included = new Set();

    const includeOnce = (path) => {
      if (included.has(path)) return '';
      included.add(path);
      return HtmlService.createHtmlOutputFromFile(path).getContent();
    };

    // escape html
    const escapeHtml = (str) => {
      if (str === null || str === undefined) return '';

      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    // safe helpers
    const safeHelpers = {
      $e: (value) => escapeHtml(value), // force escape
      $raw: (value) => value ?? '', // explicitly unsafe
    };

    // include system
    const include = {
      raw: (path) => includeOnce(path),
      asset: (type, name) =>
        includeOnce(
          `webapp/client/assets/${type}/${name.replace(/^\//, '')}.${type}.html`,
        ),
      css: (name) =>
        includeOnce(
          `webapp/client/assets/css/${name.replace(/^\//, '')}.css.html`,
        ),
      js: (name) =>
        includeOnce(
          `webapp/client/assets/js/${name.replace(/^\//, '')}.js.html`,
        ),
      partial: (name, data = {}, parentLocals = {}) => {
        const template = HtmlService.createTemplateFromFile(
          `webapp/client/partials/${name.replace(/^\//, '')}.html`,
        );
        Object.assign(template, {
          locals: {
            ...parentLocals,
            ...data,
          },
          ...parentLocals,
          ...data,
          include,
          ...safeHelpers,
        });
        return template.evaluate().getContent();
      },
      component: (name, props = {}, parentLocals = {}) => {
        const template = HtmlService.createTemplateFromFile(
          `webapp/client/components/${name.replace(/^\//, '')}`,
        );

        const { children, slots = {}, ...rest } = props;

        Object.assign(template, {
          locals: {
            ...parentLocals,
            ...rest,
            children,
            slots,
          },
          ...parentLocals,
          ...rest,
          children,
          slots,
          include,
          ...safeHelpers,
        });

        return template.evaluate().getContent();
      },
    };

    // render view
    const viewPath = resolveView(view);
    const viewTemplate = HtmlService.createTemplateFromFile(viewPath);

    Object.assign(viewTemplate, {
      ...locals,
      include: {
        ...include,
        partial: (name, data = {}) => include.partial(name, data, locals),
        component: (name, props = {}) => include.component(name, props, locals),
      },

      // shortcuts
      $partial: (name, data = {}) => include.partial(name, data, locals),
      $component: (name, props = {}) => include.component(name, props, locals),
      $css: include.css,
      $js: include.js,

      //safety
      ...safeHelpers,
    });

    const body = viewTemplate.evaluate().getContent();

    // render layout
    const layoutPath = resolveLayout(options.layout || locals.layout);
    if (!layoutPath) return HtmlService.createHtmlOutput(body);

    const layoutTemplate = HtmlService.createTemplateFromFile(layoutPath);

    Object.assign(layoutTemplate, {
      ...locals,
      body,
      include: {
        ...include,
        partial: (name, data = {}) => include.partial(name, data, locals),
        component: (name, props = {}) => include.component(name, props, locals),
      },

      // shortcuts
      $partial: (name, data = {}) => include.partial(name, data, locals),
      $component: (name, props = {}) => include.component(name, props, locals),
      $css: include.css,
      $js: include.js,

      // safety
      ...safeHelpers,
    });

    const output = layoutTemplate.evaluate();

    // meta
    const title =
      options.title || locals.pageTitle || Config.data.appsScript.webappTitle;

    if (title) output.setTitle(title);

    const favicon = options.favicon || Config.data.appsScript.faviconUrl;
    if (favicon) output.setFaviconUrl(favicon);

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

  return {
    render,
  };
})();
