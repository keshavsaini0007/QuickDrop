import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validateRequest } from '../../middleware/validateRequest';
import * as controller from './folder.controller';
import {
  createFolderSchema,
  folderIdParamSchema,
  folderTrashQuerySchema,
  listFoldersQuerySchema,
  updateFolderSchema,
} from './folder.validation';

export const folderRouter = Router();

folderRouter.use(authenticate);

folderRouter.get(
  '/trash',
  validateRequest({ query: folderTrashQuerySchema }),
  controller.listTrash,
);
folderRouter.delete('/trash', controller.emptyTrash);

folderRouter.post(
  '/',
  validateRequest({ body: createFolderSchema }),
  controller.createFolder,
);
folderRouter.get(
  '/',
  validateRequest({ query: listFoldersQuerySchema }),
  controller.listFolders,
);
folderRouter.get(
  '/:id',
  validateRequest({ params: folderIdParamSchema }),
  controller.getFolder,
);
folderRouter.patch(
  '/:id',
  validateRequest({ params: folderIdParamSchema, body: updateFolderSchema }),
  controller.updateFolder,
);
folderRouter.delete(
  '/:id',
  validateRequest({ params: folderIdParamSchema }),
  controller.trashFolder,
);
folderRouter.post(
  '/:id/restore',
  validateRequest({ params: folderIdParamSchema }),
  controller.restoreFolder,
);
folderRouter.delete(
  '/:id/permanent',
  validateRequest({ params: folderIdParamSchema }),
  controller.permanentlyDeleteFolder,
);
