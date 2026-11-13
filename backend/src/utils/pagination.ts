import { z } from 'zod';

export const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .passthrough();

export const folderIdQuerySchema = z
  .object({
    folderId: z.string().trim().optional(),
    search: z.string().trim().max(200).optional(),
    sort: z.enum(['name', 'createdAt', 'updatedAt', 'sizeBytes']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict();

export type PaginationInput = z.infer<typeof paginationSchema>;
export type FolderIdQueryInput = z.infer<typeof folderIdQuerySchema>;
