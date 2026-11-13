import type { RequestHandler } from 'express';
import { UserModel } from '../modules/users/user.model';
import { isTokenExpiredError, verifyAccessToken } from '../modules/auth/token.service';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';
import type { UserRole } from '../types/domain';

export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    throw ApiError.unauthorized('Authentication is required.');
  }

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Use a Bearer access token.');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    if (isTokenExpiredError(error)) throw ApiError.tokenExpired();
    throw ApiError.unauthorized('The access token is invalid.');
  }

  const user = await UserModel.findById(payload.sub).select('email role tokenVersion');
  if (!user) {
    throw ApiError.unauthorized('The account for this session no longer exists.');
  }

  if (user.tokenVersion !== payload.tokenVersion) {
    throw ApiError.unauthorized('Your session is no longer valid. Please sign in again.');
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  };

  next();
});

export const authorize = (...roles: UserRole[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) {
      next(ApiError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(ApiError.forbidden());
      return;
    }
    next();
  };
};
