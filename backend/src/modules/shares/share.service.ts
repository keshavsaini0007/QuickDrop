import bcrypt from 'bcryptjs';
import type { QueryFilter } from 'mongoose';
import { env } from '../../config/environment';
import { recordActivity } from '../activities/activity.service';
import { FileModel, type FileDocument } from '../files/file.model';
import { toPublicFileDto, type PublicFileDto } from '../files/file.dto';
import { UserModel } from '../users/user.model';
import { ApiError } from '../../utils/apiError';
import { generateOpaqueToken } from '../../utils/crypto';
import { buildPrivateDownloadUrl } from '../../utils/cloudinaryAssets';
import {
  hashShareToken,
  isTokenExpiredError,
  signShareAccessToken,
  verifyShareAccessToken,
} from '../auth/token.service';
import { ShareModel, type Share, type ShareDocument } from './share.model';
import { toShareDto, type ShareDto } from './share.dto';
import type {
  CreateShareInput,
  ShareListQuery,
  UnlockShareInput,
} from './share.validation';

export interface CreatedShareResult {
  share: ShareDto;
  token: string;
  url: string;
}

export interface PublicShareInfo {
  ownerName: string;
  share: ShareDto;
  file: PublicFileDto;
}

export interface ShareAccessResult {
  accessToken: string;
  expiresAt: Date;
  share: ShareDto;
  file: PublicFileDto;
}

export interface SharedDownloadResult {
  url: string;
  expiresAt: Date;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  share: ShareDto;
}

function shareUrlFor(rawToken: string): string {
  return `${env.PUBLIC_WEB_BASE_URL.replace(/\/+$/, '')}/s/${encodeURIComponent(rawToken)}`;
}

function assertShareUsable(share: ShareDocument): void {
  if (share.revokedAt) {
    throw new ApiError(410, 'This share link has been revoked.', 'SHARE_REVOKED');
  }
  if (share.expiresAt && share.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(410, 'This share link has expired.', 'SHARE_EXPIRED');
  }
  if (share.maxDownloads && share.downloadCount >= share.maxDownloads) {
    throw new ApiError(
      410,
      'This share link has reached its download limit.',
      'SHARE_DOWNLOAD_LIMIT_REACHED',
    );
  }
}

async function getActiveShareByToken(
  rawToken: string,
): Promise<{ share: ShareDocument; file: FileDocument }> {
  const share = await ShareModel.findOne({ tokenHash: hashShareToken(rawToken) }).select(
    '+passwordHash',
  );
  if (!share) {
    throw ApiError.notFound('This share link is not valid.');
  }
  assertShareUsable(share);

  const file = await FileModel.findOne({
    _id: share.file,
    owner: share.owner,
    deletedAt: { $exists: false },
  });
  if (!file) {
    throw ApiError.notFound('The shared file is no longer available.');
  }

  return { share, file };
}

async function getShareForOwner(ownerId: string, shareId: string): Promise<ShareDocument> {
  const share = await ShareModel.findOne({ _id: shareId, owner: ownerId }).select(
    '+passwordHash',
  );
  if (!share) throw ApiError.notFound('Share link not found.');
  return share;
}

export async function createShare(
  ownerId: string,
  input: CreateShareInput,
): Promise<CreatedShareResult> {
  const file = await FileModel.findOne({
    _id: input.fileId,
    owner: ownerId,
    deletedAt: { $exists: false },
  });
  if (!file) throw ApiError.notFound('File not found.');

  const rawToken = generateOpaqueToken(32);
  const passwordHash = input.password
    ? await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS)
    : undefined;
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : undefined;

  const share = await ShareModel.create({
    owner: ownerId,
    file: file._id,
    tokenHash: hashShareToken(rawToken),
    ...(passwordHash ? { passwordHash } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    ...(input.maxDownloads ? { maxDownloads: input.maxDownloads } : {}),
  });

  await recordActivity({
    owner: ownerId,
    type: 'share_created',
    file: file.id,
    share: share.id,
    metadata: { name: file.name, hasPassword: Boolean(passwordHash) },
  });

  return {
    share: toShareDto(share, file.name),
    token: rawToken,
    url: shareUrlFor(rawToken),
  };
}

