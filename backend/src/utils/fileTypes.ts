export const MEDIA_TYPES = [
  'image',
  'video',
  'audio',
  'document',
  'archive',
  'other',
] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

export const CLOUDINARY_RESOURCE_TYPES = ['image', 'video', 'raw'] as const;
export type CloudinaryResourceType = (typeof CLOUDINARY_RESOURCE_TYPES)[number];

const MIME_MEDIA_TYPES: Record<string, MediaType> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'image/heic': 'image',
  'image/heif': 'image',
  'image/bmp': 'image',
  'image/tiff': 'image',
  'image/avif': 'image',
  'video/mp4': 'video',
  'video/quicktime': 'video',
  'video/webm': 'video',
  'video/x-matroska': 'video',
  'video/3gpp': 'video',
  'video/x-msvideo': 'video',
  'audio/mpeg': 'audio',
  'audio/mp4': 'audio',
  'audio/wav': 'audio',
  'audio/x-wav': 'audio',
  'audio/aac': 'audio',
  'audio/ogg': 'audio',
  'audio/webm': 'audio',
  'audio/flac': 'audio',
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'application/vnd.ms-powerpoint': 'document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
  'text/plain': 'document',
  'text/csv': 'document',
  'text/markdown': 'document',
  'text/html': 'document',
  'application/rtf': 'document',
  'application/json': 'document',
  'application/xml': 'document',
  'text/xml': 'document',
  'application/zip': 'archive',
  'application/x-zip-compressed': 'archive',
  'application/x-rar-compressed': 'archive',
  'application/vnd.rar': 'archive',
  'application/x-7z-compressed': 'archive',
  'application/gzip': 'archive',
  'application/x-tar': 'archive',
};

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
  'video/3gpp': '3gp',
  'video/x-msvideo': 'avi',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/webm': 'weba',
  'audio/flac': 'flac',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/markdown': 'md',
  'text/html': 'html',
  'application/rtf': 'rtf',
  'application/json': 'json',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/x-rar-compressed': 'rar',
  'application/vnd.rar': 'rar',
  'application/x-7z-compressed': '7z',
  'application/gzip': 'gz',
  'application/x-tar': 'tar',
};

export const ALLOWED_MIME_TYPES = new Set(Object.keys(MIME_MEDIA_TYPES));

export function getMediaType(mimeType: string): MediaType {
  return MIME_MEDIA_TYPES[mimeType.toLowerCase()] ?? 'other';
}

export function getCloudinaryResourceType(mediaType: MediaType): CloudinaryResourceType {
  if (mediaType === 'image') return 'image';
  if (mediaType === 'video' || mediaType === 'audio') return 'video';
  return 'raw';
}

export function getExtension(fileName: string, mimeType: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot > 0 && lastDot < fileName.length - 1) {
    const extension = fileName
      .slice(lastDot + 1)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    if (extension.length > 0 && extension.length <= 12) return extension;
  }
  return MIME_EXTENSIONS[mimeType.toLowerCase()] ?? 'bin';
}

export function normalizeFileName(input: string): string {
  const cleaned = input
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .slice(0, 255);

  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return 'Untitled';
  }
  return cleaned;
}

export function normalizeFolderName(input: string): string {
  const cleaned = normalizeFileName(input);
  return cleaned.slice(0, 120);
}

export function nameKeyFor(name: string): string {
  return name.normalize('NFKC').toLowerCase();
}

export function maxBytesForMedia(mediaType: MediaType, limits: {
  image: number;
  video: number;
  document: number;
  text: number;
}): number {
  if (mediaType === 'image') return limits.image;
  if (mediaType === 'video' || mediaType === 'audio') return limits.video;
  if (mediaType === 'document' || mediaType === 'archive') return limits.document;
  return limits.text;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
