import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validateRequest } from '../../middleware/validateRequest';
import { asyncHandler } from '../../utils/asyncHandler';
import { apiResponse } from '../../utils/apiResponse';
import { emptyTrash as emptyFileTrash, listTrash as listFileTrash } from '../files/file.service';
import {
  emptyTrashFolders,
  listTrashFolders,
} from '../folders/folder.service';
import {
  trashListQuerySchema,
  type TrashListQuery,
} from '../files/file.validation';
import type { FolderTrashQuery } from '../folders/folder.validation';

export const trashRouter = Router();

trashRouter.use(authenticate);

trashRouter.get(
  '/',
  validateRequest({ query: trashListQuerySchema }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new Error('Authenticated user missing from request context');
    const query = (req.validated?.query ?? {}) as TrashListQuery;
    const [files, folders] = await Promise.all([
      listFileTrash(req.user.id, query),
      listTrashFolders(req.user.id, query as FolderTrashQuery),
    ]);
    apiResponse.ok(
      res,
      {
        files: files.files,
        folders: folders.folders,
        totals: {
          files: files.total,
          folders: folders.total,
          items: files.total + folders.total,
        },
      },
      'Recycle bin loaded.',
    );
  }),
);

trashRouter.delete(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new Error('Authenticated user missing from request context');
    const files = await emptyFileTrash(req.user.id);
    const folders = await emptyTrashFolders(req.user.id);
    req.log.info({ userId: req.user.id, ...files, ...folders }, 'Recycle bin emptied');
    apiResponse.ok(res, { files, folders }, 'Recycle bin emptied.');
  }),
);
