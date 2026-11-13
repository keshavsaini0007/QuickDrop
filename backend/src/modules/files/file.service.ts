import { randomUUID } from 'node:crypto';
import type { QueryFilter } from 'mongoose';
import { env } from '../../config/environment';
import { logger } from '../../config/logger';
import { assertCloudinaryConfigured } from '../../config/cloudinary';
import { recordActivity } from '../activities/activity.service';
import { FolderModel } from '../folders/folder.model';
import { ShareModel } from '../shares/share.model';
import { releaseStorage, reserveStorage } from '../users/storage.service';
import { ApiError } from '../../utils/apiError';
import {
  buildPrivateDownloadUrl,
  createUploadSignature,
  deleteCloudinaryAsset,
  verifyUploadedAsset,
} from '../../utils/cloudinaryAssets';
import {
  getCloudinaryResourceType,
  getExtension,
  getMediaType,
  maxBytesForMedia,
  nameKeyFor,
  normalizeFileName,
} from '../../utils/fileTypes';
import { FileModel, type FileRecord } from './file.model';
import {
  UploadSessionModel,
  type UploadSessionDocument,
} from './uploadSession.model';
import { assertItemNameAvailable, findAvailableItemName } from './name.service';
import { toFileDto, type FileDto } from './file.dto';
import type {
  FavoriteFileInput,
  ListFilesQuery,
  MoveFileInput,
  RenameFileInput,
  TrashListQuery,
  UploadSignInput,
} from './file.validation';

function sizeLimitFor(mediaType: ReturnType<typeof getMediaType>): number {
  return maxBytesForMedia(mediaType, {
    image: env.MAX_IMAGE_SIZE_MB * 1024 * 1024,
    video: env.MAX_VIDEO_SIZE_MB * 1024 * 1024,
    document: env.MAX_DOCUMENT_SIZE_MB * 1024 * 1024,
    text: env.MAX_TEXT_SIZE_MB * 1024 * 1024,
  });
}

async function getFolderForOwner(ownerId: string, folderId?: string | null) {
  if (!folderId) return null;
  const folder = await FolderModel.findOne({
    _id: folderId,
    owner: ownerId,
    deletedAt: { $exists: false },
  });
  if (!folder) throw ApiError.notFound('Folder not found.');
  return folder;
}

async function getFileForOwner(ownerId: string, fileId: string, includeDeleted = false) {
  const file = await FileModel.findOne({
    _id: fileId,
    owner: ownerId,
    ...(includeDeleted ? {} : { deletedAt: { $exists: false } }),
  });
  if (!file) throw ApiError.notFound('File not found.');
  return file;
}

export interface UploadSignResult {
  sessionId: string;
  uploadUrl: string;
  params: Record<string, string | number | boolean>;
  expiresAt: Date;
  uploadMode: 'single' | 'chunked';
  chunkSizeBytes: number;
  uniqueUploadId: string;
  maxSizeBytes: number;
}

