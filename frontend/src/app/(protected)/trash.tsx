import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { FileItem, FolderItem } from '@/types/api';
import { useStorage, useTrash } from '@/hooks/queries';
import {
  useEmptyTrash,
  usePermanentlyDeleteFile,
  usePermanentlyDeleteFolder,
  useRestoreFile,
  useRestoreFolder,
} from '@/hooks/mutations';
import { errorMessage } from '@/lib/api';
import { formatBytes, formatDate, pluralize } from '@/lib/format';
import { useAppTheme } from '@/theme';
import {
  AppHeader,
  AppText,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineBanner,
  Screen,
  SectionHeader,
} from '@/components/ui';

type TrashFilter = 'all' | 'files' | 'folders';

function TrashItem({
  name,
  subtitle,
  icon,
  danger,
  onRestore,
  onDelete,
}: {
  name: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: danger ? theme.colors.dangerSoft : theme.colors.surfaceMuted,
        }}
      >
        <Ionicons name={icon} size={21} color={danger ? theme.colors.danger : theme.colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="caption" color="textSecondary" numberOfLines={1} style={{ marginTop: 2 }}>
          {subtitle}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Restore ${name}`}
        onPress={onRestore}
        style={{
          minHeight: 48,
          paddingHorizontal: 11,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText variant="caption" color="primary" style={{ fontWeight: '700' }}>
          Restore
        </AppText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Permanently delete ${name}`}
        onPress={onDelete}
        style={{
          width: 48,
          height: 48,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.dangerSoft,
        }}
      >
        <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
      </Pressable>
    </View>
  );
}

export default function TrashScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const trashQuery = useTrash();
  const storage = useStorage();
  const restoreFile = useRestoreFile();
  const restoreFolder = useRestoreFolder();
  const deleteFile = usePermanentlyDeleteFile();
  const deleteFolder = usePermanentlyDeleteFolder();
  const emptyTrash = useEmptyTrash();
  const [filter, setFilter] = useState<TrashFilter>('all');

  const data = trashQuery.data;
  const files = data?.files ?? [];
  const folders = data?.folders ?? [];
  const total = (data?.totals.items ?? 0);
  const trashBytes = storage.data?.summary.trash.bytes ?? 0;

  const confirmRestoreFile = (file: FileItem) =>
    restoreFile.mutate(file.id, {
      onError: (error) => Alert.alert('Could not restore file', errorMessage(error)),
    });

  const confirmRestoreFolder = (folder: FolderItem) =>
    restoreFolder.mutate(folder.id, {
      onError: (error) => Alert.alert('Could not restore folder', errorMessage(error)),
    });

  const confirmDeleteFile = (file: FileItem) =>
    Alert.alert(
      'Delete forever?',
      `${file.name} will be removed from Cloudinary and cannot be recovered.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: () =>
            deleteFile.mutate(file.id, {
              onError: (error) => Alert.alert('Could not delete file', errorMessage(error)),
            }),
        },
      ],
    );

  const confirmDeleteFolder = (folder: FolderItem) =>
    Alert.alert(
      'Delete folder forever?',
      `${folder.name} and every file inside it will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: () =>
            deleteFolder.mutate(folder.id, {
              onError: (error) => Alert.alert('Could not delete folder', errorMessage(error)),
            }),
        },
      ],
    );

  const confirmEmpty = () =>
    Alert.alert(
      'Empty recycle bin?',
      'Every item in the recycle bin will be permanently deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Empty bin',
          style: 'destructive',
          onPress: () =>
            emptyTrash.mutate(undefined, {
              onError: (error) => Alert.alert('Could not empty bin', errorMessage(error)),
            }),
        },
      ],
    );

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      refreshControl={
        <RefreshControl
          refreshing={trashQuery.isRefetching}
          onRefresh={() => void Promise.all([trashQuery.refetch(), storage.refetch()])}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      <AppHeader
        title="Recycle bin"
        subtitle={`${pluralize(total, 'item')} · ${formatBytes(trashBytes)} still counted`}
        showBack
        onBack={() => router.back()}
        right={
          total > 0 ? (
            <Button
              label="Empty"
              variant="ghost"
              fullWidth={false}
              onPress={confirmEmpty}
              loading={emptyTrash.isPending}
              style={{ minHeight: 48, paddingHorizontal: 10 }}
            />
          ) : undefined
        }
      />
      <OfflineBanner />

      <View
        style={{
          backgroundColor: theme.colors.warningSoft,
          borderRadius: theme.radii.md,
          padding: 13,
          marginBottom: 16,
        }}
      >
        <AppText variant="small" color="warning">
          Items in the recycle bin continue to count toward your storage quota until they are
          permanently deleted.
        </AppText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: 16 }}
        contentContainerStyle={{ gap: 7 }}
      >
        {(
          [
            ['all', 'All'],
            ['files', 'Files'],
            ['folders', 'Folders'],
          ] as [TrashFilter, string][]
        ).map(([key, label]) => {
          const active = filter === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(key)}
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
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {trashQuery.isLoading ? (
        <LoadingState label="Loading recycle bin…" />
      ) : trashQuery.isError ? (
        <ErrorState
          message={trashQuery.error.message}
          onRetry={() => void trashQuery.refetch()}
        />
      ) : total === 0 ? (
        <EmptyState
          icon="trash-outline"
          title="The recycle bin is empty"
          message="Files and folders you delete will appear here before they are permanently removed."
        />
      ) : (
        <>
          {(filter === 'all' || filter === 'folders') && folders.length > 0 ? (
            <View style={{ marginBottom: 18 }}>
              <SectionHeader title="Folders" />
              <View
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                  borderRadius: theme.radii.lg,
                  paddingHorizontal: 14,
                }}
              >
                {folders.map((folder) => (
                  <TrashItem
                    key={folder.id}
                    name={folder.name}
                    subtitle={`Deleted ${folder.deletedAt ? formatDate(folder.deletedAt) : 'recently'}`}
                    icon="folder-outline"
                    onRestore={() => confirmRestoreFolder(folder)}
                    onDelete={() => confirmDeleteFolder(folder)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {(filter === 'all' || filter === 'files') && files.length > 0 ? (
            <View>
              <SectionHeader title="Files" />
              <View
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                  borderRadius: theme.radii.lg,
                  paddingHorizontal: 14,
                }}
              >
                {files.map((file) => (
                  <TrashItem
                    key={file.id}
                    name={file.name}
                    subtitle={`${formatBytes(file.sizeBytes)} · deleted ${
                      file.deletedAt ? formatDate(file.deletedAt) : 'recently'
                    }`}
                    icon="document-outline"
                    onRestore={() => confirmRestoreFile(file)}
                    onDelete={() => confirmDeleteFile(file)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
