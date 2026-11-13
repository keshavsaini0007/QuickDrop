import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { isProduction } from '../config/environment';
import { isApiError, type ApiErrorDetail } from '../utils/apiError';

interface ErrorLike {
  name?: string;
  message?: string;
  stack?: string;
  statusCode?: number;
  code?: string | number;
  type?: string;
  http_code?: number;
  errors?: Record<string, { path?: string; message?: string }>;
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (res.headersSent) return;

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred.';
  let details: ApiErrorDetail[] | undefined;

  const errorLike = (error ?? {}) as ErrorLike;

  if (isApiError(error)) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.errors;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed.';
    details = error.issues.map((issue) => ({
      field: issue.path.map(String).join('.') || 'request',
      message: issue.message,
    }));
  } else if (errorLike.name === 'ValidationError' && errorLike.errors) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Database validation failed.';
    details = Object.entries(errorLike.errors).map(([field, detail]) => ({
      field: detail.path ?? field,
      message: detail.message ?? 'Invalid value.',
    }));
  } else if (errorLike.name === 'CastError') {
    statusCode = 404;
    code = 'NOT_FOUND';
    message = 'Resource not found.';
  } else if (errorLike.code === 11000 || errorLike.code === '11000') {
    statusCode = 409;
    code = 'CONFLICT';
    message = 'A resource with that value already exists.';
  } else if (errorLike.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'The access token has expired.';
  } else if (errorLike.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
    message = 'The authentication token is invalid.';
  } else if (errorLike.type === 'entity.too.large') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'The request body is too large.';
  } else if (errorLike.type === 'entity.parse.failed') {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'The request body contains invalid JSON.';
  } else if (typeof errorLike.http_code === 'number') {
    statusCode = 502;
    code = 'CLOUDINARY_ERROR';
    message = 'Cloudinary could not complete the request.';
  }

  const safeMessage =
    isProduction && statusCode >= 500 && !(isApiError(error) && error.isOperational)
      ? 'An unexpected error occurred.'
      : message;

  req.log?.error(
    {
      err: error,
      requestId: req.id,
      statusCode,
      code,
    },
    'Request failed',
  );

  res.status(statusCode).json({
    success: false,
    message: safeMessage,
    code,
    ...(details?.length ? { errors: details } : {}),
    requestId: req.id,
  });
};

export default errorHandler;
