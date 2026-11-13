import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Breadcrumb, FileItem, FolderItem } from '@/types/api';
import { useFiles, useFolders, flattenFiles } from '@/hooks/queries';
import { useCreateFolder } from '@/hooks/mutations';
import { errorMessage } from '@/lib/api';
import { isPermissionError, openAppSettings } from '@/lib/permissions';
import { pickDocuments, pickPhotosAndVideos, takePhoto } from '@/lib/pickers';
import { useUploadStore } from '@/lib/uploadQueue';
import { useAppTheme } from '@/theme';
import {
  AppHeader,
  AppText,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  OfflineBanner,
  Screen,
} from './ui';
import { FileRow } from './file-row';
import { FolderRow } from './folder-row';
import { FileActionsSheet } from './file-actions-sheet';
import { FolderActionsSheet } from './folder-actions-sheet';
import { PromptDialog } from './prompt-dialog';

type BrowserItem =
  | { kind: 'folder'; folder: FolderItem }
  | { kind: 'file'; file: FileItem };

type Filter = 'all' | 'image' | 'video' | 'document' | 'favorite';

const filterOptions: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'image', label: 'Images' },
  { key: 'video', label: 'Videos' },
  { key: 'document', label: 'Docs' },
  { key: 'favorite', label: 'Favorites' },
];

