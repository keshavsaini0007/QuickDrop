import { useInfiniteQuery, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type {
  ActivityItem,
  FileDownload,
  FileItem,
  FolderDetails,
  FolderItem,
  ShareItem,
  StorageDashboard,
  TrashData,
} from '@/types/api';
import { apiGet, apiGetPaginated } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';
import { listOfflineFiles, type OfflineFile } from '@/lib/offline';

export interface FileFilters {
  search?: string;
  mediaType?: string;
  favorite?: boolean;
  sort?: 'name' | 'createdAt' | 'updatedAt' | 'sizeBytes';
  order?: 'asc' | 'desc';
}

export function useFiles(folderId: string | null, filters: FileFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.files(folderId, filters),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const result = await apiGetPaginated<FileItem[]>('/files', {
        params: {
          page: pageParam,
          limit: 30,
          ...(folderId ? { folderId } : {}),
          ...(filters.search ? { search: filters.search } : {}),
          ...(filters.mediaType ? { mediaType: filters.mediaType } : {}),
          ...(typeof filters.favorite === 'boolean' ? { favorite: filters.favorite } : {}),
          ...(filters.sort ? { sort: filters.sort } : {}),
          ...(filters.order ? { order: filters.order } : {}),
        },
      });
      return {
        data: result.data,
        meta: {
          page: result.meta.page,
          hasNextPage: result.meta.hasNextPage,
          total: result.meta.total,
        },
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.page + 1 : undefined,
  });
}

export function flattenFiles(
  result: ReturnType<typeof useFiles>,
): FileItem[] {
  return result.data?.pages.flatMap((page) => page.data) ?? [];
}

export function useFolders(parentId: string | null): UseQueryResult<FolderItem[], Error> {
  return useQuery({
    queryKey: queryKeys.folders(parentId),
    queryFn: async () => {
      const result = await apiGetPaginated<FolderItem[]>('/folders', {
        params: { parentId: parentId ?? undefined, page: 1, limit: 100 },
      });
      return result.data;
    },
  });
}

export function useFolder(id: string): UseQueryResult<FolderDetails, Error> {
  return useQuery({
    queryKey: queryKeys.folder(id),
    queryFn: () => apiGet<FolderDetails>(`/folders/${id}`),
    enabled: Boolean(id),
  });
}

export function useFile(id: string): UseQueryResult<FileItem, Error> {
  return useQuery({
    queryKey: queryKeys.file(id),
    queryFn: () => apiGet<FileItem>(`/files/${id}`),
    enabled: Boolean(id),
  });
}

export function useFilePreview(id: string, enabled = true): UseQueryResult<FileDownload, Error> {
  return useQuery({
    queryKey: queryKeys.filePreview(id),
    queryFn: () => apiGet<FileDownload>(`/files/${id}/preview`),
    enabled: Boolean(id) && enabled,
    staleTime: 60_000,
  });
}

export function useStorage(): UseQueryResult<StorageDashboard, Error> {
  return useQuery({
    queryKey: queryKeys.storage,
    queryFn: () => apiGet<StorageDashboard>('/storage'),
  });
}

export function useShares(): UseQueryResult<ShareItem[], Error> {
  return useQuery({
    queryKey: queryKeys.shares({ limit: 50 }),
    queryFn: async () => {
      const result = await apiGetPaginated<ShareItem[]>('/shares', {
        params: { page: 1, limit: 50 },
      });
      return result.data;
    },
  });
}

export function useTrash(): UseQueryResult<TrashData, Error> {
  return useQuery({
    queryKey: queryKeys.trash,
    queryFn: () => apiGet<TrashData>('/trash', { params: { page: 1, limit: 100 } }),
  });
}

export function useActivity(limit = 50): UseQueryResult<ActivityItem[], Error> {
  return useQuery({
    queryKey: queryKeys.activity({ limit }),
    queryFn: async () => {
      const result = await apiGetPaginated<ActivityItem[]>('/activities', {
        params: { page: 1, limit },
      });
      return result.data;
    },
  });
}

export function useOfflineFiles(): UseQueryResult<OfflineFile[], Error> {
  return useQuery({
    queryKey: queryKeys.offline,
    queryFn: listOfflineFiles,
    staleTime: 0,
  });
}

async function fetchAllFolders(
  parentId: string | null,
  depth: number,
  seen: Set<string>,
): Promise<FolderItem[]> {
  if (depth > 12) return [];
  const result = await apiGetPaginated<FolderItem[]>('/folders', {
    params: { parentId: parentId ?? undefined, page: 1, limit: 100 },
  });
  const folders: FolderItem[] = [];
  for (const folder of result.data) {
    if (seen.has(folder.id)) continue;
    seen.add(folder.id);
    folders.push(folder);
    folders.push(...(await fetchAllFolders(folder.id, depth + 1, seen)));
  }
  return folders;
}

export function useAllFolders(enabled = true): UseQueryResult<FolderItem[], Error> {
  return useQuery({
    queryKey: ['folders', 'all'],
    queryFn: () => fetchAllFolders(null, 0, new Set()),
    enabled,
  });
}
