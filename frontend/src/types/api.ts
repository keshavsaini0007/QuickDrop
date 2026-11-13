export type UserRole = 'user' | 'admin';
export type MediaType =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'archive'
  | 'other';
export type PreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'other';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  hasAvatar: boolean;
  storageUsedBytes: number;
  storageLimitBytes: number;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface FileItem {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  mediaType: MediaType;
  sizeBytes: number;
  folderId: string | null;
  isFavorite: boolean;
  thumbnailUrl: string | null;
  width?: number;
  height?: number;
  duration?: number;
  downloadCount: number;
  previewKind: PreviewKind;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface Breadcrumb {
  id: string;
  name: string;
}

export interface FolderDetails {
  folder: FolderItem;
  breadcrumbs: Breadcrumb[];
}

export interface ShareItem {
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

export interface CreatedShare {
  share: ShareItem;
  token: string;
  url: string;
}

export interface PublicShareInfo {
  ownerName: string;
  share: ShareItem;
  file: {
    name: string;
    extension: string;
    mimeType: string;
    mediaType: MediaType;
    sizeBytes: number;
    thumbnailUrl: string | null;
    previewKind: PreviewKind;
  };
}

export interface PublicShareAccess {
  accessToken: string;
  expiresAt: string;
  share: ShareItem;
  file: PublicShareInfo['file'];
}

export interface PublicShareDownload {
  url: string;
  expiresAt: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  share: ShareItem;
}

export type ActivityType =
  | 'file_uploaded'
  | 'file_downloaded'
  | 'file_renamed'
  | 'file_moved'
  | 'file_favorited'
  | 'file_unfavorited'
  | 'file_deleted'
  | 'file_restored'
  | 'file_permanently_deleted'
  | 'folder_created'
  | 'folder_renamed'
  | 'folder_moved'
  | 'folder_deleted'
  | 'folder_restored'
  | 'share_created'
  | 'share_revoked'
  | 'share_regenerated'
  | 'profile_updated'
  | 'password_changed'
  | 'avatar_updated';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  fileId: string | null;
  folderId: string | null;
  shareId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
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

export interface StorageDashboard {
  summary: StorageSummary;
  recentFiles: FileItem[];
}

export interface TrashData {
  files: FileItem[];
  folders: FolderItem[];
  totals: { files: number; folders: number; items: number };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface ApiEnvelope<T> {
  success: true;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface UploadSignature {
  sessionId: string;
  uploadUrl: string;
  params: Record<string, string>;
  expiresAt: string;
  uploadMode: 'single' | 'chunked';
  chunkSizeBytes: number;
  uniqueUploadId: string;
  maxSizeBytes: number;
}

export interface FileDownload {
  url: string;
  expiresAt: string;
  file: FileItem;
}

export interface PickedUploadFile {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}
