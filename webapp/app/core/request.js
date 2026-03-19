const Request = (() => {
  const normalizeRoute = (route) => {
    if (!route) return '/';
    if (!route.startsWith('/')) route = '/' + route;
    if (route.length > 1 && route.endsWith('/')) {
      route = route.slice(0, -1);
    }
    return route;
  };

  const normalizeMethod = (e, method) => {
    if (method === 'GET') return 'GET';
    return (e.parameter.method || method || 'POST').toUpperCase();
  };

  const safeJsonParse = (str) => {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  };

  const parseBody = (e) => {
    if (!e.postData || !e.postData.contents) return {};
    return safeJsonParse(e.postData.contents);
  };

  const create = (e, method) => {
    const route = normalizeRoute(e.parameter?.route || '/');
    const finalMethod = normalizeMethod(e, method);

    const params = e.parameter || {};
    const body = parseBody(e);

    return {
      // Core
      route,
      method: finalMethod,

      // Data
      params,
      query: params,
      body,

      // Raw event (escape hatch)
      event: e,

      // Auth (to be filled by middleware)
      user: null,

      // Meta
      isApi: route.startsWith('/api'),

      // 🔥 Helpers
      get: (key) => params?.[key] ?? null,

      has: (key) => key in params,

      all: () => ({
        ...params,
        ...body,
      }),

      header: (_name) => {
        // Apps Script limitation (no headers available)
        return null;
      },
    };
  };

  return {
    create,
  };
})();