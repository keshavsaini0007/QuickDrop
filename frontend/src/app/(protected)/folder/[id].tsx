import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFolder } from '@/hooks/queries';
import { AppHeader, ErrorState, LoadingState, Screen } from '@/components/ui';
import { FileBrowser } from '@/components/file-browser';

export default function FolderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const folderQuery = useFolder(id);

  if (folderQuery.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <AppHeader title="Folder" showBack onBack={() => router.back()} />
        <LoadingState label="Opening folder…" />
      </Screen>
    );
  }

  if (folderQuery.isError || !folderQuery.data) {
    return (
      <Screen edges={['top', 'bottom']}>
        <AppHeader title="Folder" showBack onBack={() => router.back()} />
        <ErrorState
          message={folderQuery.error?.message ?? 'This folder is no longer available.'}
          onRetry={() => void folderQuery.refetch()}
        />
      </Screen>
    );
  }

  return (
    <FileBrowser
      folderId={folderQuery.data.folder.id}
      title={folderQuery.data.folder.name}
      subtitle="Folder"
      breadcrumbs={folderQuery.data.breadcrumbs}
      showBack
      onBack={() => router.back()}
    />
  );
}