export interface ShareListResult {
  shares: ShareDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export async function listShares(
  ownerId: string,
  query: ShareListQuery,
): Promise<ShareListResult> {
  const filter: QueryFilter<Share> = {
    owner: ownerId,
    ...(query.fileId ? { file: query.fileId } : {}),
  };
  const skip = (query.page - 1) * query.limit;
  const [shares, total] = await Promise.all([
    ShareModel.find(filter)
      .select('+passwordHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit),
    ShareModel.countDocuments(filter),
  ]);

  const files = await FileModel.find({
    _id: { $in: shares.map((share) => share.file) },
    owner: ownerId,
  }).select('name');
  const fileNames = new Map(files.map((file) => [file.id, file.name]));
  const totalPages = Math.ceil(total / query.limit);

  return {
    shares: shares.map((share) => toShareDto(share, fileNames.get(share.file.toString()))),
    page: query.page,
    limit: query.limit,
    total,
    totalPages,
    hasNextPage: query.page < totalPages,
  };
}

export async function revokeShare(ownerId: string, shareId: string): Promise<ShareDto> {
  const share = await getShareForOwner(ownerId, shareId);
  if (!share.revokedAt) {
    share.revokedAt = new Date();
    await share.save();
    await recordActivity({
      owner: ownerId,
      type: 'share_revoked',
      file: share.file,
      share: share.id,
      metadata: { shareId: share.id },
    });
  }
  return toShareDto(share);
}

export async function regenerateShare(
  ownerId: string,
  shareId: string,
): Promise<CreatedShareResult> {
  const share = await getShareForOwner(ownerId, shareId);
  if (share.revokedAt) {
    throw ApiError.badRequest('A revoked share link cannot be regenerated.');
  }

  const file = await FileModel.findOne({
    _id: share.file,
    owner: ownerId,
    deletedAt: { $exists: false },
  });
  if (!file) throw ApiError.notFound('The shared file is no longer available.');

  const rawToken = generateOpaqueToken(32);
  share.tokenHash = hashShareToken(rawToken);
  share.downloadCount = 0;
  share.lastAccessedAt = undefined;
  await share.save();

  await recordActivity({
    owner: ownerId,
    type: 'share_regenerated',
    file: file.id,
    share: share.id,
    metadata: { shareId: share.id },
  });

  return {
    share: toShareDto(share, file.name),
    token: rawToken,
    url: shareUrlFor(rawToken),
  };
}

export async function getPublicShareInfo(rawToken: string): Promise<PublicShareInfo> {
  const { share, file } = await getActiveShareByToken(rawToken);
  const owner = await UserModel.findById(share.owner).select('name');

  return {
    ownerName: owner?.name ?? 'QuickDrop user',
    share: toShareDto(share, file.name),
    file: toPublicFileDto(file),
  };
}

export async function unlockShare(
  rawToken: string,
  input: UnlockShareInput,
): Promise<ShareAccessResult> {
  const { share, file } = await getActiveShareByToken(rawToken);

  if (share.passwordHash) {
    if (!input.password) {
      throw new ApiError(
        401,
        'This share link is password protected.',
        'SHARE_PASSWORD_REQUIRED',
      );
    }
    const matches = await bcrypt.compare(input.password, share.passwordHash);
    if (!matches) {
      throw new ApiError(401, 'The share password is incorrect.', 'SHARE_PASSWORD_INVALID');
    }
  }

  const access = signShareAccessToken({
    ownerId: share.owner.toString(),
    shareId: share.id,
    fileId: file.id,
  });

  return {
    accessToken: access.token,
    expiresAt: access.expiresAt,
    share: toShareDto(share, file.name),
    file: toPublicFileDto(file),
  };
}

export async function downloadSharedFile(
  rawToken: string,
  accessToken: string,
): Promise<SharedDownloadResult> {
  const { share, file } = await getActiveShareByToken(rawToken);

  let payload;
  try {
    payload = verifyShareAccessToken(accessToken);
  } catch (error) {
    if (isTokenExpiredError(error)) {
      throw new ApiError(401, 'The share access has expired.', 'SHARE_ACCESS_EXPIRED');
    }
    throw new ApiError(401, 'The share access token is invalid.', 'SHARE_ACCESS_INVALID');
  }

  if (
    payload.shareId !== share.id ||
    payload.fileId !== file.id ||
    payload.sub !== share.owner.toString()
  ) {
    throw new ApiError(401, 'The share access token is invalid.', 'SHARE_ACCESS_INVALID');
  }

  const signed = buildPrivateDownloadUrl(
    {
      publicId: file.cloudinaryPublicId,
      resourceType: file.cloudinaryResourceType,
      format: file.format,
      version: file.version,
      deliveryType: file.deliveryType,
    },
    { expiresInSeconds: 300, attachment: true },
  );

  const now = new Date();
  const updated = await ShareModel.findOneAndUpdate(
    {
      _id: share._id,
      revokedAt: { $exists: false },
      $and: [
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: now } },
          ],
        },
        {
          $or: [
            { maxDownloads: { $exists: false } },
            { $expr: { $lt: ['$downloadCount', '$maxDownloads'] } },
          ],
        },
      ],
    },
    { $inc: { downloadCount: 1 }, $set: { lastAccessedAt: now } },
    { returnDocument: 'after' },
  );

  if (!updated) {
    throw new ApiError(
      410,
      'This share link can no longer be downloaded.',
      'SHARE_DOWNLOAD_LIMIT_REACHED',
    );
  }

  await recordActivity({
    owner: share.owner,
    type: 'file_downloaded',
    file: file.id,
    share: share.id,
    metadata: { name: file.name, sizeBytes: file.sizeBytes, viaShare: true },
  });

  const shareDto = toShareDto(share, file.name);
  shareDto.downloadCount = updated.downloadCount;
  shareDto.lastAccessedAt = updated.lastAccessedAt
    ? updated.lastAccessedAt.toISOString()
    : null;

  return {
    url: signed.url,
    expiresAt: signed.expiresAt,
    fileName: file.name,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    share: shareDto,
  };
}
