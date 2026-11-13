import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import type { FileItem } from '@/types/api';
import { useAuthStore } from '@/store/auth';
import { useActivity, useStorage } from '@/hooks/queries';
import { useCreateFolder } from '@/hooks/mutations';
import { errorMessage } from '@/lib/api';
import { isPermissionError, openAppSettings } from '@/lib/permissions';
import { pickPhotosAndVideos, takePhoto } from '@/lib/pickers';
import { useUploadStore } from '@/lib/uploadQueue';
import {
  activityLabel,
  activityMetadataName,
  formatBytes,
  formatRelativeTime,
} from '@/lib/format';
import { useAppTheme } from '@/theme';
import {
  AppText,
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineBanner,
  Screen,
  SectionHeader,
  StorageBar,
  RefreshControlView,
} from '@/components/ui';
import { FileRow } from '@/components/file-row';
import { FileActionsSheet } from '@/components/file-actions-sheet';
import { UploadSummaryCard } from '@/components/upload-summary';
import { PromptDialog } from '@/components/prompt-dialog';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 72,
        minHeight: 78,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        paddingVertical: 10,
        borderRadius: theme.radii.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={23} color={theme.colors.primary} />
      <AppText variant="caption" color="textSecondary" style={{ fontWeight: '600' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export default function HomeScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const storage = useStorage();
  const activity = useActivity(6);
  const enqueue = useUploadStore((state) => state.enqueue);
  const createFolder = useCreateFolder();
  const [folderPrompt, setFolderPrompt] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  const summary = storage.data?.summary;
  const recentFiles = storage.data?.recentFiles ?? [];
  const refreshing = storage.isRefetching || activity.isRefetching;

  const refresh = async () => {
    await Promise.all([storage.refetch(), activity.refetch()]);
  };

  const uploadFromLibrary = async () => {
    try {
      const files = await pickPhotosAndVideos();
      if (files.length) await enqueue(files, null);
    } catch (error) {
      const message = errorMessage(error);
      Alert.alert(
        'Could not pick files',
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

  const uploadFromCamera = async () => {
    try {
      const files = await takePhoto();
      if (files.length) await enqueue(files, null);
    } catch (error) {
      const message = errorMessage(error);
      Alert.alert(
        'Could not open camera',
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

  return (
    <Screen
      scroll
      edges={['top']}
      refreshControl={<RefreshControlView refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingTop: 8,
          marginBottom: 22,
        }}
      >
        <View style={{ flex: 1 }}>
          <AppText variant="small" color="textSecondary">
            {greeting()}
          </AppText>
          <AppText variant="title" numberOfLines={1}>
            {user?.name ?? 'Your vault'}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={() => router.push('/(tabs)/settings')}
          style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Avatar name={user?.name ?? 'QuickDrop'} />
        </Pressable>
      </View>

      <OfflineBanner />
      <UploadSummaryCard />

      {storage.isLoading ? (
        <LoadingState label="Loading your vault…" />
      ) : storage.isError && !storage.data ? (
        <ErrorState message={storage.error.message} onRetry={() => void storage.refetch()} />
      ) : (
        <>
          <Card
            style={{
              backgroundColor: theme.colors.primary,
              borderColor: theme.colors.primary,
              marginBottom: 22,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <AppText variant="small" style={{ color: theme.colors.onPrimary, opacity: 0.82 }}>
                  Storage used
                </AppText>
                <AppText variant="title" style={{ color: theme.colors.onPrimary, marginTop: 3 }}>
                  {formatBytes(summary?.usedBytes ?? 0)}
                </AppText>
              </View>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 15,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="server-outline" size={23} color={theme.colors.onPrimary} />
              </View>
            </View>
            <View style={{ marginTop: 16 }}>
              <StorageBar
                percent={summary?.percentUsed ?? 0}
                height={7}
                trackColor="rgba(255,255,255,0.22)"
                fillColor={theme.colors.onPrimary}
              />
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: 8,
                }}
              >
                <AppText
                  variant="caption"
                  style={{ color: theme.colors.onPrimary, opacity: 0.82 }}
                >
                  {formatBytes(summary?.availableBytes ?? 0)} available
                </AppText>
                <AppText
                  variant="caption"
                  style={{ color: theme.colors.onPrimary, opacity: 0.82 }}
                >
                  {Math.round(summary?.percentUsed ?? 0)}%
                </AppText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Manage storage"
              onPress={() => router.push('/storage')}
              style={{
                marginTop: 16,
                minHeight: 48,
                borderRadius: 12,
                backgroundColor: 'rgba(255,255,255,0.16)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText variant="smallStrong" style={{ color: theme.colors.onPrimary }}>
                Manage storage
              </AppText>
            </Pressable>
          </Card>

          <SectionHeader title="Quick actions" />
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
            <QuickAction icon="cloud-upload-outline" label="Upload" onPress={() => void uploadFromLibrary()} />
            <QuickAction icon="camera-outline" label="Camera" onPress={() => void uploadFromCamera()} />
            <QuickAction
              icon="folder-open-outline"
              label="New folder"
              onPress={() => {
                setFolderError(null);
                setFolderPrompt(true);
              }}
            />
            <QuickAction
              icon="link-outline"
              label="Shares"
              onPress={() => router.push('/(tabs)/shares')}
            />
          </View>

          <SectionHeader
            title="Recent files"
            actionLabel="View all"
            onAction={() => router.push('/(tabs)/files')}
          />
          {recentFiles.length === 0 ? (
            <EmptyState
              icon="cloud-upload-outline"
              title="Your vault is empty"
              message="Upload a photo, video, or document to get started."
              action={<Button label="Upload a file" onPress={() => void uploadFromLibrary()} />}
            />
          ) : (
            <View style={{ marginBottom: 18 }}>
              {recentFiles.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  onPress={() => router.push(`/preview/${file.id}`)}
                  onMore={() => setSelectedFile(file)}
                />
              ))}
            </View>
          )}

          <SectionHeader
            title="Recent activity"
            actionLabel="View all"
            onAction={() => router.push('/activity')}
          />
          {activity.isLoading ? (
            <LoadingState label="Loading activity…" />
          ) : (activity.data ?? []).length === 0 ? (
            <Card>
              <AppText variant="small" color="textSecondary">
                Activity appears here after you upload, share, or change a file.
              </AppText>
            </Card>
          ) : (
            <Card style={{ paddingVertical: 4 }}>
              {(activity.data ?? []).map((item, index) => (
                <View
                  key={item.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 11,
                    paddingVertical: 10,
                    borderBottomWidth: index === (activity.data?.length ?? 0) - 1 ? 0 : 1,
                    borderBottomColor: theme.colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 11,
                      backgroundColor: theme.colors.surfaceMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons
                      name={
                        item.type.startsWith('share')
                          ? 'link-outline'
                          : item.type.startsWith('folder')
                            ? 'folder-outline'
                            : item.type.includes('download')
                              ? 'download-outline'
                              : 'document-text-outline'
                      }
                      size={17}
                      color={theme.colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="smallStrong" numberOfLines={1}>
                      {activityLabel(item.type)}
                    </AppText>
                    <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                      {activityMetadataName(item.metadata) || formatRelativeTime(item.createdAt)}
                    </AppText>
                  </View>
                  <AppText variant="caption" color="textTertiary">
                    {formatRelativeTime(item.createdAt)}
                  </AppText>
                </View>
              ))}
            </Card>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
            <Button
              label="Recycle bin"
              variant="secondary"
              icon="trash-outline"
              onPress={() => router.push('/trash')}
              style={{ flex: 1 }}
              fullWidth={false}
            />
            <Button
              label="Upload queue"
              variant="secondary"
              icon="cloud-upload-outline"
              onPress={() => router.push('/uploads')}
              style={{ flex: 1 }}
              fullWidth={false}
            />
          </View>
        </>
      )}

      {folderPrompt ? (
        <PromptDialog
          visible
          title="New folder"
          message="Folders keep your vault organised."
          label="Folder name"
          placeholder="e.g. Receipts"
          confirmLabel="Create"
          loading={createFolder.isPending}
          error={folderError}
          onCancel={() => setFolderPrompt(false)}
          onSubmit={(name) => {
            setFolderError(null);
            createFolder.mutate(
              { name, parentId: null },
              {
                onSuccess: () => {
                  setFolderPrompt(false);
                  void queryClient.invalidateQueries({ queryKey: ['folders'] });
                },
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
    </Screen>
  );
}
