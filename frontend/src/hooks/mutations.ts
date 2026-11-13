import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreatedShare, FileItem, FolderItem, ShareItem } from '@/types/api';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';

async function invalidateVault(queryClient: ReturnType<typeof useQueryClient>): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['files'] }),
    queryClient.invalidateQueries({ queryKey: ['folders'] }),
    queryClient.invalidateQueries({ queryKey: ['folder'] }),
    queryClient.invalidateQueries({ queryKey: ['file'] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.storage }),
    queryClient.invalidateQueries({ queryKey: queryKeys.trash }),
    queryClient.invalidateQueries({ queryKey: ['activity'] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.me }),
  ]);
}

export function useRenameFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiPatch<FileItem>(`/files/${id}`, { name }),
    onSuccess: async () => invalidateVault(queryClient),
  });
}

export function useMoveFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string | null }) =>
      apiPatch<FileItem>(`/files/${id}/move`, { folderId }),
    onSuccess: async () => invalidateVault(queryClient),
  });
}

export function useFavoriteFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      apiPatch<FileItem>(`/files/${id}/favorite`, { isFavorite }),
    onSuccess: async (file) => {
      queryClient.setQueryData(queryKeys.file(file.id), file);
      await invalidateVault(queryClient);
    },
  });
}

export function useTrashFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<FileItem>(`/files/${id}`),
    onSuccess: async () => invalidateVault(queryClient),
  });
}

export function useRestoreFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<FileItem>(`/files/${id}/restore`, {}),
    onSuccess: async () => invalidateVault(queryClient),
  });
}

export function usePermanentlyDeleteFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<null>(`/files/${id}/permanent`),
    onSuccess: async () => invalidateVault(queryClient),
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: string | null }) =>
      apiPost<FolderItem>('/folders', { name, ...(parentId ? { parentId } : {}) }),
    onSuccess: async () => invalidateVault(queryClient),
  });
}

export function useRenameFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiPatch<FolderItem>(`/folders/${id}`, { name }),
    onSuccess: async () => invalidateVault(queryClient),
  });
}

export function useMoveFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) =>
      apiPatch<FolderItem>(`/folders/${id}`, { parentId }),
    onSuccess: async () => invalidateVault(queryClient),
  });
}

export function useTrashFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<FolderItem>(`/folders/${id}`),
    onSuccess: async () => invalidateVault(queryClient),
  });
}

export function useRestoreFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<FolderItem>(`/folders/${id}/restore`, {}),
    onSuccess: async () => invalidateVault(queryClient),
  });
}

export function usePermanentlyDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<null>(`/folders/${id}/permanent`),
    onSuccess: async () => invalidateVault(queryClient),
  });
}

export function useEmptyTrash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete<unknown>('/trash'),
    onSuccess: async () => invalidateVault(queryClient),
  });
}

export function useCreateShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      fileId: string;
      password?: string;
      expiresInDays?: number;
      maxDownloads?: number;
    }) => apiPost<CreatedShare>('/shares', input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['shares'] });
      await queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

export function useRevokeShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<ShareItem>(`/shares/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['shares'] });
      await queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

export function useRegenerateShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<CreatedShare>(`/shares/${id}/regenerate`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['shares'] });
      await queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
