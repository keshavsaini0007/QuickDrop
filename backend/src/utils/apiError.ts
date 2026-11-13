export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly errors?: ApiErrorDetail[];
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    code = 'INTERNAL_ERROR',
    errors?: ApiErrorDetail[],
    isOperational = true,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = isOperational;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message = 'Bad request', errors?: ApiErrorDetail[]): ApiError {
    return new ApiError(400, message, 'VALIDATION_ERROR', errors);
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError(401, message, 'UNAUTHORIZED');
  }

  static tokenExpired(): ApiError {
    return new ApiError(401, 'The access token has expired.', 'TOKEN_EXPIRED');
  }

  static forbidden(message = 'You do not have permission to perform this action.'): ApiError {
    return new ApiError(403, message, 'FORBIDDEN');
  }

  static notFound(message = 'Resource not found.'): ApiError {
    return new ApiError(404, message, 'NOT_FOUND');
  }

  static conflict(message = 'The resource already exists.', code = 'CONFLICT'): ApiError {
    return new ApiError(409, message, code);
  }

  static tooLarge(message = 'The file is too large.'): ApiError {
    return new ApiError(413, message, 'FILE_TOO_LARGE');
  }

  static unsupportedMedia(message = 'This file type is not supported.'): ApiError {
    return new ApiError(415, message, 'UNSUPPORTED_MEDIA_TYPE');
  }

  static rateLimited(message = 'Too many requests. Please try again later.'): ApiError {
    return new ApiError(429, message, 'RATE_LIMITED');
  }

  static badGateway(message = 'An upstream service failed.', code = 'BAD_GATEWAY'): ApiError {
    return new ApiError(502, message, code);
  }

  static internal(message = 'An unexpected error occurred.'): ApiError {
    return new ApiError(500, message, 'INTERNAL_ERROR', undefined, false);
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;
