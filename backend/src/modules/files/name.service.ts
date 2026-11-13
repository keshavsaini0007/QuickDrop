import type { Types } from 'mongoose';
import { FileModel } from './file.model';
import { FolderModel } from '../folders/folder.model';
import { ApiError } from '../../utils/apiError';
import { nameKeyFor } from '../../utils/fileTypes';

interface NameScope {
  owner: Types.ObjectId | string;
  parentKey: string;
  excludeFileId?: Types.ObjectId | string;
  excludeFolderId?: Types.ObjectId | string;
}

export async function assertItemNameAvailable(
  scope: NameScope,
  nameKey: string,
): Promise<void> {
  const [fileExists, folderExists] = await Promise.all([
    FileModel.exists({
      owner: scope.owner,
      parentKey: scope.parentKey,
      nameKey,
      deletedAt: { $exists: false },
      ...(scope.excludeFileId ? { _id: { $ne: scope.excludeFileId } } : {}),
    }),
    FolderModel.exists({
      owner: scope.owner,
      parentKey: scope.parentKey,
      nameKey,
      deletedAt: { $exists: false },
      ...(scope.excludeFolderId ? { _id: { $ne: scope.excludeFolderId } } : {}),
    }),
  ]);

  if (fileExists || folderExists) {
    throw ApiError.conflict(
      'An item with this name already exists in this folder.',
      'NAME_CONFLICT',
    );
  }
}

export async function findAvailableItemName(
  scope: NameScope,
  baseName: string,
): Promise<string> {
  let candidate = baseName;
  let counter = 1;

  while (counter <= 100) {
    try {
      await assertItemNameAvailable(scope, nameKeyFor(candidate));
      return candidate;
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'NAME_CONFLICT') throw error;
      const suffix = ` (${counter})`;
      candidate = `${baseName.slice(0, Math.max(1, 255 - suffix.length))}${suffix}`;
      counter += 1;
    }
  }

  throw ApiError.conflict('Could not find an available name for the restored item.', 'NAME_CONFLICT');
}
