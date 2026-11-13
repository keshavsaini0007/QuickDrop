import { v2 as cloudinary } from 'cloudinary';
import { env, cloudinaryConfigured } from './environment';
import { logger } from './logger';
import { ApiError } from '../utils/apiError';

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export interface CloudinaryConnectionStatus {
  configured: boolean;
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

let cachedStatus: { value: CloudinaryConnectionStatus; expiresAt: number } | undefined;
let inFlightCheck: Promise<CloudinaryConnectionStatus> | undefined;

export function assertCloudinaryConfigured(): void {
  if (!cloudinaryConfigured) {
    throw new ApiError(
      503,
      'Cloudinary is not configured on the server.',
      'CLOUDINARY_NOT_CONFIGURED',
    );
  }
}

export async function checkCloudinaryConnection(force = false): Promise<CloudinaryConnectionStatus> {
  if (!cloudinaryConfigured) {
    return { configured: false, ok: false, error: 'not_configured' };
  }

  const now = Date.now();
  if (!force && cachedStatus && cachedStatus.expiresAt > now) {
    return cachedStatus.value;
  }

  if (!force && inFlightCheck) {
    return inFlightCheck;
  }

  inFlightCheck = (async () => {
    const startedAt = Date.now();
    try {
      const timeout = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Cloudinary ping timed out'));
        }, 5000);
        timer.unref?.();
      });
      await Promise.race([cloudinary.api.ping(), timeout]);
      const value: CloudinaryConnectionStatus = {
        configured: true,
        ok: true,
        latencyMs: Date.now() - startedAt,
      };
      cachedStatus = { value, expiresAt: Date.now() + 30000 };
      return value;
    } catch (error) {
      const value: CloudinaryConnectionStatus = {
        configured: true,
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Cloudinary check failed',
      };
      cachedStatus = { value, expiresAt: Date.now() + 10000 };
      logger.warn({ err: error }, 'Cloudinary dependency check failed');
      return value;
    } finally {
      inFlightCheck = undefined;
    }
  })();

  return inFlightCheck;
}

export const cloudinarySafeConfig = {
  cloudName: env.CLOUDINARY_CLOUD_NAME
    ? `${env.CLOUDINARY_CLOUD_NAME.slice(0, 3)}***`
    : 'not-configured',
  deliveryType: env.CLOUDINARY_DELIVERY_TYPE,
  folderPrefix: env.CLOUDINARY_FOLDER_PREFIX,
  configured: cloudinaryConfigured,
};

export { cloudinary, cloudinaryConfigured };
export default cloudinary;
