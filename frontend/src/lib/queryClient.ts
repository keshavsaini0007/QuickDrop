import NetInfo from '@react-native-community/netinfo';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { ApiClientError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiClientError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

let onlineManagerStarted = false;

export function startOnlineManager(): void {
  if (onlineManagerStarted) return;
  onlineManagerStarted = true;
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false && state.isInternetReachable !== false;
      setOnline(online);
    });
  });
}

export const queryKeys = {
  me: ['me'] as const,
  storage: ['storage'] as const,
  files: (folderId: string | null, filters: object) =>
    ['files', folderId, filters] as const,
  folders: (parentId: string | null) => ['folders', parentId] as const,
  folder: (id: string) => ['folder', id] as const,
  file: (id: string) => ['file', id] as const,
  filePreview: (id: string) => ['file-preview', id] as const,
  shares: (filters: object) => ['shares', filters] as const,
  trash: ['trash'] as const,
  activity: (filters: object) => ['activity', filters] as const,
  offline: ['offline'] as const,
};
