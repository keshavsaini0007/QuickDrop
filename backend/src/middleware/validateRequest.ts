import type { RequestHandler } from 'express';
import { ZodError, type ZodType } from 'zod';
import { ApiError } from '../utils/apiError';
import type { ValidatedRequestData } from '../types/domain';

export interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export const validateRequest = (schemas: RequestSchemas): RequestHandler => {
  return (req, _res, next) => {
    try {
      const validated: ValidatedRequestData = { ...(req.validated ?? {}) };

      if (schemas.body) validated.body = schemas.body.parse(req.body);
      if (schemas.query) validated.query = schemas.query.parse(req.query);
      if (schemas.params) validated.params = schemas.params.parse(req.params);

      req.validated = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          field: issue.path.map(String).join('.') || 'request',
          message: issue.message,
        }));
        next(new ApiError(400, 'Validation failed.', 'VALIDATION_ERROR', details));
        return;
      }

      next(error);
    }
  };
};
