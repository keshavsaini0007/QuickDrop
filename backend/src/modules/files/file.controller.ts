import type { Request } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { apiResponse } from '../../utils/apiResponse';
import * as fileService from './file.service';
import type {
  FavoriteFileInput,
  ListFilesQuery,
  MoveFileInput,
  RenameFileInput,
  TrashListQuery,
  UploadSignInput,
} from './file.validation';

function body<T>(req: Request): T {
  return (req.validated?.body ?? {}) as T;
}

function query<T>(req: Request): T {
  return (req.validated?.query ?? {}) as T;
}

function params<T>(req: Request): T {
  return (req.validated?.params ?? {}) as T;
}

function userId(req: Request): string {
  if (!req.user) throw new Error('Authenticated user missing from request context');
  return req.user.id;
}

export const signUpload = asyncHandler(async (req, res) => {
  const result = await fileService.signUpload(userId(req), body<UploadSignInput>(req));
  req.log.info({ userId: userId(req), sessionId: result.sessionId }, 'Upload signed');
  apiResponse.created(res, result, 'Upload authorized. Send the file directly to Cloudinary.');
});

export const confirmUpload = asyncHandler(async (req, res) => {
  const { sessionId } = params<{ sessionId: string }>(req);
  const file = await fileService.confirmUpload(userId(req), sessionId);
  req.log.info({ userId: userId(req), fileId: file.id }, 'Upload confirmed');
  apiResponse.created(res, file, 'File uploaded successfully.');
});

export const listFiles = asyncHandler(async (req, res) => {
  const result = await fileService.listFiles(userId(req), query<ListFilesQuery>(req));
  apiResponse.paginated(res, result.files, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
    hasNextPage: result.hasNextPage,
  }, 'Files loaded.');
});

export const getFile = asyncHandler(async (req, res) => {
  const { id } = params<{ id: string }>(req);
  const file = await fileService.getFile(userId(req), id);
  apiResponse.ok(res, file, 'File loaded.');
});

export const downloadFile = asyncHandler(async (req, res) => {
  const { id } = params<{ id: string }>(req);
  const result = await fileService.getFileDownload(userId(req), id, 'download');
  req.log.info({ userId: userId(req), fileId: id }, 'File download link issued');
  apiResponse.ok(res, result, 'Download link issued.');
});

export const previewFile = asyncHandler(async (req, res) => {
  const { id } = params<{ id: string }>(req);
  const result = await fileService.getFileDownload(userId(req), id, 'preview');
  apiResponse.ok(res, result, 'Preview link issued.');
});

export const renameFile = asyncHandler(async (req, res) => {
  const { id } = params<{ id: string }>(req);
  const file = await fileService.renameFile(userId(req), id, body<RenameFileInput>(req));
  apiResponse.ok(res, file, 'File renamed.');
});

export const moveFile = asyncHandler(async (req, res) => {
  const { id } = params<{ id: string }>(req);
  const file = await fileService.moveFile(userId(req), id, body<MoveFileInput>(req));
  apiResponse.ok(res, file, 'File moved.');
});

export const favoriteFile = asyncHandler(async (req, res) => {
  const { id } = params<{ id: string }>(req);
  const file = await fileService.setFileFavorite(userId(req), id, body<FavoriteFileInput>(req));
  apiResponse.ok(res, file, file.isFavorite ? 'Added to favorites.' : 'Removed from favorites.');
});

export const trashFile = asyncHandler(async (req, res) => {
  const { id } = params<{ id: string }>(req);
  const file = await fileService.trashFile(userId(req), id);
  apiResponse.ok(res, file, 'File moved to the recycle bin.');
});

export const restoreFile = asyncHandler(async (req, res) => {
  const { id } = params<{ id: string }>(req);
  const file = await fileService.restoreFile(userId(req), id);
  apiResponse.ok(res, file, 'File restored.');
});

export const permanentlyDeleteFile = asyncHandler(async (req, res) => {
  const { id } = params<{ id: string }>(req);
  await fileService.permanentlyDeleteFile(userId(req), id);
  apiResponse.ok(res, null, 'File permanently deleted.');
});

export const listTrash = asyncHandler(async (req, res) => {
  const result = await fileService.listTrash(userId(req), query<TrashListQuery>(req));
  apiResponse.paginated(res, result.files, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
    hasNextPage: result.hasNextPage,
  }, 'Recycle bin loaded.');
});

export const emptyTrash = asyncHandler(async (req, res) => {
  const result = await fileService.emptyTrash(userId(req));
  req.log.info({ userId: userId(req), ...result }, 'Recycle bin emptied');
  apiResponse.ok(res, result, 'Recycle bin emptied.');
});
