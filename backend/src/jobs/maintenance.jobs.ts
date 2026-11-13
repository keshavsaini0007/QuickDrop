import type { QueryFilter, Types } from 'mongoose';
import { env } from '../config/environment';
import { logger } from '../config/logger';
import { FileModel, type FileRecord } from '../modules/files/file.model';
import { UploadSessionModel } from '../modules/files/uploadSession.model';
import { FolderModel } from '../modules/folders/folder.model';
import { UserModel } from '../modules/users/user.model';
import { deleteCloudinaryAsset } from '../utils/cloudinaryAssets';
import { permanentlyDeleteFile } from '../modules/files/file.service';
import { permanentlyDeleteFolder } from '../modules/folders/folder.service';
import { releaseStorage } from '../modules/users/storage.service';

/**
 * A confirm request may already be in flight when a session reaches its
 * expiry timestamp. Waiting a short grace period avoids racing that request.
 */
const EXPIRY_GRACE_MS = 5 * 60 * 1000;
const BATCH_SIZE = 200;

export interface ExpireUploadSessionsResult {
  expired: number;
  recovered: number;
  releasedBytes: number;
  cleanupFailures: number;
}

export interface PurgeTrashResult {
  foldersDeleted: number;
  filesDeleted: number;
  failures: number;
}

export interface PruneSessionsResult {
  deleted: number;
}

export interface ReconcileStorageResult {
  usersChecked: number;
  usersAdjusted: number;
  usersSkipped: number;
}

export interface MaintenanceResult {
  uploads: ExpireUploadSessionsResult;
  trash: PurgeTrashResult;
  sessions: PruneSessionsResult;
  storage: ReconcileStorageResult;
  durationMs: number;
  errors: string[];
}

/**
 * Expire abandoned upload reservations. If a file record already exists for
 * the session (for example, the process stopped between file creation and
 * session completion), repair the link instead of releasing the quota twice.
 */
export async function expireUploadSessions(
  now = new Date(),
  limit = BATCH_SIZE,
): Promise<ExpireUploadSessionsResult> {
  const cutoff = new Date(now.getTime() - EXPIRY_GRACE_MS);
  const sessions = await UploadSessionModel.find({
    status: { $in: ['pending', 'confirming'] },
    expiresAt: { $lte: cutoff },
  })
    .sort({ expiresAt: 1 })
    .limit(limit);

  const result: ExpireUploadSessionsResult = {
    expired: 0,
    recovered: 0,
    releasedBytes: 0,
    cleanupFailures: 0,
  };

  for (const session of sessions) {
    const existingFile = await FileModel.findOne({
      owner: session.owner,
      cloudinaryPublicId: session.cloudinaryPublicId,
    });

    if (existingFile) {
      session.status = 'completed';
      session.file = existingFile._id;
      session.completedAt = existingFile.createdAt;
      await session.save();
      result.recovered += 1;
      logger.warn(
        { sessionId: session.id, fileId: existingFile.id },
        'Repaired upload session that had a file but was never marked complete',
      );
      continue;
    }

    try {
      await deleteCloudinaryAsset(
        session.cloudinaryPublicId,
        session.cloudinaryResourceType,
      );
    } catch (error) {
      // The quota reservation still belongs to the user. The orphaned
      // Cloudinary asset is logged so it can be investigated manually.
      result.cleanupFailures += 1;
      logger.warn(
        {
          err: error,
          sessionId: session.id,
          publicId: session.cloudinaryPublicId,
          resourceType: session.cloudinaryResourceType,
        },
        'Could not delete an abandoned Cloudinary upload; releasing quota anyway',
      );
    }

    session.status = 'expired';
    session.failureReason = 'Upload session expired before confirmation.';
    await session.save();
    await releaseStorage(session.owner, session.reservedBytes);
    result.expired += 1;
    result.releasedBytes += session.reservedBytes;
  }

  if (result.expired > 0 || result.recovered > 0) {
    logger.info(result, 'Expired upload sessions processed');
  }
  return result;
}

/**
 * Permanently remove recycle-bin items older than the configured retention.
 * Folder roots are deleted first so their descendants and files are handled
 * once by the existing permanent-delete services.
 */
