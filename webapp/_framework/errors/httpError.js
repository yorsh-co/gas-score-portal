const HttpError = (() => {
  class HttpError extends Error {
    constructor(code, type, message, details = null) {
      super(message);
      this.code = code;
      this.type = type;
      this.details = details;
    }
  }

  const badRequest = (message, details = null) =>
    new HttpError(
      JsonResponse.Errors.INVALID_REQUEST.code,
      JsonResponse.Errors.INVALID_REQUEST.type,
      message,
      details,
    );

  const notFound = (message, details = null) =>
    new HttpError(
      JsonResponse.Errors.NOT_FOUND.code,
      JsonResponse.Errors.NOT_FOUND.type,
      message,
      details,
    );

  const forbidden = (message, details = null) =>
    new HttpError(
      JsonResponse.Errors.FORBIDDEN.code,
      JsonResponse.Errors.FORBIDDEN.type,
      message,
      details,
    );

  const methodNotAllowed = (message, details = null) =>
    new HttpError(
      JsonResponse.Errors.METHOD_NOT_ALLOWED.code,
      JsonResponse.Errors.METHOD_NOT_ALLOWED.type,
      message,
      details,
    );

  const conflict = (message, details = null) =>
    new HttpError(
      JsonResponse.Errors.CONFLICT.code,
      JsonResponse.Errors.CONFLICT.type,
      message,
      details,
    );

  const internal = (message = 'Internal server error', details = null) =>
    new HttpError(
      JsonResponse.Errors.INTERNAL_ERROR.code,
      JsonResponse.Errors.INTERNAL_ERROR.type,
      message,
      details,
    );

  return {
    HttpError,
    badRequest,
    notFound,
    forbidden,
    methodNotAllowed,
    conflict,
    internal,
  };
})();