export async function signUpload(
  ownerId: string,
  input: UploadSignInput,
): Promise<UploadSignResult> {
  assertCloudinaryConfigured();

  const fileName = normalizeFileName(input.fileName);
  const mimeType = input.mimeType.toLowerCase();
  const mediaType = getMediaType(mimeType);
  const sizeLimit = sizeLimitFor(mediaType);
  if (input.sizeBytes > sizeLimit) {
    throw ApiError.tooLarge(
      `This file exceeds the ${Math.round(sizeLimit / (1024 * 1024))} MB limit for its type.`,
    );
  }

  const folder = await getFolderForOwner(ownerId, input.folderId);
  const parentKey = folder?.id ?? 'root';
  const nameKey = nameKeyFor(fileName);
  await assertItemNameAvailable({ owner: ownerId, parentKey }, nameKey);

  const resourceType = getCloudinaryResourceType(mediaType);
  const extension = getExtension(fileName, mimeType);
  const cloudinaryPublicId = `${env.CLOUDINARY_FOLDER_PREFIX}/${ownerId}/${randomUUID()}`;
  const reserved = await reserveStorage(ownerId, input.sizeBytes);
  if (!reserved) {
    throw new ApiError(413, 'Your storage quota does not have room for this file.', 'STORAGE_QUOTA_EXCEEDED');
  }

  const expiresAt = new Date(Date.now() + env.UPLOAD_SESSION_TTL_MINUTES * 60 * 1000);
  let session;
  try {
    session = await UploadSessionModel.create({
      owner: ownerId,
      folder: folder?._id ?? null,
      parentKey,
      fileName,
      nameKey,
      extension,
      mimeType,
      mediaType,
      sizeBytes: input.sizeBytes,
      reservedBytes: input.sizeBytes,
      cloudinaryPublicId,
      cloudinaryResourceType: resourceType,
      deliveryType: env.CLOUDINARY_DELIVERY_TYPE,
      status: 'pending',
      expiresAt,
    });
  } catch (error) {
    await releaseStorage(ownerId, input.sizeBytes);
    throw error;
  }

  try {
    const signature = createUploadSignature({
      publicId: cloudinaryPublicId,
      resourceType,
      includeEagerThumbnail: mediaType === 'image' || mediaType === 'video',
    });

    // The mobile client currently uses Cloudinary's single-request multipart
    // uploader. Chunked upload support is deliberately not advertised until a
    // real chunked client implementation exists.
    return {
      sessionId: session.id,
      uploadUrl: signature.uploadUrl,
      params: signature.params,
      expiresAt,
      uploadMode: 'single',
      chunkSizeBytes: env.UPLOAD_CHUNK_SIZE_MB * 1024 * 1024,
      uniqueUploadId: cloudinaryPublicId,
      maxSizeBytes: sizeLimit,
    };
  } catch (error) {
    session.status = 'failed';
    session.failureReason = 'Could not create Cloudinary upload signature.';
    await session.save();
    await releaseStorage(ownerId, input.sizeBytes);
    throw error;
  }
}

async function failUploadSession(
  session: UploadSessionDocument,
  reservedBytes: number,
  reason: string,
): Promise<void> {
  try {
    await deleteCloudinaryAsset(
      session.cloudinaryPublicId,
      session.cloudinaryResourceType,
    );
  } catch (error) {
    // The session still needs to be released even if the asset cleanup fails;
    // the orphaned public ID is logged for operational follow-up.
    logger.error(
      { err: error, sessionId: session.id, publicId: session.cloudinaryPublicId },
      'Could not delete a failed upload asset',
    );
  }
  await releaseStorage(session.owner, reservedBytes);
  session.status = 'failed';
  session.failureReason = reason;
  await session.save();
}

