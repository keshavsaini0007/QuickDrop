import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authLimiter } from '../../middleware/rateLimiter';
import { validateRequest } from '../../middleware/validateRequest';
import * as controller from './auth.controller';
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.validation';

export const authRouter = Router();

authRouter.post(
  '/register',
  authLimiter,
  validateRequest({ body: registerSchema }),
  controller.register,
);
authRouter.post('/login', authLimiter, validateRequest({ body: loginSchema }), controller.login);
authRouter.post(
  '/refresh',
  authLimiter,
  validateRequest({ body: refreshTokenSchema }),
  controller.refresh,
);
authRouter.post(
  '/logout',
  authLimiter,
  validateRequest({ body: logoutSchema }),
  controller.logout,
);
authRouter.post('/logout-all', authenticate, controller.logoutAll);
authRouter.post(
  '/forgot-password',
  authLimiter,
  validateRequest({ body: forgotPasswordSchema }),
  controller.forgotPassword,
);
authRouter.post(
  '/reset-password',
  authLimiter,
  validateRequest({ body: resetPasswordSchema }),
  controller.resetPassword,
);
