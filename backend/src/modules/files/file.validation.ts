import { z } from 'zod';
import { ALLOWED_MIME_TYPES, MEDIA_TYPES } from '../../utils/fileTypes';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'A valid identifier is required.');

export const uploadSignSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    mimeType: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .refine((value) => ALLOWED_MIME_TYPES.has(value.toLowerCase()), {
        message: 'This file type is not supported.',
      }),
    sizeBytes: z.coerce.number().int().positive().max(1024 * 1024 * 1024),
    folderId: objectIdSchema.optional(),
  })
  .strict();

export const confirmUploadSchema = z.object({}).strict();

export const listFilesQuerySchema = z
  .object({
    folderId: objectIdSchema.optional(),
    search: z.string().trim().max(200).optional(),
    mediaType: z.enum(MEDIA_TYPES).optional(),
    favorite: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
    sort: z.enum(['name', 'createdAt', 'updatedAt', 'sizeBytes']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict();

export const fileIdParamSchema = z.object({ id: objectIdSchema }).strict();
export const uploadSessionIdParamSchema = z.object({ sessionId: objectIdSchema }).strict();

export const renameFileSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
  })
  .strict();

export const moveFileSchema = z
  .object({
    folderId: objectIdSchema.nullable(),
  })
  .strict();

export const favoriteFileSchema = z
  .object({
    isFavorite: z.boolean(),
  })
  .strict();

export const trashListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict();

export type UploadSignInput = z.infer<typeof uploadSignSchema>;
export type ListFilesQuery = z.infer<typeof listFilesQuerySchema>;
export type RenameFileInput = z.infer<typeof renameFileSchema>;
export type MoveFileInput = z.infer<typeof moveFileSchema>;
export type FavoriteFileInput = z.infer<typeof favoriteFileSchema>;
export type TrashListQuery = z.infer<typeof trashListQuerySchema>;
