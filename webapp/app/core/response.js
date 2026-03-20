const Response = (() => {
  const create = () => {
    let output = null;
    let statusCode = 200;
    const locals = {};

    const setOutput = (value) => {
      output = value;
      return value;
    };

    const setStatus = (code) => {
      statusCode = code;
      return api;
    };

    const api = {
      locals,
      
      status: (code) => setStatus(code),

      send: (content) => setOutput(content),

      json: (data) => {
        return setOutput({
          ok: statusCode < 400,
          code: statusCode,
          data: statusCode < 400 ? data : null,
        });
      },

      render: (view, options = {}) => {
        return setOutput(
          HtmlResponse.page(view, locals, {
            ...options,
            status: statusCode,
          }),
        );
      },

      redirect: (url) =>
        setOutput(
          HtmlService.createHtmlOutput(
            `<script>window.top.location.href="${url}"</script>`,
          ),
        ),

      error: (err) => {
        return setOutput(
          JsonResponse.error(
            err.code || statusCode,
            err.type,
            err.message,
            err.details,
          ),
        );
      },

      _get: () => output,
      _hasSent: () => output !== null,
      _getStatus: () => statusCode,
    };

    return api;
  };

  return {
    create,
  };
})();
