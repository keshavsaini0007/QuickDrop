import { randomUUID } from 'node:crypto';
import { Types, type QueryFilter } from 'mongoose';
import { logger } from '../../config/logger';
import { recordActivity } from '../activities/activity.service';
import { FileModel } from '../files/file.model';
import { ShareModel } from '../shares/share.model';
import { releaseStorage } from '../users/storage.service';
import { deleteCloudinaryAsset } from '../../utils/cloudinaryAssets';
import { nameKeyFor, normalizeFolderName } from '../../utils/fileTypes';
import { ApiError } from '../../utils/apiError';
import { FolderModel, type FolderDocument, type Folder } from './folder.model';
import { assertItemNameAvailable, findAvailableItemName } from '../files/name.service';
import { toFolderDto, type BreadcrumbDto, type FolderDto } from './folder.dto';
import type {
  CreateFolderInput,
  FolderTrashQuery,
  ListFoldersQuery,
  UpdateFolderInput,
} from './folder.validation';

async function getFolderForOwner(
  ownerId: string,
  folderId: string,
  includeDeleted = false,
): Promise<FolderDocument> {
  const folder = await FolderModel.findOne({
    _id: folderId,
    owner: ownerId,
    ...(includeDeleted ? {} : { deletedAt: { $exists: false } }),
  });
  if (!folder) throw ApiError.notFound('Folder not found.');
  return folder;
}

async function getParentForOwner(ownerId: string, parentId?: string | null) {
  if (!parentId) return null;
  return getFolderForOwner(ownerId, parentId);
}

async function collectDescendantFolderIds(
  ownerId: string,
  rootId: string,
  includeDeleted = false,
): Promise<string[]> {
  const ids: string[] = [rootId];
  let frontier: string[] = [rootId];

  while (frontier.length > 0 && ids.length < 10000) {
    const children = await FolderModel.find({
      owner: ownerId,
      parent: { $in: frontier },
      ...(includeDeleted ? {} : { deletedAt: { $exists: false } }),
    }).select('_id');
    const next = children.map((child) => child.id).filter((id) => !ids.includes(id));
    ids.push(...next);
    frontier = next;
  }

  return ids;
}

async function isDescendantOf(
  ownerId: string,
  candidateFolderId: string,
  ancestorFolderId: string,
): Promise<boolean> {
  let currentId: string | null = candidateFolderId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    if (currentId === ancestorFolderId) return true;
    visited.add(currentId);
    const parentRecord = (await FolderModel.collection.findOne(
      { _id: new Types.ObjectId(currentId), owner: new Types.ObjectId(ownerId) },
      { projection: { parent: 1 } },
    )) as { parent?: unknown } | null;
    currentId = parentRecord?.parent ? String(parentRecord.parent) : null;
  }

  return false;
}

