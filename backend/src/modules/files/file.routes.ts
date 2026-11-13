import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { downloadLimiter, uploadLimiter } from '../../middleware/rateLimiter';
import { validateRequest } from '../../middleware/validateRequest';
import * as controller from './file.controller';
import {
  confirmUploadSchema,
  favoriteFileSchema,
  fileIdParamSchema,
  listFilesQuerySchema,
  moveFileSchema,
  renameFileSchema,
  trashListQuerySchema,
  uploadSessionIdParamSchema,
  uploadSignSchema,
} from './file.validation';

export const fileRouter = Router();

fileRouter.use(authenticate);

fileRouter.post(
  '/upload/sign',
  uploadLimiter,
  validateRequest({ body: uploadSignSchema }),
  controller.signUpload,
);
fileRouter.post(
  '/upload/:sessionId/confirm',
  uploadLimiter,
  validateRequest({ params: uploadSessionIdParamSchema, body: confirmUploadSchema }),
  controller.confirmUpload,
);

fileRouter.get(
  '/trash',
  validateRequest({ query: trashListQuerySchema }),
  controller.listTrash,
);
fileRouter.delete('/trash', controller.emptyTrash);

fileRouter.get(
  '/',
  validateRequest({ query: listFilesQuerySchema }),
  controller.listFiles,
);
fileRouter.get(
  '/:id',
  validateRequest({ params: fileIdParamSchema }),
  controller.getFile,
);
fileRouter.get(
  '/:id/download',
  downloadLimiter,
  validateRequest({ params: fileIdParamSchema }),
  controller.downloadFile,
);
fileRouter.get(
  '/:id/preview',
  validateRequest({ params: fileIdParamSchema }),
  controller.previewFile,
);
fileRouter.patch(
  '/:id',
  validateRequest({ params: fileIdParamSchema, body: renameFileSchema }),
  controller.renameFile,
);
fileRouter.patch(
  '/:id/move',
  validateRequest({ params: fileIdParamSchema, body: moveFileSchema }),
  controller.moveFile,
);
fileRouter.patch(
  '/:id/favorite',
  validateRequest({ params: fileIdParamSchema, body: favoriteFileSchema }),
  controller.favoriteFile,
);
fileRouter.delete(
  '/:id',
  validateRequest({ params: fileIdParamSchema }),
  controller.trashFile,
);
fileRouter.post(
  '/:id/restore',
  validateRequest({ params: fileIdParamSchema }),
  controller.restoreFile,
);
fileRouter.delete(
  '/:id/permanent',
  validateRequest({ params: fileIdParamSchema }),
  controller.permanentlyDeleteFile,
);
