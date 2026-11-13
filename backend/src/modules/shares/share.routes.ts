import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { publicLimiter } from '../../middleware/rateLimiter';
import { validateRequest } from '../../middleware/validateRequest';
import * as controller from './share.controller';
import {
  createShareSchema,
  publicShareTokenParamSchema,
  regenerateShareSchema,
  shareIdParamSchema,
  shareListQuerySchema,
  unlockShareSchema,
} from './share.validation';

export const shareRouter = Router();
shareRouter.use(authenticate);

shareRouter.post(
  '/',
  validateRequest({ body: createShareSchema }),
  controller.createShare,
);
shareRouter.get(
  '/',
  validateRequest({ query: shareListQuerySchema }),
  controller.listShares,
);
shareRouter.delete(
  '/:id',
  validateRequest({ params: shareIdParamSchema }),
  controller.revokeShare,
);
shareRouter.post(
  '/:id/regenerate',
  validateRequest({ params: shareIdParamSchema, body: regenerateShareSchema }),
  controller.regenerateShare,
);

export const publicShareRouter = Router();

publicShareRouter.get(
  '/:token',
  publicLimiter,
  validateRequest({ params: publicShareTokenParamSchema }),
  controller.getPublicShare,
);
publicShareRouter.post(
  '/:token/access',
  publicLimiter,
  validateRequest({ params: publicShareTokenParamSchema, body: unlockShareSchema }),
  controller.unlockPublicShare,
);
publicShareRouter.get(
  '/:token/download',
  publicLimiter,
  validateRequest({ params: publicShareTokenParamSchema }),
  controller.downloadPublicShare,
);
