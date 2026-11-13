import { z } from 'zod';

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'A valid identifier is required.');

export const createFolderSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    parentId: objectIdSchema.optional(),
  })
  .strict();

export const updateFolderSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    parentId: objectIdSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => value.name !== undefined || value.parentId !== undefined, {
    message: 'Provide a name or parent folder to update.',
    path: ['name'],
  });

export const listFoldersQuerySchema = z
  .object({
    parentId: objectIdSchema.optional(),
    search: z.string().trim().max(200).optional(),
    sort: z.enum(['name', 'createdAt', 'updatedAt']).default('name'),
    order: z.enum(['asc', 'desc']).default('asc'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const folderIdParamSchema = z.object({ id: objectIdSchema }).strict();

export const folderTrashQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
export type ListFoldersQuery = z.infer<typeof listFoldersQuerySchema>;
export type FolderTrashQuery = z.infer<typeof folderTrashQuerySchema>;
