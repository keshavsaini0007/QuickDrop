import { z } from 'zod';
import { env } from '../../config/environment';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'A valid identifier is required.');

export const createShareSchema = z
  .object({
    fileId: objectIdSchema,
    password: z
      .string()
      .min(env.SHARE_PASSWORD_MIN_LENGTH)
      .max(72)
      .optional(),
    expiresInDays: z.coerce
      .number()
      .int()
      .min(1)
      .max(env.SHARE_MAX_EXPIRY_DAYS)
      .optional(),
    maxDownloads: z.coerce.number().int().min(1).max(100000).optional(),
  })
  .strict();

export const shareIdParamSchema = z.object({ id: objectIdSchema }).strict();

export const shareListQuerySchema = z
  .object({
    fileId: objectIdSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict();

export const publicShareTokenParamSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(20)
      .max(200)
      .regex(/^[A-Za-z0-9_-]+$/, 'Invalid share token.'),
  })
  .strict();

export const unlockShareSchema = z
  .object({
    password: z.string().max(72).optional(),
  })
  .strict();

export const regenerateShareSchema = z.object({}).strict();

export type CreateShareInput = z.infer<typeof createShareSchema>;
export type ShareListQuery = z.infer<typeof shareListQuerySchema>;
export type UnlockShareInput = z.infer<typeof unlockShareSchema>;
