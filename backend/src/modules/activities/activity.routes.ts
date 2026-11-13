import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validateRequest } from '../../middleware/validateRequest';
import { listActivity } from './activity.controller';
import { activityListQuerySchema } from './activity.validation';

export const activityRouter = Router();

activityRouter.use(authenticate);
activityRouter.get('/', validateRequest({ query: activityListQuerySchema }), listActivity);
