import { Types } from 'mongoose';
import { UserModel } from './user.model';
import { FileModel } from '../files/file.model';
import { FolderModel } from '../folders/folder.model';
import { MEDIA_TYPES, type MediaType } from '../../utils/fileTypes';

export async function reserveStorage(
  userId: string | Types.ObjectId,
  bytes: number,
): Promise<boolean> {
  if (bytes <= 0) return true;
  const user = await UserModel.findOneAndUpdate(
    {
      _id: userId,
      $expr: {
        $lte: [{ $add: ['$storageUsedBytes', bytes] }, '$storageLimitBytes'],
      },
    },
    { $inc: { storageUsedBytes: bytes } },
    { returnDocument: 'after' },
  );
  return Boolean(user);
}

export async function releaseStorage(
  userId: string | Types.ObjectId,
  bytes: number,
): Promise<void> {
  if (bytes <= 0) return;
  await UserModel.updateOne(
    { _id: userId },
    [
      {
        $set: {
          storageUsedBytes: {
            $cond: [
              { $lt: [{ $subtract: ['$storageUsedBytes', bytes] }, 0] },
              0,
              { $subtract: ['$storageUsedBytes', bytes] },
            ],
          },
        },
      },
    ],
    { updatePipeline: true },
  );
}

export interface StorageSummary {
  usedBytes: number;
  limitBytes: number;
  availableBytes: number;
  percentUsed: number;
  byMedia: Record<MediaType, { bytes: number; count: number }>;
  trash: { bytes: number; count: number };
  favorites: number;
  totalFiles: number;
  totalFolders: number;
}

export async function getStorageSummary(userId: string | Types.ObjectId): Promise<StorageSummary> {
  const user = await UserModel.findById(userId).select('storageUsedBytes storageLimitBytes');
  if (!user) {
    throw new Error('User not found while loading storage summary');
  }

  const [mediaRows, trashRow, favoriteCount, totalFolders] = await Promise.all([
    FileModel.aggregate<{ _id: MediaType; bytes: number; count: number }>([
      { $match: { owner: new Types.ObjectId(String(userId)), deletedAt: { $exists: false } } },
      { $group: { _id: '$mediaType', bytes: { $sum: '$sizeBytes' }, count: { $sum: 1 } } },
    ]),
    FileModel.aggregate<{ _id: null; bytes: number; count: number }>([
      { $match: { owner: new Types.ObjectId(String(userId)), deletedAt: { $exists: true } } },
      { $group: { _id: null, bytes: { $sum: '$sizeBytes' }, count: { $sum: 1 } } },
    ]),
    FileModel.countDocuments({
      owner: userId,
      isFavorite: true,
      deletedAt: { $exists: false },
    }),
    FolderModel.countDocuments({ owner: userId, deletedAt: { $exists: false } }),
  ]);

  const byMedia = Object.fromEntries(
    MEDIA_TYPES.map((mediaType) => [mediaType, { bytes: 0, count: 0 }]),
  ) as Record<MediaType, { bytes: number; count: number }>;

  for (const row of mediaRows) {
    if (row._id in byMedia) {
      byMedia[row._id] = { bytes: row.bytes, count: row.count };
    }
  }

  const totalFiles = Object.values(byMedia).reduce((sum, row) => sum + row.count, 0);
  const usedBytes = user.storageUsedBytes;
  const limitBytes = user.storageLimitBytes;

  return {
    usedBytes,
    limitBytes,
    availableBytes: Math.max(0, limitBytes - usedBytes),
    percentUsed: limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 10000) / 100) : 0,
    byMedia,
    trash: { bytes: trashRow[0]?.bytes ?? 0, count: trashRow[0]?.count ?? 0 },
    favorites: favoriteCount,
    totalFiles,
    totalFolders,
  };
}
