import { env } from '../config/environment';
import {
  assertCloudinaryConfigured,
  cloudinary,
  cloudinaryConfigured,
} from '../config/cloudinary';
import type { CloudinaryResourceType } from './fileTypes';
import { ApiError } from './apiError';

export interface AssetReference {
  publicId: string;
  resourceType: CloudinaryResourceType;
  format?: string;
  version?: number;
  deliveryType?: 'authenticated' | 'upload';
}

export interface SignedAssetUrl {
  url: string;
  expiresAt: Date;
}

export function buildPrivateDownloadUrl(
  asset: AssetReference,
  options: { expiresInSeconds?: number; attachment?: boolean } = {},
): SignedAssetUrl {
  assertCloudinaryConfigured();
  const expiresInSeconds = options.expiresInSeconds ?? 300;
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const url = cloudinary.utils.private_download_url(asset.publicId, asset.format ?? '', {
    resource_type: asset.resourceType,
    type: asset.deliveryType ?? env.CLOUDINARY_DELIVERY_TYPE,
    expires_at: expiresAt,
    attachment: options.attachment ?? false,
  });

  return { url, expiresAt: new Date(expiresAt * 1000) };
}

export function buildThumbnailUrl(asset: AssetReference): string | null {
  if (!cloudinaryConfigured) return null;
  if (asset.resourceType === 'raw') return null;

  return cloudinary.url(asset.publicId, {
    resource_type: asset.resourceType,
    type: asset.deliveryType ?? env.CLOUDINARY_DELIVERY_TYPE,
    sign_url: true,
    secure: true,
    version: asset.version,
    format: 'jpg',
    transformation: env.CLOUDINARY_THUMBNAIL_TRANSFORMATION,
  });
}

export interface UploadSignatureInput {
  publicId: string;
  resourceType: CloudinaryResourceType;
  includeEagerThumbnail: boolean;
}

export interface UploadSignature {
  uploadUrl: string;
  params: Record<string, string | number | boolean>;
}

export function createUploadSignature(input: UploadSignatureInput): UploadSignature {
  assertCloudinaryConfigured();
  const timestamp = Math.floor(Date.now() / 1000);
  const eager = input.includeEagerThumbnail ? env.CLOUDINARY_THUMBNAIL_TRANSFORMATION : undefined;
  const params: Record<string, string | number | boolean> = {
    timestamp,
    public_id: input.publicId,
    type: env.CLOUDINARY_DELIVERY_TYPE,
    ...(eager ? { eager } : {}),
  };

  const signature = cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET ?? '');
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${input.resourceType}/upload`,
    params: {
      ...params,
      api_key: env.CLOUDINARY_API_KEY ?? '',
      signature,
    },
  };
}

export interface VerifiedAsset {
  publicId: string;
  resourceType: CloudinaryResourceType;
  format?: string;
  version?: number;
  bytes: number;
  etag?: string;
  width?: number;
  height?: number;
  duration?: number;
}

export async function verifyUploadedAsset(
  publicId: string,
  resourceType: CloudinaryResourceType,
): Promise<VerifiedAsset> {
  assertCloudinaryConfigured();
  try {
    const resource = await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
      type: env.CLOUDINARY_DELIVERY_TYPE,
    });

    return {
      publicId: String(resource.public_id),
      resourceType,
      format: resource.format ? String(resource.format) : undefined,
      version: typeof resource.version === 'number' ? resource.version : undefined,
      bytes: Number(resource.bytes ?? 0),
      etag: resource.etag ? String(resource.etag) : undefined,
      width: typeof resource.width === 'number' ? resource.width : undefined,
      height: typeof resource.height === 'number' ? resource.height : undefined,
      duration: typeof resource.duration === 'number' ? resource.duration : undefined,
    };
  } catch (error) {
    const httpCode =
      typeof error === 'object' && error !== null && 'http_code' in error
        ? Number((error as { http_code?: number }).http_code)
        : undefined;
    if (httpCode === 404) {
      throw ApiError.badRequest('Cloudinary has not received this upload yet.');
    }
    throw ApiError.badGateway('Could not verify the upload with Cloudinary.', 'CLOUDINARY_VERIFY_FAILED');
  }
}

export async function deleteCloudinaryAsset(
  publicId: string,
  resourceType: CloudinaryResourceType,
): Promise<void> {
  assertCloudinaryConfigured();
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: env.CLOUDINARY_DELIVERY_TYPE,
      invalidate: true,
    });
  } catch {
    throw ApiError.badGateway('Could not delete the stored file from Cloudinary.', 'CLOUDINARY_DELETE_FAILED');
  }
}
