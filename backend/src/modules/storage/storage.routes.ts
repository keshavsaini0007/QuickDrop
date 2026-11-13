import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { asyncHandler } from '../../utils/asyncHandler';
import { apiResponse } from '../../utils/apiResponse';
import { getStorageSummary } from '../users/storage.service';
import { getRecentFiles } from '../files/file.service';

export const storageRouter = Router();

storageRouter.use(authenticate);

storageRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new Error('Authenticated user missing from request context');
    const [summary, recentFiles] = await Promise.all([
      getStorageSummary(req.user.id),
      getRecentFiles(req.user.id, 8),
    ]);
    apiResponse.ok(res, { summary, recentFiles }, 'Storage dashboard loaded.');
  }),
);
