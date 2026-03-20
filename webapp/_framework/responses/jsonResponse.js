const JsonResponse = (() => {
  const Errors = Object.freeze({
    INVALID_REQUEST: Object.freeze({
      type: 'INVALID_REQUEST',
      code: 400,
    }),
    NOT_AUTHORIZED: Object.freeze({
      type: 'NOT_AUTHORIZED',
      code: 401,
    }),
    FORBIDDEN: Object.freeze({
      type: 'FORBIDDEN',
      code: 403,
    }),
    NOT_FOUND: Object.freeze({
      type: 'NOT_FOUND',
      code: 404,
    }),
    METHOD_NOT_ALLOWED: Object.freeze({
      type: 'METHOD_NOT_ALLOWED',
      code: 405,
    }),
    CONFLICT: Object.freeze({
      type: 'CONFLICT',
      code: 409,
    }),
    INTERNAL_ERROR: Object.freeze({
      type: 'INTERNAL_ERROR',
      code: 500,
    }),
  });

  const json = (payload) => payload;
  /* Not compatible with google.script.run
    ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
      ContentService.MimeType.JSON,
    );*/

  const success = (data = null) =>
    json({
      ok: true,
      code: 200,
      data,
    });

  const error = (code, type, message, details = null) => {
    const errorPayload = {
      type,
      message,
    };
    if (details !== null) errorPayload.details = details;

    return json({
      ok: false,
      code,
      error: errorPayload,
    });
  };

  return {
    Errors,
    success,
    error,
  };
})();