export async function confirmUpload(ownerId: string, sessionId: string): Promise<FileDto> {
  const initial = await UploadSessionModel.findOne({ _id: sessionId, owner: ownerId });
  if (!initial) throw ApiError.notFound('Upload session not found.');

  if (initial.status === 'completed') {
    if (initial.file) {
      const existing = await FileModel.findById(initial.file);
      if (existing) return toFileDto(existing);
    }
    throw new ApiError(410, 'This upload session is no longer active.', 'UPLOAD_SESSION_EXPIRED');
  }

  if (initial.status === 'failed' || initial.status === 'expired') {
    throw new ApiError(410, 'This upload session is no longer active.', 'UPLOAD_SESSION_EXPIRED');
  }

  if (initial.status === 'confirming') {
    throw new ApiError(
      409,
      'This upload is already being confirmed. Retry in a moment.',
      'UPLOAD_CONFIRM_IN_PROGRESS',
    );
  }

  const now = new Date();
  if (initial.expiresAt.getTime() <= now.getTime()) {
    // Claim the expiry transition so concurrent confirm requests cannot release
    // the same reservation more than once.
    const expired = await UploadSessionModel.findOneAndUpdate(
      { _id: initial._id, owner: ownerId, status: 'pending', expiresAt: { $lte: now } },
      {
        $set: {
          status: 'expired',
          failureReason: 'Upload session expired.',
        },
      },
      { returnDocument: 'after' },
    );
    if (expired) await releaseStorage(ownerId, expired.reservedBytes);
    throw new ApiError(410, 'This upload session has expired.', 'UPLOAD_SESSION_EXPIRED');
  }

  // Only one request may verify and materialize a session. This prevents two
  // confirmations from racing to create the same file and deleting each
  // other's Cloudinary asset.
  const session = await UploadSessionModel.findOneAndUpdate(
    {
      _id: initial._id,
      owner: ownerId,
      status: 'pending',
      expiresAt: { $gt: now },
    },
    { $set: { status: 'confirming' } },
    { returnDocument: 'after' },
  );
  if (!session) {
    const current = await UploadSessionModel.findOne({ _id: initial._id, owner: ownerId });
    if (current?.status === 'completed' && current.file) {
      const existing = await FileModel.findById(current.file);
      if (existing) return toFileDto(existing);
    }
    if (current?.status === 'confirming') {
      throw new ApiError(
        409,
        'This upload is already being confirmed. Retry in a moment.',
        'UPLOAD_CONFIRM_IN_PROGRESS',
      );
    }
    throw new ApiError(410, 'This upload session is no longer active.', 'UPLOAD_SESSION_EXPIRED');
  }

  let asset;
  try {
    asset = await verifyUploadedAsset(
      session.cloudinaryPublicId,
      session.cloudinaryResourceType,
    );
  } catch (error) {
    // A transient Cloudinary failure should not strand the session; restore it
    // so the client can retry the confirmation.
    await UploadSessionModel.updateOne(
      { _id: session._id, status: 'confirming' },
      { $set: { status: 'pending' } },
    );
    throw error;
  }

  if (asset.publicId !== session.cloudinaryPublicId) {
    await failUploadSession(
      session,
      session.reservedBytes,
      'The uploaded asset did not match the session.',
    );
    throw ApiError.badRequest('The uploaded asset does not match this upload session.');
  }

  if (asset.bytes <= 0) {
    await failUploadSession(
      session,
      session.reservedBytes,
      'Cloudinary reported an empty uploaded file.',
    );
    throw ApiError.badRequest('Cloudinary reported an empty uploaded file.');
  }

  const sizeLimit = sizeLimitFor(session.mediaType);
  if (asset.bytes > sizeLimit) {
    await failUploadSession(
      session,
      session.reservedBytes,
      'Uploaded file exceeded the size limit.',
    );
    throw ApiError.tooLarge('The uploaded file exceeds the size limit for its type.');
  }

  let adjustedReserved = session.reservedBytes;
  if (asset.bytes > session.reservedBytes) {
    const extra = asset.bytes - session.reservedBytes;
    const extraReserved = await reserveStorage(ownerId, extra);
    if (!extraReserved) {
      await failUploadSession(
        session,
        session.reservedBytes,
        'Storage quota was exceeded after upload verification.',
      );
      throw new ApiError(
        413,
        'Your storage quota does not have room for this file.',
        'STORAGE_QUOTA_EXCEEDED',
      );
    }
    adjustedReserved = asset.bytes;
  } else if (asset.bytes < session.reservedBytes) {
    await releaseStorage(ownerId, session.reservedBytes - asset.bytes);
    adjustedReserved = asset.bytes;
  }

  try {
    await assertItemNameAvailable(
      { owner: ownerId, parentKey: session.parentKey },
      session.nameKey,
    );
  } catch (error) {
    await failUploadSession(session, adjustedReserved, 'Name conflict after upload.');
    throw error;
  }

  let file;
  try {
    file = await FileModel.create({
      owner: ownerId,
      folder: session.folder,
      parentKey: session.parentKey,
      name: session.fileName,
      nameKey: session.nameKey,
      extension: session.extension,
      mimeType: session.mimeType,
      mediaType: session.mediaType,
      sizeBytes: asset.bytes,
      cloudinaryPublicId: session.cloudinaryPublicId,
      cloudinaryResourceType: session.cloudinaryResourceType,
      deliveryType: session.deliveryType,
      format: asset.format,
      version: asset.version,
      etag: asset.etag,
      width: asset.width,
      height: asset.height,
      duration: asset.duration,
    });
  } catch (error) {
    await failUploadSession(session, adjustedReserved, 'Could not save file metadata.');
    throw error;
  }

  session.status = 'completed';
  session.file = file._id;
  session.completedAt = new Date();
  await session.save();

  await recordActivity({
    owner: ownerId,
    type: 'file_uploaded',
    file: file.id,
    metadata: { name: file.name, sizeBytes: file.sizeBytes, mediaType: file.mediaType },
  });

  logger.info(
    { userId: ownerId, fileId: file.id, sizeBytes: file.sizeBytes },
    'File upload confirmed',
  );
  return toFileDto(file);
}

