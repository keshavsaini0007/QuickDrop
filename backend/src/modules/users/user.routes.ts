import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validateRequest } from '../../middleware/validateRequest';
import * as controller from './user.controller';
import { changePasswordSchema, updateProfileSchema } from '../auth/auth.validation';

export const userRouter = Router();

userRouter.use(authenticate);
userRouter.get('/me', controller.getMe);
userRouter.patch('/me', validateRequest({ body: updateProfileSchema }), controller.updateMe);
userRouter.patch(
  '/me/password',
  validateRequest({ body: changePasswordSchema }),
  controller.changePassword,
);
