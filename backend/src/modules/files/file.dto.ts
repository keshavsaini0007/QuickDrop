import type { FileDocument } from './file.model';
import { buildThumbnailUrl } from '../../utils/cloudinaryAssets';
import type { MediaType } from '../../utils/fileTypes';

export type PreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'other';

export interface FileDto {
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

export function previewKindFor(file: Pick<FileDocument, 'mediaType' | 'mimeType'>): PreviewKind {
  if (file.mediaType === 'image') return 'image';
  if (file.mediaType === 'video') return 'video';
  if (file.mediaType === 'audio') return 'audio';
  if (file.mimeType === 'application/pdf') return 'pdf';
  if (file.mediaType === 'document' && file.mimeType.startsWith('text/')) return 'text';
  return 'other';
}

export function toFileDto(file: FileDocument): FileDto {
  return {
    id: file.id,
    name: file.name,
    extension: file.extension,
    mimeType: file.mimeType,
    mediaType: file.mediaType,
    sizeBytes: file.sizeBytes,
    folderId: file.folder ? file.folder.toString() : null,
    isFavorite: file.isFavorite,
    thumbnailUrl: buildThumbnailUrl({
      publicId: file.cloudinaryPublicId,
      resourceType: file.cloudinaryResourceType,
      version: file.version,
      deliveryType: file.deliveryType,
    }),
    width: file.width,
    height: file.height,
    duration: file.duration,
    downloadCount: file.downloadCount,
    previewKind: previewKindFor(file),
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
    ...(file.deletedAt ? { deletedAt: file.deletedAt.toISOString() } : {}),
  };
}

export interface PublicFileDto {
  name: string;
  extension: string;
  mimeType: string;
  mediaType: MediaType;
  sizeBytes: number;
  thumbnailUrl: string | null;
  previewKind: PreviewKind;
}

export function toPublicFileDto(file: FileDocument): PublicFileDto {
  return {
    name: file.name,
    extension: file.extension,
    mimeType: file.mimeType,
    mediaType: file.mediaType,
    sizeBytes: file.sizeBytes,
    thumbnailUrl: buildThumbnailUrl({
      publicId: file.cloudinaryPublicId,
      resourceType: file.cloudinaryResourceType,
      version: file.version,
      deliveryType: file.deliveryType,
    }),
    previewKind: previewKindFor(file),
  };
}