export interface FileListResult {
  files: FileDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export async function listFiles(ownerId: string, query: ListFilesQuery): Promise<FileListResult> {
  const folder = await getFolderForOwner(ownerId, query.folderId);
  const filter: QueryFilter<FileRecord> = {
    owner: ownerId,
    folder: folder?._id ?? null,
    deletedAt: { $exists: false },
  };

  if (query.search) {
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.name = { $regex: escaped, $options: 'i' };
  }
  if (query.mediaType) filter.mediaType = query.mediaType;
  if (typeof query.favorite === 'boolean') filter.isFavorite = query.favorite;

  const sort: Record<string, 1 | -1> = { [query.sort]: query.order === 'asc' ? 1 : -1 };
  if (query.sort !== 'createdAt') sort.createdAt = -1;

  const skip = (query.page - 1) * query.limit;
  const [files, total] = await Promise.all([
    FileModel.find(filter).sort(sort).skip(skip).limit(query.limit),
    FileModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / query.limit);
  return {
    files: files.map(toFileDto),
    page: query.page,
    limit: query.limit,
    total,
    totalPages,
    hasNextPage: query.page < totalPages,
  };
}

export async function getFile(ownerId: string, fileId: string): Promise<FileDto> {
  const file = await getFileForOwner(ownerId, fileId);
  return toFileDto(file);
}

export async function getFileDownload(
  ownerId: string,
  fileId: string,
  mode: 'download' | 'preview',
): Promise<{ url: string; expiresAt: Date; file: FileDto }> {
  const file = await getFileForOwner(ownerId, fileId);
  const signed = buildPrivateDownloadUrl(
    {
      publicId: file.cloudinaryPublicId,
      resourceType: file.cloudinaryResourceType,
      format: file.format,
      version: file.version,
      deliveryType: file.deliveryType,
    },
    { expiresInSeconds: 300, attachment: mode === 'download' },
  );

  let resultFile = file;
  if (mode === 'download') {
    const now = new Date();
    resultFile =
      (await FileModel.findOneAndUpdate(
        { _id: file._id, owner: ownerId },
        { $inc: { downloadCount: 1 }, $set: { lastAccessedAt: now } },
        { returnDocument: 'after' },
      )) ?? file;
    await recordActivity({
      owner: ownerId,
      type: 'file_downloaded',
      file: file.id,
      metadata: { name: file.name, sizeBytes: file.sizeBytes },
    });
  }

  return { url: signed.url, expiresAt: signed.expiresAt, file: toFileDto(resultFile) };
}

export async function renameFile(
  ownerId: string,
  fileId: string,
  input: RenameFileInput,
): Promise<FileDto> {
  const file = await getFileForOwner(ownerId, fileId);
  const name = normalizeFileName(input.name);
  const nameKey = nameKeyFor(name);

  if (nameKey !== file.nameKey) {
    await assertItemNameAvailable(
      { owner: ownerId, parentKey: file.parentKey, excludeFileId: file._id },
      nameKey,
    );
  }

  const previousName = file.name;
  file.name = name;
  file.nameKey = nameKey;
  file.extension = getExtension(name, file.mimeType);
  await file.save();

  await recordActivity({
    owner: ownerId,
    type: 'file_renamed',
    file: file.id,
    metadata: { from: previousName, to: name },
  });
  return toFileDto(file);
}

export async function moveFile(
  ownerId: string,
  fileId: string,
  input: MoveFileInput,
): Promise<FileDto> {
  const file = await getFileForOwner(ownerId, fileId);
  const folder = await getFolderForOwner(ownerId, input.folderId);
  const parentKey = folder?.id ?? 'root';

  if (parentKey !== file.parentKey) {
    await assertItemNameAvailable(
      { owner: ownerId, parentKey, excludeFileId: file._id },
      file.nameKey,
    );
  }

  const previousFolder = file.folder?.toString() ?? null;
  file.folder = folder?._id ?? null;
  file.parentKey = parentKey;
  await file.save();

  await recordActivity({
    owner: ownerId,
    type: 'file_moved',
    file: file.id,
    metadata: { fromFolderId: previousFolder, toFolderId: folder?.id ?? null },
  });
  return toFileDto(file);
}

export async function setFileFavorite(
  ownerId: string,
  fileId: string,
  input: FavoriteFileInput,
): Promise<FileDto> {
  const file = await getFileForOwner(ownerId, fileId);
  file.isFavorite = input.isFavorite;
  await file.save();

  await recordActivity({
    owner: ownerId,
    type: input.isFavorite ? 'file_favorited' : 'file_unfavorited',
    file: file.id,
    metadata: { name: file.name },
  });
  return toFileDto(file);
}

export async function trashFile(ownerId: string, fileId: string): Promise<FileDto> {
  const file = await getFileForOwner(ownerId, fileId);
  file.deletedAt = new Date();
  file.trashBatchId = randomUUID();
  await file.save();

  await recordActivity({
    owner: ownerId,
    type: 'file_deleted',
    file: file.id,
    metadata: { name: file.name, sizeBytes: file.sizeBytes },
  });
  return toFileDto(file);
}

export async function restoreFile(ownerId: string, fileId: string): Promise<FileDto> {
  const file = await getFileForOwner(ownerId, fileId, true);
  if (!file.deletedAt) throw ApiError.badRequest('This file is not in the recycle bin.');

  const parent = file.folder
    ? await FolderModel.findOne({
        _id: file.folder,
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

  await recordActivity({
    owner: ownerId,
    type: 'file_restored',
    file: file.id,
    metadata: { name: file.name },
  });
  return toFileDto(file);
}

export async function permanentlyDeleteFile(ownerId: string, fileId: string): Promise<void> {
  const file = await getFileForOwner(ownerId, fileId, true);
  if (!file.deletedAt) {
    throw ApiError.badRequest('Move this file to the recycle bin before deleting it permanently.');
  }

  await deleteCloudinaryAsset(file.cloudinaryPublicId, file.cloudinaryResourceType);
  await ShareModel.deleteMany({ file: file._id });
  await file.deleteOne();
  await releaseStorage(ownerId, file.sizeBytes);

  await recordActivity({
    owner: ownerId,
    type: 'file_permanently_deleted',
    metadata: { name: file.name, sizeBytes: file.sizeBytes },
  });
  logger.info({ userId: ownerId, fileId }, 'File permanently deleted');
}

export async function listTrash(ownerId: string, query: TrashListQuery): Promise<FileListResult> {
  const filter: QueryFilter<FileRecord> = {
    owner: ownerId,
    deletedAt: { $exists: true },
  };
  const skip = (query.page - 1) * query.limit;
  const [files, total] = await Promise.all([
    FileModel.find(filter).sort({ deletedAt: -1 }).skip(skip).limit(query.limit),
    FileModel.countDocuments(filter),
  ]);
  const totalPages = Math.ceil(total / query.limit);

  return {
    files: files.map(toFileDto),
    page: query.page,
    limit: query.limit,
    total,
    totalPages,
    hasNextPage: query.page < totalPages,
  };
}

export async function emptyTrash(ownerId: string): Promise<{ deletedCount: number; releasedBytes: number }> {
  const files = await FileModel.find({ owner: ownerId, deletedAt: { $exists: true } });
  let deletedCount = 0;
  let releasedBytes = 0;

  for (const file of files) {
    try {
      await deleteCloudinaryAsset(file.cloudinaryPublicId, file.cloudinaryResourceType);
      await ShareModel.deleteMany({ file: file._id });
      await file.deleteOne();
      releasedBytes += file.sizeBytes;
      deletedCount += 1;
    } catch (error) {
      logger.error({ err: error, fileId: file.id }, 'Failed to permanently delete a trashed file');
    }
  }

  await releaseStorage(ownerId, releasedBytes);
  if (deletedCount > 0) {
    await recordActivity({
      owner: ownerId,
      type: 'file_permanently_deleted',
      metadata: { count: deletedCount, releasedBytes },
    });
  }

  return { deletedCount, releasedBytes };
}

export async function getRecentFiles(ownerId: string, limit = 6): Promise<FileDto[]> {
  const files = await FileModel.find({ owner: ownerId, deletedAt: { $exists: false } })
    .sort({ createdAt: -1 })
    .limit(limit);
  return files.map(toFileDto);
}
