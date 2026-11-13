import type { Request } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { apiResponse } from '../../utils/apiResponse';
import * as authService from '../auth/auth.service';
import type { AuthTokenMeta } from '../auth/token.service';
import type { ChangePasswordInput, UpdateProfileInput } from '../auth/auth.validation';

function getBody<T>(req: Request): T {
  return (req.validated?.body ?? {}) as T;
}

function getMeta(req: Request): AuthTokenMeta {
  return { ip: req.ip, userAgent: req.get('user-agent') ?? undefined };
}

export const getMe = asyncHandler(async (req, res) => {
  if (!req.user) throw new Error('Authenticated user missing from request context');
  const user = await authService.getMe(req.user.id);
  apiResponse.ok(res, user, 'Profile loaded.');
});

export const updateMe = asyncHandler(async (req, res) => {
  if (!req.user) throw new Error('Authenticated user missing from request context');
  const input = getBody<UpdateProfileInput>(req);
  const user = await authService.updateProfile(req.user.id, input);
  req.log.info({ userId: req.user.id }, 'Profile updated');
  apiResponse.ok(res, user, 'Profile updated.');
});

export const changePassword = asyncHandler(async (req, res) => {
  if (!req.user) throw new Error('Authenticated user missing from request context');
  const input = getBody<ChangePasswordInput>(req);
  const result = await authService.changePassword(req.user.id, input, getMeta(req));
  req.log.info({ userId: req.user.id }, 'Password changed');
  apiResponse.ok(
    res,
    result,
    'Password changed. Other sessions have been signed out.',
  );
});