export function FileBrowser({
  folderId,
  title,
  subtitle,
  breadcrumbs,
  showBack = false,
  onBack,
}: {
  folderId: string | null;
  title: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  showBack?: boolean;
  onBack?: () => void;
}) {
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<'createdAt' | 'name' | 'sizeBytes'>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<FolderItem | null>(null);
  const [folderPrompt, setFolderPrompt] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const enqueue = useUploadStore((state) => state.enqueue);
  const uploadItems = useUploadStore((state) => state.items);
  const createFolder = useCreateFolder();

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const filters = useMemo(
    () => ({
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(filter === 'image' || filter === 'video' || filter === 'document'
        ? { mediaType: filter }
        : {}),
      ...(filter === 'favorite' ? { favorite: true } : {}),
      sort,
      order,
    }),
    [debouncedSearch, filter, order, sort],
  );

  const filesQuery = useFiles(folderId, filters);
  const foldersQuery = useFolders(folderId);
  const files = flattenFiles(filesQuery);
  const showFolders = !debouncedSearch && filter === 'all';

  const items = useMemo<BrowserItem[]>(() => {
    const folderItems: BrowserItem[] = showFolders
      ? (foldersQuery.data ?? []).map((folder) => ({ kind: 'folder', folder }))
      : [];
    const fileItems: BrowserItem[] = files.map((file) => ({ kind: 'file', file }));
    return [...folderItems, ...fileItems];
  }, [files, foldersQuery.data, showFolders]);

  const activeUploads = uploadItems.filter((item) =>
    ['queued', 'signing', 'uploading', 'confirming', 'error'].includes(item.status),
  ).length;

  const refresh = useCallback(async () => {
    await Promise.all([filesQuery.refetch(), foldersQuery.refetch()]);
  }, [filesQuery, foldersQuery]);

  const refreshing = filesQuery.isRefetching || foldersQuery.isRefetching;
  const loading = filesQuery.isLoading || (showFolders && foldersQuery.isLoading);
  const queryError = filesQuery.error ?? (showFolders ? foldersQuery.error : null);

  const addFiles = async (kind: 'library' | 'documents' | 'camera') => {
    try {
      const picked =
        kind === 'library'
          ? await pickPhotosAndVideos()
          : kind === 'camera'
            ? await takePhoto()
            : await pickDocuments();
      if (picked.length) await enqueue(picked, folderId);
    } catch (error) {
      const message = errorMessage(error);
      Alert.alert(
        'Could not add files',
        message,
        isPermissionError(message)
          ? [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open settings', onPress: () => void openAppSettings() },
            ]
          : undefined,
      );
    }
  };

  const openAddMenu = () => {
    Alert.alert('Add to this folder', 'Choose what you want to upload.', [
      { text: 'Photos & videos', onPress: () => void addFiles('library') },
      { text: 'Browse files', onPress: () => void addFiles('documents') },
      { text: 'Take a photo', onPress: () => void addFiles('camera') },
      {
        text: 'New folder',
        onPress: () => {
          setFolderError(null);
          setFolderPrompt(true);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openSortMenu = () => {
    Alert.alert('Sort files', 'Choose a sort order.', [
      {
        text: 'Newest first',
        onPress: () => {
          setSort('createdAt');
          setOrder('desc');
        },
      },
      {
        text: 'Oldest first',
        onPress: () => {
          setSort('createdAt');
          setOrder('asc');
        },
      },
      {
        text: 'Name A–Z',
        onPress: () => {
          setSort('name');
          setOrder('asc');
        },
      },
      {
        text: 'Largest first',
        onPress: () => {
          setSort('sizeBytes');
          setOrder('desc');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const renderItem = ({ item }: { item: BrowserItem }) => {
    if (item.kind === 'folder') {
      return (
        <FolderRow
          folder={item.folder}
          onPress={() => router.push(`/folder/${item.folder.id}`)}
          onMore={() => setSelectedFolder(item.folder)}
        />
      );
    }
    return (
      <FileRow
        file={item.file}
        onPress={() => router.push(`/preview/${item.file.id}`)}
        onMore={() => setSelectedFile(item.file)}
      />
    );
  };

  return (
    <Screen edges={['top']}>
      <AppHeader
        title={title}
        subtitle={subtitle}
        showBack={showBack}
        onBack={onBack}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Upload queue, ${activeUploads} active`}
              onPress={() => router.push('/uploads')}
              style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="cloud-upload-outline" size={23} color={theme.colors.text} />
              {activeUploads > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    right: 4,
                    top: 5,
                    minWidth: 17,
                    height: 17,
                    borderRadius: 9,
                    backgroundColor: theme.colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 3,
                  }}
                >
                  <AppText variant="caption" style={{ color: theme.colors.onPrimary, fontSize: 10 }}>
                    {activeUploads}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
            <IconButton icon="add" label="Add files or folders" onPress={openAddMenu} />
          </View>
        }
      />

      <OfflineBanner />

      {breadcrumbs && breadcrumbs.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, marginBottom: 10 }}
          contentContainerStyle={{ alignItems: 'center', gap: 2 }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open vault root"
            onPress={() => router.push('/(tabs)/files')}
            style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 6 }}
          >
            <AppText variant="small" color="primary">
              My vault
            </AppText>
          </Pressable>
          {breadcrumbs.map((crumb, index) => (
            <View key={crumb.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="chevron-forward" size={13} color={theme.colors.textTertiary} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open folder ${crumb.name}`}
                onPress={() => router.push(`/folder/${crumb.id}`)}
                disabled={index === breadcrumbs.length - 1}
                style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 6 }}
              >
                <AppText
                  variant="small"
                  color={index === breadcrumbs.length - 1 ? 'text' : 'primary'}
                  numberOfLines={1}
                  style={{ maxWidth: 160 }}
                >
                  {crumb.name}
                </AppText>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          paddingHorizontal: 12,
          minHeight: 48,
        }}
      >
        <Ionicons name="search" size={19} color={theme.colors.textTertiary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search this folder"
          placeholderTextColor={theme.colors.textTertiary}
          accessibilityLabel="Search files in this folder"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={[theme.typography.body, { color: theme.colors.text, flex: 1, paddingVertical: 0 }]}
        />
        {search ? (
          <IconButton
            icon="close-circle"
            label="Clear search"
            size={19}
            color="textTertiary"
            onPress={() => setSearch('')}
          />
        ) : null}
        <IconButton
          icon="swap-vertical-outline"
          label="Sort files"
          size={20}
          color="textSecondary"
          onPress={openSortMenu}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginTop: 10, marginBottom: 4 }}
        contentContainerStyle={{ gap: 7, paddingVertical: 2 }}
      >
        {filterOptions.map((option) => {
          const active = filter === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(option.key)}
              style={{
                minHeight: 48,
                justifyContent: 'center',
                paddingHorizontal: 14,
                borderRadius: theme.radii.pill,
                borderWidth: 1,
                borderColor: active ? theme.colors.primary : theme.colors.border,
                backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface,
              }}
            >
              <AppText variant="smallStrong" color={active ? 'primary' : 'textSecondary'}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <LoadingState label="Loading files…" />
      ) : queryError && items.length === 0 ? (
        <ErrorState message={queryError.message} onRetry={() => void refresh()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) =>
            item.kind === 'folder' ? `folder-${item.folder.id}` : `file-${item.file.id}`
          }
          renderItem={renderItem}
          style={{ flex: 1, marginTop: 4 }}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 96,
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (filesQuery.hasNextPage && !filesQuery.isFetchingNextPage) {
              void filesQuery.fetchNextPage();
            }
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressBackgroundColor={theme.colors.surface}
            />
          }
          ListFooterComponent={
            filesQuery.isFetchingNextPage ? (
              <LoadingState label="Loading more files…" />
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon={debouncedSearch || filter !== 'all' ? 'search-outline' : 'folder-open-outline'}
              title={debouncedSearch || filter !== 'all' ? 'No matches' : 'This folder is empty'}
              message={
                debouncedSearch || filter !== 'all'
                  ? 'Try a different search or filter.'
                  : 'Upload files or create a folder to start organising your vault.'
              }
              action={
                debouncedSearch || filter !== 'all' ? undefined : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add files"
                    onPress={openAddMenu}
                    style={{
                      minHeight: 50,
                      borderRadius: theme.radii.md,
                      backgroundColor: theme.colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AppText variant="button" style={{ color: theme.colors.onPrimary }}>
                      Add files
                    </AppText>
                  </Pressable>
                )
              }
            />
          }
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add files or create a folder"
        onPress={openAddMenu}
        style={({ pressed }) => ({
          position: 'absolute',
          right: 18,
          bottom: insets.bottom + 18,
          width: 58,
          height: 58,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.primary,
          opacity: pressed ? 0.82 : 1,
          ...theme.shadows.floating,
        })}
      >
        <Ionicons name="add" size={30} color={theme.colors.onPrimary} />
      </Pressable>

      {folderPrompt ? (
        <PromptDialog
          visible
          title="New folder"
          label="Folder name"
          placeholder="e.g. Project files"
          confirmLabel="Create"
          loading={createFolder.isPending}
          error={folderError}
          onCancel={() => setFolderPrompt(false)}
          onSubmit={(name) => {
            setFolderError(null);
            createFolder.mutate(
              { name, parentId: folderId },
              {
                onSuccess: () => setFolderPrompt(false),
                onError: (error) => setFolderError(errorMessage(error)),
              },
            );
          }}
        />
      ) : null}
      {selectedFile ? (
        <FileActionsSheet
          visible
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      ) : null}
      {selectedFolder ? (
        <FolderActionsSheet
          visible
          folder={selectedFolder}
          onClose={() => setSelectedFolder(null)}
        />
      ) : null}
    </Screen>
  );
}
