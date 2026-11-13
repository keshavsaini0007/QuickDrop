import type { Request } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { apiResponse } from '../../utils/apiResponse';
import type { AuthTokenMeta } from './token.service';
import * as authService from './auth.service';
import type {
  ForgotPasswordInput,
  LoginInput,
  RefreshTokenInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth.validation';

function getBody<T>(req: Request): T {
  return (req.validated?.body ?? {}) as T;
}

function getMeta(req: Request): AuthTokenMeta {
  return {
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  };
}

function maskEmail(email: string): string {
  return email.replace(/(^.).*(@.*$)/, '$1***$2');
}

export const register = asyncHandler(async (req, res) => {
  const input = getBody<RegisterInput>(req);
  const result = await authService.register(input, getMeta(req));
  req.log.info({ userId: result.user.id }, 'Account created');
  apiResponse.created(res, result, 'Account created successfully.');
});

export const login = asyncHandler(async (req, res) => {
  const input = getBody<LoginInput>(req);
  const result = await authService.login(input, getMeta(req));
  req.log.info({ userId: result.user.id }, 'Login successful');
  apiResponse.ok(res, result, 'Signed in successfully.');
});

export const refresh = asyncHandler(async (req, res) => {
  const input = getBody<RefreshTokenInput>(req);
  const result = await authService.refresh(input.refreshToken, getMeta(req));
  req.log.info({ userId: result.user.id }, 'Session refreshed');
  apiResponse.ok(res, result, 'Session refreshed.');
});

export const logout = asyncHandler(async (req, res) => {
  const input = getBody<RefreshTokenInput>(req);
  await authService.logout(input.refreshToken);
  req.log.info('Session logged out');
  apiResponse.ok(res, null, 'Logged out successfully.');
});

export const logoutAll = asyncHandler(async (req, res) => {
  if (!req.user) throw new Error('Authenticated user missing from request context');
  await authService.logoutAll(req.user.id);
  req.log.info({ userId: req.user.id }, 'All sessions logged out');
  apiResponse.ok(res, null, 'All sessions have been logged out.');
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const input = getBody<ForgotPasswordInput>(req);
  const result = await authService.forgotPassword(input);
  req.log.info({ email: maskEmail(input.email) }, 'Password reset requested');
  apiResponse.ok(
    res,
    result,
    'If an account exists for that email, a password reset link has been sent.',
  );
});

export const resetPassword = asyncHandler(async (req, res) => {
  const input = getBody<ResetPasswordInput>(req);
  await authService.resetPassword(input);
  req.log.info('Password reset completed');
  apiResponse.ok(res, null, 'Password reset successfully. Please sign in with your new password.');
});
