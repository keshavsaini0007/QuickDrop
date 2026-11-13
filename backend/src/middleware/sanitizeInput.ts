import type { RequestHandler } from 'express';
import { ApiError } from '../utils/apiError';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function assertSafeInput(
  value: unknown,
  path = '',
  depth = 0,
  seen = new WeakSet<object>(),
): void {
  if (value === null || value === undefined || typeof value !== 'object') return;

  if (depth > 20) {
    throw ApiError.badRequest('Request input is nested too deeply.');
  }

  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertSafeInput(item, `${path}[${index}].`, depth + 1, seen);
    });
    return;
  }

  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.') || FORBIDDEN_KEYS.has(key)) {
      throw new ApiError(
        400,
        `Request input contains a forbidden field: ${path}${key}`,
        'VALIDATION_ERROR',
      );
    }

    assertSafeInput(
      (value as Record<string, unknown>)[key],
      `${path}${key}.`,
      depth + 1,
      seen,
    );
  }
}

export const sanitizeInput: RequestHandler = (req, _res, next) => {
  try {
    assertSafeInput(req.body);
    assertSafeInput(req.query);
    assertSafeInput(req.params);
    next();
  } catch (error) {
    next(error);
  }
};
