import type { FolderDocument } from './folder.model';

export interface FolderDto {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface BreadcrumbDto {
  id: string;
  name: string;
}

export function toFolderDto(folder: FolderDocument): FolderDto {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parent ? folder.parent.toString() : null,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
    ...(folder.deletedAt ? { deletedAt: folder.deletedAt.toISOString() } : {}),
  };
}
