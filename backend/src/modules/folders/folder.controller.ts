import type { Request } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { apiResponse } from '../../utils/apiResponse';
import * as folderService from './folder.service';
import type {
  CreateFolderInput,
  FolderTrashQuery,
  ListFoldersQuery,
  UpdateFolderInput,
} from './folder.validation';

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

export const createFolder = asyncHandler(async (req, res) => {
  const folder = await folderService.createFolder(userId(req), body<CreateFolderInput>(req));
  req.log.info({ userId: userId(req), folderId: folder.id }, 'Folder created');
  apiResponse.created(res, folder, 'Folder created.');
});

export const listFolders = asyncHandler(async (req, res) => {
  const result = await folderService.listFolders(userId(req), query<ListFoldersQuery>(req));
  apiResponse.paginated(res, result.folders, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
    hasNextPage: result.hasNextPage,
  }, 'Folders loaded.');
});

export const getFolder = asyncHandler(async (req, res) => {
  const { id } = params<{ id: string }>(req);
  const result = await folderService.getFolder(userId(req), id);
  apiResponse.ok(res, result, 'Folder loaded.');
});

export const updateFolder = asyncHandler(async (req, res) => {
  const { id } = params<{ id: string }>(req);
  const folder = await folderService.updateFolder(
    userId(req),
    id,
    body<UpdateFolderInput>(req),
  );
  apiResponse.ok(res, folder, 'Folder updated.');
});

export const trashFolder = asyncHandler(async (req, res) => {
  const { id } = params<{ id: string }>(req);
  const folder = await folderService.trashFolder(userId(req), id);
  apiResponse.ok(res, folder, 'Folder moved to the recycle bin.');
});

export const restoreFolder = asyncHandler(async (req, res) => {
  const { id } = params<{ id: string }>(req);
  const folder = await folderService.restoreFolder(userId(req), id);
  apiResponse.ok(res, folder, 'Folder restored.');
});

export const permanentlyDeleteFolder = asyncHandler(async (req, res) => {
  const { id } = params<{ id: string }>(req);
  await folderService.permanentlyDeleteFolder(userId(req), id);
  apiResponse.ok(res, null, 'Folder permanently deleted.');
});

export const listTrash = asyncHandler(async (req, res) => {
  const result = await folderService.listTrashFolders(userId(req), query<FolderTrashQuery>(req));
  apiResponse.paginated(res, result.folders, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
    hasNextPage: result.hasNextPage,
  }, 'Recycle bin folders loaded.');
});

export const emptyTrash = asyncHandler(async (req, res) => {
  const result = await folderService.emptyTrashFolders(userId(req));
  apiResponse.ok(res, result, 'Recycle bin folders emptied.');
});
