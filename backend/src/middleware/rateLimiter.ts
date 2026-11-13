import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env, isTest } from '../config/environment';
import { ApiError } from '../utils/apiError';

const common = {
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
  skip: () => isTest,
  handler: (
    _req: unknown,
    _res: unknown,
    next: (error?: unknown) => void,
  ) => {
    next(ApiError.rateLimited());
  },
};

export const globalLimiter = rateLimit({
  ...common,
  windowMs: env.RATE_LIMIT_GLOBAL_WINDOW_MINUTES * 60 * 1000,
  limit: env.RATE_LIMIT_GLOBAL_MAX,
});

export const authLimiter = rateLimit({
  ...common,
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MINUTES * 60 * 1000,
  limit: env.RATE_LIMIT_AUTH_MAX,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? 'unknown'),
});

export const uploadLimiter = rateLimit({
  ...common,
  windowMs: env.RATE_LIMIT_UPLOAD_WINDOW_MINUTES * 60 * 1000,
  limit: env.RATE_LIMIT_UPLOAD_MAX,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? 'unknown'),
});

export const publicLimiter = rateLimit({
  ...common,
  windowMs: env.RATE_LIMIT_PUBLIC_WINDOW_MINUTES * 60 * 1000,
  limit: env.RATE_LIMIT_PUBLIC_MAX,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? 'unknown'),
});

export const downloadLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 120,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? 'unknown'),
});
