/**
 * Main framework entry point for creating an Apps Script WebApp.
 * Wires together router, middleware, routes, and global error handling.
 */
const Framework = (() => {
  /**
   * Creates a new application instance.
   *
   * @param {{
   *   routes: (router: {
   *     get: Function,
   *     post: Function,
   *     use: Function,
   *     group: Function
   *   }) => void,
   *   middleware?: Array<(req: any, res: any, next: Function) => void>,
   *   config?: Object
   * }} options
   *
   * @returns {{
   *   init: () => void,
   *   handle: (
   *     e: GoogleAppsScript.Events.DoGet | GoogleAppsScript.Events.DoPost,
   *     method: string
   *   ) => any
   * }}
   */
  const createApp = ({ routes, middleware = [], config }) => {
    // Apply global HTML config if provided
    if (config) HtmlResponse.setConfig(config);

    /**
     * Internal router instance.
     */
    const router = Router.create();

    /**
     * Initializes middleware, routes, and error handlers.
     * Automatically called on app creation.
     */
    const init = () => {
      // Register global middleware
      (middleware || []).forEach((mw) => router.use(mw));

      // Register routes
      if (typeof routes === 'function') routes(router);

      // Fallback: route not found
      router.use((req, _res, next) => {
        next(HttpError.notFound(`Route not found: ${req.route}`));
      });

      // Global error handler (must be last)
      router.use(ErrorHandler.handleError);
    };

    // Initialize immediately
    init();

    /**
     * Handles incoming Apps Script requests (doGet / doPost).
     *
     * @param {GoogleAppsScript.Events.DoGet | GoogleAppsScript.Events.DoPost} e
     * @param {string} method - HTTP method (e.g., 'GET', 'POST')
     * @returns {any}
     */
    const handle = (e, method) => router.handle(e, method);

    return { init, handle };
  };

  return { createApp };
})();