export interface FolderListResult {
  folders: FolderDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export async function createFolder(
  ownerId: string,
  input: CreateFolderInput,
): Promise<FolderDto> {
  const parent = await getParentForOwner(ownerId, input.parentId);
  const name = normalizeFolderName(input.name);
  const nameKey = nameKeyFor(name);
  const parentKey = parent?.id ?? 'root';

  await assertItemNameAvailable({ owner: ownerId, parentKey }, nameKey);

  const folder = await FolderModel.create({
    owner: ownerId,
    name,
    nameKey,
    parent: parent?._id ?? null,
    parentKey,
  });

  await recordActivity({
    owner: ownerId,
    type: 'folder_created',
    folder: folder.id,
    metadata: { name: folder.name },
  });
  return toFolderDto(folder);
}

export async function listFolders(
  ownerId: string,
  query: ListFoldersQuery,
): Promise<FolderListResult> {
  const parent = await getParentForOwner(ownerId, query.parentId);
  const filter: QueryFilter<Folder> = {
    owner: ownerId,
    parent: parent?._id ?? null,
    deletedAt: { $exists: false },
  };
  if (query.search) {
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.name = { $regex: escaped, $options: 'i' };
  }

  const sort: Record<string, 1 | -1> = {
    [query.sort]: query.order === 'asc' ? 1 : -1,
  };
  const skip = (query.page - 1) * query.limit;
  const [folders, total] = await Promise.all([
    FolderModel.find(filter).sort(sort).skip(skip).limit(query.limit),
    FolderModel.countDocuments(filter),
  ]);
  const totalPages = Math.ceil(total / query.limit);

  return {
    folders: folders.map(toFolderDto),
    page: query.page,
    limit: query.limit,
    total,
    totalPages,
    hasNextPage: query.page < totalPages,
  };
}

export async function getFolder(
  ownerId: string,
  folderId: string,
): Promise<{ folder: FolderDto; breadcrumbs: BreadcrumbDto[] }> {
  const folder = await getFolderForOwner(ownerId, folderId);
  const breadcrumbs: BreadcrumbDto[] = [];
  const visited = new Set<string>();
  let current: FolderDocument | null = folder;

  while (current && !visited.has(current.id) && breadcrumbs.length < 100) {
    visited.add(current.id);
    breadcrumbs.unshift({ id: current.id, name: current.name });
    current = current.parent
      ? await FolderModel.findOne({ _id: current.parent, owner: ownerId, deletedAt: { $exists: false } })
      : null;
  }

  return { folder: toFolderDto(folder), breadcrumbs };
}

export async function updateFolder(
  ownerId: string,
  folderId: string,
  input: UpdateFolderInput,
): Promise<FolderDto> {
  const folder = await getFolderForOwner(ownerId, folderId);

  if (input.parentId !== undefined) {
    if (input.parentId === folder.id) {
      throw ApiError.badRequest('A folder cannot be moved into itself.');
    }
    if (input.parentId) {
      const target = await getFolderForOwner(ownerId, input.parentId);
      if (await isDescendantOf(ownerId, target.id, folder.id)) {
        throw ApiError.badRequest('A folder cannot be moved into one of its descendants.');
      }
    }
  }

  const targetParent =
    input.parentId !== undefined ? await getParentForOwner(ownerId, input.parentId) : null;
  const nextParentKey =
    input.parentId !== undefined ? (targetParent?.id ?? 'root') : folder.parentKey;
  const nextName = input.name ? normalizeFolderName(input.name) : folder.name;
  const nextNameKey = nameKeyFor(nextName);

  if (nextNameKey !== folder.nameKey || nextParentKey !== folder.parentKey) {
    await assertItemNameAvailable(
      {
        owner: ownerId,
        parentKey: nextParentKey,
        excludeFolderId: folder._id,
      },
      nextNameKey,
    );
  }

  const previousName = folder.name;
  const previousParentKey = folder.parentKey;
  folder.name = nextName;
  folder.nameKey = nextNameKey;
  if (input.parentId !== undefined) {
    folder.parent = targetParent?._id ?? null;
    folder.parentKey = nextParentKey;
  }
  await folder.save();

  await recordActivity({
    owner: ownerId,
    type: previousParentKey !== folder.parentKey ? 'folder_moved' : 'folder_renamed',
    folder: folder.id,
    metadata: {
      from: previousName,
      to: folder.name,
      fromParentKey: previousParentKey,
      toParentKey: folder.parentKey,
    },
  });
  return toFolderDto(folder);
}

export async function trashFolder(ownerId: string, folderId: string): Promise<FolderDto> {
  const folder = await getFolderForOwner(ownerId, folderId);
  const ids = await collectDescendantFolderIds(ownerId, folder.id);
  const batchId = randomUUID();
  const deletedAt = new Date();

  await Promise.all([
    FolderModel.updateMany(
      { owner: ownerId, _id: { $in: ids }, deletedAt: { $exists: false } },
      { $set: { deletedAt, trashBatchId: batchId } },
    ),
    FileModel.updateMany(
      { owner: ownerId, folder: { $in: ids }, deletedAt: { $exists: false } },
      { $set: { deletedAt, trashBatchId: batchId } },
    ),
  ]);

  folder.deletedAt = deletedAt;
  folder.trashBatchId = batchId;
  await recordActivity({
    owner: ownerId,
    type: 'folder_deleted',
    folder: folder.id,
    metadata: { name: folder.name, folderCount: ids.length },
  });
  return toFolderDto(folder);
}

export async function restoreFolder(ownerId: string, folderId: string): Promise<FolderDto> {
  const folder = await getFolderForOwner(ownerId, folderId, true);
  if (!folder.deletedAt) throw ApiError.badRequest('This folder is not in the recycle bin.');

  const batchId = folder.trashBatchId;
  const folders = batchId
    ? await FolderModel.find({ owner: ownerId, trashBatchId: batchId, deletedAt: { $exists: true } })
    : [folder];
  const files = batchId
    ? await FileModel.find({ owner: ownerId, trashBatchId: batchId, deletedAt: { $exists: true } })
    : [];

  const pending = new Map(folders.map((item) => [item.id, item]));
  const restored = new Set<string>();

  // Restore roots first, then children whose parent is already active.
  while (pending.size > 0) {
    let progressed = false;
    for (const item of Array.from(pending.values())) {
      const parentId = item.parent?.toString() ?? null;
      if (parentId && pending.has(parentId) && !restored.has(parentId)) continue;

      const parent = parentId
        ? await FolderModel.findOne({
            _id: parentId,
            owner: ownerId,
            deletedAt: { $exists: false },
          })
        : null;
      const parentKey = parent?.id ?? 'root';
      const name = await findAvailableItemName(
        { owner: ownerId, parentKey, excludeFolderId: item._id },
        item.name,
      );
      item.name = name;
      item.nameKey = nameKeyFor(name);
      item.parent = parent?._id ?? null;
      item.parentKey = parentKey;
      item.deletedAt = undefined;
      item.trashBatchId = undefined;
      await item.save();
      pending.delete(item.id);
      restored.add(item.id);
      progressed = true;
    }
    if (!progressed) break;
  }

  for (const file of files) {
    const parentId = file.folder?.toString() ?? null;
    const parent = parentId
      ? await FolderModel.findOne({
          _id: parentId,
          owner: ownerId,
          deletedAt: { $exists: false },
        })
      : null;
    const parentKey = parent?.id ?? 'root';
    const name = await findAvailableItemName(
      { owner: ownerId, parentKey, excludeFileId: file._id },
      file.name,
    );
    file.name = name;
    file.nameKey = nameKeyFor(name);
    file.folder = parent?._id ?? null;
    file.parentKey = parentKey;
    file.deletedAt = undefined;
    file.trashBatchId = undefined;
    await file.save();
  }

  const restoredFolder = await getFolderForOwner(ownerId, folderId);
  await recordActivity({
    owner: ownerId,
    type: 'folder_restored',
    folder: restoredFolder.id,
    metadata: { name: restoredFolder.name, folderCount: folders.length, fileCount: files.length },
  });
  return toFolderDto(restoredFolder);
}

export async function permanentlyDeleteFolder(ownerId: string, folderId: string): Promise<void> {
  const folder = await getFolderForOwner(ownerId, folderId, true);
  if (!folder.deletedAt) {
    throw ApiError.badRequest('Move this folder to the recycle bin before deleting it permanently.');
  }

  // A folder in the recycle bin has deleted descendants, so permanent
  // deletion must walk the whole tree rather than only active children.
  const folderIds = await collectDescendantFolderIds(ownerId, folder.id, true);
  const files = await FileModel.find({
    owner: ownerId,
    folder: { $in: folderIds },
  });

  let releasedBytes = 0;
  for (const file of files) {
    await deleteCloudinaryAsset(file.cloudinaryPublicId, file.cloudinaryResourceType);
    await ShareModel.deleteMany({ file: file._id });
    releasedBytes += file.sizeBytes;
  }

  await FileModel.deleteMany({ owner: ownerId, _id: { $in: files.map((file) => file._id) } });
  await FolderModel.deleteMany({ owner: ownerId, _id: { $in: folderIds } });
  await releaseStorage(ownerId, releasedBytes);

  await recordActivity({
    owner: ownerId,
    type: 'folder_deleted',
    metadata: {
      name: folder.name,
      permanent: true,
      folderCount: folderIds.length,
      fileCount: files.length,
      releasedBytes,
    },
  });
  logger.info({ userId: ownerId, folderId }, 'Folder permanently deleted');
}

export async function listTrashFolders(
  ownerId: string,
  query: FolderTrashQuery,
): Promise<FolderListResult> {
  const filter: QueryFilter<Folder> = { owner: ownerId, deletedAt: { $exists: true } };
  const skip = (query.page - 1) * query.limit;
  const [folders, total] = await Promise.all([
    FolderModel.find(filter).sort({ deletedAt: -1 }).skip(skip).limit(query.limit),
    FolderModel.countDocuments(filter),
  ]);
  const totalPages = Math.ceil(total / query.limit);

  return {
    folders: folders.map(toFolderDto),
    page: query.page,
    limit: query.limit,
    total,
    totalPages,
    hasNextPage: query.page < totalPages,
  };
}

export async function emptyTrashFolders(
  ownerId: string,
): Promise<{ deletedCount: number }> {
  const folders = await FolderModel.find({
    owner: ownerId,
    deletedAt: { $exists: true },
  })
    .select('_id parent')
    .lean();
  const trashedIds = new Set(folders.map((folder) => String(folder._id)));
  const roots = folders.filter(
    (folder) => !folder.parent || !trashedIds.has(String(folder.parent)),
  );

  let deletedCount = 0;
  for (const folder of roots) {
    try {
      await permanentlyDeleteFolder(ownerId, String(folder._id));
      deletedCount += 1;
    } catch (error) {
      logger.error(
        { err: error, folderId: String(folder._id) },
        'Failed to empty a trashed folder tree',
      );
    }
  }

  return { deletedCount };
}
