import 'dotenv/config';
import { z } from 'zod';

const boolFromString = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((value) => value === 'true');

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    API_PREFIX: z.string().startsWith('/').default('/api'),
    TRUST_PROXY: boolFromString('false'),
    CLIENT_ORIGINS: z
      .string()
      .default('http://localhost:8081,http://localhost:19006')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    PUBLIC_WEB_BASE_URL: z.string().url().default('http://localhost:4000'),
    APP_DEEP_LINK_SCHEME: z.string().min(1).default('quickdrop'),

    MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/quickdrop'),
    MONGODB_DB_NAME: optionalString,

    JWT_ACCESS_SECRET: z.string().min(32).default('dev-only-access-secret-change-me-please-32'),
    JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),
    JWT_ISSUER: z.string().min(1).default('quickdrop'),
    JWT_AUDIENCE: z.string().min(1).default('quickdrop-api'),
    REFRESH_TOKEN_PEPPER: z
      .string()
      .min(32)
      .default('dev-only-refresh-pepper-change-me-please-32'),
    REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    SHARE_TOKEN_PEPPER: z
      .string()
      .min(32)
      .default('dev-only-share-pepper-change-me-please-32'),
    JWT_SHARE_SECRET: z.string().min(32).default('dev-only-share-secret-change-me-please-32'),
    SHARE_ACCESS_EXPIRES_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
    SHARE_MAX_EXPIRY_DAYS: z.coerce.number().int().min(1).max(3650).default(365),
    SHARE_PASSWORD_MIN_LENGTH: z.coerce.number().int().min(6).max(72).default(6),

    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
    STORAGE_LIMIT_BYTES: z.coerce
      .number()
      .int()
      .min(1024 * 1024)
      .default(5 * 1024 * 1024 * 1024),
    TRASH_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    UPLOAD_SESSION_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
    UPLOAD_SESSION_RETENTION_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    MAINTENANCE_INTERVAL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
    UPLOAD_CHUNK_SIZE_MB: z.coerce.number().int().min(6).max(100).default(10),
    UPLOAD_CHUNK_THRESHOLD_MB: z.coerce.number().int().min(1).max(100).default(20),
    MAX_IMAGE_SIZE_MB: z.coerce.number().int().min(1).max(100).default(25),
    MAX_VIDEO_SIZE_MB: z.coerce.number().int().min(1).max(2048).default(500),
    MAX_DOCUMENT_SIZE_MB: z.coerce.number().int().min(1).max(500).default(100),
    MAX_TEXT_SIZE_MB: z.coerce.number().int().min(1).max(100).default(10),

    CLOUDINARY_CLOUD_NAME: optionalString,
    CLOUDINARY_API_KEY: optionalString,
    CLOUDINARY_API_SECRET: optionalString,
    CLOUDINARY_FOLDER_PREFIX: z.string().min(1).default('quickdrop'),
    CLOUDINARY_UPLOAD_TIMEOUT_MS: z.coerce.number().int().min(1000).default(120000),
    CLOUDINARY_DELIVERY_TYPE: z.enum(['authenticated', 'upload']).default('authenticated'),
    CLOUDINARY_THUMBNAIL_TRANSFORMATION: z
      .string()
      .min(1)
      .default('c_fill,w_400,h_400,q_auto,f_jpg'),

    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    LOG_PRETTY: boolFromString('true'),
    MONGOOSE_DEBUG: boolFromString('false'),

    RATE_LIMIT_GLOBAL_WINDOW_MINUTES: z.coerce.number().int().min(1).default(15),
    RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().min(1).default(300),
    RATE_LIMIT_AUTH_WINDOW_MINUTES: z.coerce.number().int().min(1).default(15),
    RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).default(10),
    RATE_LIMIT_UPLOAD_WINDOW_MINUTES: z.coerce.number().int().min(1).default(60),
    RATE_LIMIT_UPLOAD_MAX: z.coerce.number().int().min(1).default(60),
    RATE_LIMIT_PUBLIC_WINDOW_MINUTES: z.coerce.number().int().min(1).default(1),
    RATE_LIMIT_PUBLIC_MAX: z.coerce.number().int().min(1).default(60),

    RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
    DEV_EXPOSE_RESET_TOKEN: boolFromString('false'),
    EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
    EMAIL_FROM: z.string().min(1).default('QuickDrop <no-reply@example.com>'),
    RESEND_API_KEY: optionalString,

    APPLE_TEAM_ID: optionalString,
    IOS_BUNDLE_ID: z.string().min(1).default('com.quickdrop.app'),
    ANDROID_PACKAGE_NAME: z.string().min(1).default('com.quickdrop.app'),
    ANDROID_SHA256_CERT_FINGERPRINT: optionalString,
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;

    const secretFields = [
      'JWT_ACCESS_SECRET',
      'REFRESH_TOKEN_PEPPER',
      'SHARE_TOKEN_PEPPER',
      'JWT_SHARE_SECRET',
    ] as const;

    for (const field of secretFields) {
      if (value[field].startsWith('dev-only-')) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: 'Production requires a unique secret, not the development default.',
        });
      }
    }

    if (!value.CLOUDINARY_CLOUD_NAME || !value.CLOUDINARY_API_KEY || !value.CLOUDINARY_API_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['CLOUDINARY_CLOUD_NAME'],
        message: 'Cloudinary credentials are required in production.',
      });
    }

    if (!value.PUBLIC_WEB_BASE_URL.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['PUBLIC_WEB_BASE_URL'],
        message: 'PUBLIC_WEB_BASE_URL must use HTTPS in production.',
      });
    }
  });

const parsed = environmentSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('\n');
  // Never print secret values here; only validation messages.
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const isDevelopment = env.NODE_ENV === 'development';
export const clientOrigins = env.CLIENT_ORIGINS;
export const cloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

export type Env = typeof env;