export async function purgeExpiredTrash(now = new Date()): Promise<PurgeTrashResult> {
  const cutoff = new Date(
    now.getTime() - env.TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const result: PurgeTrashResult = {
    foldersDeleted: 0,
    filesDeleted: 0,
    failures: 0,
  };

  const trashedFolders = await FolderModel.find({
    deletedAt: { $lte: cutoff },
  })
    .select('_id parent owner name')
    .lean();
  const trashedIds = new Set(trashedFolders.map((folder) => String(folder._id)));
  const roots = trashedFolders.filter(
    (folder) => !folder.parent || !trashedIds.has(String(folder.parent)),
  );

  for (const folder of roots) {
    try {
      await permanentlyDeleteFolder(String(folder.owner), String(folder._id));
      result.foldersDeleted += 1;
    } catch (error) {
      result.failures += 1;
      logger.error(
        { err: error, folderId: String(folder._id), name: folder.name },
        'Could not purge an expired trashed folder',
      );
    }
  }

  // Files inside any trashed folder are handled by that folder's deletion.
  // Only delete standalone trashed files here.
  const remainingTrashedFolders = await FolderModel.find({
    deletedAt: { $exists: true },
  })
    .select('_id')
    .lean();
  const remainingFolderIds = remainingTrashedFolders.map((folder) => folder._id);
  const fileFilter: QueryFilter<FileRecord> = {
    deletedAt: { $lte: cutoff },
    ...(remainingFolderIds.length > 0 ? { folder: { $nin: remainingFolderIds } } : {}),
  };
  const files = await FileModel.find(fileFilter).select('_id owner name').lean();

  for (const file of files) {
    try {
      await permanentlyDeleteFile(String(file.owner), String(file._id));
      result.filesDeleted += 1;
    } catch (error) {
      result.failures += 1;
      logger.error(
        { err: error, fileId: String(file._id), name: file.name },
        'Could not purge an expired trashed file',
      );
    }
  }

  if (result.foldersDeleted > 0 || result.filesDeleted > 0) {
    logger.info(result, 'Expired recycle-bin items purged');
  }
  return result;
}

/** Remove old terminal upload-session documents after their retention window. */
export async function pruneUploadSessions(
  now = new Date(),
): Promise<PruneSessionsResult> {
  const cutoff = new Date(
    now.getTime() - env.UPLOAD_SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const result = await UploadSessionModel.deleteMany({
    status: { $in: ['completed', 'failed', 'expired'] },
    updatedAt: { $lt: cutoff },
  });
  return { deleted: result.deletedCount ?? 0 };
}

/**
 * Recalculate storageUsedBytes from file records plus unreleased reservations.
 * A compare-and-set on the old value prevents a concurrent upload from being
 * clobbered; if it changes during the calculation the next run repairs it.
 */
export async function reconcileStorage(
  _now = new Date(),
): Promise<ReconcileStorageResult> {
  const [fileRows, reservationRows, users] = await Promise.all([
    FileModel.aggregate<{ _id: Types.ObjectId; bytes: number }>([
      { $group: { _id: '$owner', bytes: { $sum: '$sizeBytes' } } },
    ]),
    UploadSessionModel.aggregate<{ _id: Types.ObjectId; bytes: number }>([
      {
        $match: {
          // A reservation remains real until maintenance releases it, even if
          // its session is inside the expiry grace period.
          status: { $in: ['pending', 'confirming'] },
        },
      },
      { $group: { _id: '$owner', bytes: { $sum: '$reservedBytes' } } },
    ]),
    UserModel.find().select('_id storageUsedBytes').lean(),
  ]);

  const expected = new Map<string, number>();
  for (const row of fileRows) {
    expected.set(String(row._id), (expected.get(String(row._id)) ?? 0) + row.bytes);
  }
  for (const row of reservationRows) {
    expected.set(String(row._id), (expected.get(String(row._id)) ?? 0) + row.bytes);
  }

  const result: ReconcileStorageResult = {
    usersChecked: users.length,
    usersAdjusted: 0,
    usersSkipped: 0,
  };

  for (const user of users) {
    const current = Number(user.storageUsedBytes ?? 0);
    const target = expected.get(String(user._id)) ?? 0;
    if (current === target) continue;

    const update = await UserModel.updateOne(
      { _id: user._id, storageUsedBytes: current },
      { $set: { storageUsedBytes: target } },
    );
    if (update.modifiedCount > 0) {
      result.usersAdjusted += 1;
      logger.warn(
        { userId: String(user._id), previousBytes: current, correctedBytes: target },
        'Corrected a drifted storage counter',
      );
    } else {
      result.usersSkipped += 1;
    }
  }

  return result;
}

export async function runMaintenance(now = new Date()): Promise<MaintenanceResult> {
  const startedAt = Date.now();
  const errors: string[] = [];

  let uploads: ExpireUploadSessionsResult = {
    expired: 0,
    recovered: 0,
    releasedBytes: 0,
    cleanupFailures: 0,
  };
  try {
    uploads = await expireUploadSessions(now);
  } catch (error) {
    errors.push('uploads');
    logger.error({ err: error }, 'Upload-session maintenance step failed');
  }

  let trash: PurgeTrashResult = { foldersDeleted: 0, filesDeleted: 0, failures: 0 };
  try {
    trash = await purgeExpiredTrash(now);
  } catch (error) {
    errors.push('trash');
    logger.error({ err: error }, 'Recycle-bin maintenance step failed');
  }

  let sessions: PruneSessionsResult = { deleted: 0 };
  try {
    sessions = await pruneUploadSessions(now);
  } catch (error) {
    errors.push('sessions');
    logger.error({ err: error }, 'Upload-session pruning step failed');
  }

  let storage: ReconcileStorageResult = {
    usersChecked: 0,
    usersAdjusted: 0,
    usersSkipped: 0,
  };
  try {
    storage = await reconcileStorage(now);
  } catch (error) {
    errors.push('storage');
    logger.error({ err: error }, 'Storage reconciliation step failed');
  }

  const durationMs = Date.now() - startedAt;
  logger.info(
    { uploads, trash, sessions, storage, durationMs, errors },
    'Maintenance run finished',
  );
  return { uploads, trash, sessions, storage, durationMs, errors };
}

/**
 * Run once at startup and then on a fixed interval. The timer is unref'd so it
 * never keeps a shutting-down process alive.
 */
export function startMaintenanceJobs(): () => void {
  let stopped = false;
  let running = false;

  const tick = async (): Promise<void> => {
    if (stopped || running) return;
    running = true;
    try {
      await runMaintenance();
    } catch (error) {
      logger.error({ err: error }, 'Maintenance run failed unexpectedly');
    } finally {
      running = false;
    }
  };

  void tick();
  const interval = setInterval(
    () => void tick(),
    Math.max(5, env.MAINTENANCE_INTERVAL_MINUTES) * 60 * 1000,
  );
  interval.unref();
  logger.info(
    { intervalMinutes: env.MAINTENANCE_INTERVAL_MINUTES },
    'Maintenance worker started',
  );

  return () => {
    stopped = true;
    clearInterval(interval);
    logger.info('Maintenance worker stopped');
  };
}
