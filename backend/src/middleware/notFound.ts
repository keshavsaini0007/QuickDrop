import type { RequestHandler } from 'express';
import { ApiError } from '../utils/apiError';

export const notFound: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.path} was not found.`));
};
