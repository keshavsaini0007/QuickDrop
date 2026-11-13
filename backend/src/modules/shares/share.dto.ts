import type { ShareDocument } from './share.model';

export interface ShareDto {
  id: string;
  fileId: string;
  fileName?: string;
  hasPassword: boolean;
  expiresAt: string | null;
  maxDownloads: number | null;
  downloadCount: number;
  lastAccessedAt: string | null;
  revokedAt: string | null;
  isExpired: boolean;
  isRevoked: boolean;
  createdAt: string;
}

export function toShareDto(share: ShareDocument, fileName?: string): ShareDto {
  const now = Date.now();
  return {
    id: share.id,
    fileId: share.file.toString(),
    ...(fileName ? { fileName } : {}),
    hasPassword: Boolean(share.passwordHash),
    expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
    maxDownloads: share.maxDownloads ?? null,
    downloadCount: share.downloadCount,
    lastAccessedAt: share.lastAccessedAt ? share.lastAccessedAt.toISOString() : null,
    revokedAt: share.revokedAt ? share.revokedAt.toISOString() : null,
    isExpired: Boolean(share.expiresAt && share.expiresAt.getTime() <= now),
    isRevoked: Boolean(share.revokedAt),
    createdAt: share.createdAt.toISOString(),
  };
}
