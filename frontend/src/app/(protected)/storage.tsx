import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { FileItem, MediaType } from '@/types/api';
import { useStorage } from '@/hooks/queries';
import { formatBytes } from '@/lib/format';
import { useAppTheme } from '@/theme';
import {
  AppHeader,
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineBanner,
  Screen,
  SectionHeader,
  StorageBar,
} from '@/components/ui';
import { FileRow } from '@/components/file-row';
import { FileActionsSheet } from '@/components/file-actions-sheet';

const mediaMeta: Record<
  MediaType,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  image: { label: 'Images', icon: 'image-outline', color: '#0F766E' },
  video: { label: 'Videos', icon: 'videocam-outline', color: '#7C3AED' },
  audio: { label: 'Audio', icon: 'musical-notes-outline', color: '#DB2777' },
  document: { label: 'Documents', icon: 'document-text-outline', color: '#D97706' },
  archive: { label: 'Archives', icon: 'archive-outline', color: '#2563EB' },
  other: { label: 'Other', icon: 'document-outline', color: '#64748B' },
};

export default function StorageScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const storageQuery = useStorage();
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const data = storageQuery.data;
  const summary = data?.summary;

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      refreshControl={
        <RefreshControl
          refreshing={storageQuery.isRefetching}
          onRefresh={() => void storageQuery.refetch()}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      <AppHeader
        title="Storage"
        subtitle="Where your space goes"
        showBack
        onBack={() => router.back()}
      />
      <OfflineBanner />

      {storageQuery.isLoading ? (
        <LoadingState label="Calculating storage…" />
      ) : storageQuery.isError || !summary ? (
        <ErrorState
          message={storageQuery.error?.message ?? 'Storage details are unavailable.'}
          onRetry={() => void storageQuery.refetch()}
        />
      ) : (
        <>
          <Card
            style={{
              backgroundColor: theme.colors.primary,
              borderColor: theme.colors.primary,
              marginBottom: 20,
            }}
          >
            <AppText variant="small" style={{ color: theme.colors.onPrimary, opacity: 0.82 }}>
              Storage used
            </AppText>
            <AppText variant="display" style={{ color: theme.colors.onPrimary, marginTop: 2 }}>
              {formatBytes(summary.usedBytes)}
            </AppText>
            <AppText
              variant="small"
              style={{ color: theme.colors.onPrimary, opacity: 0.82, marginTop: 2 }}
            >
              {formatBytes(summary.availableBytes)} available of {formatBytes(summary.limitBytes)}
            </AppText>
            <View style={{ marginTop: 16 }}>
              <StorageBar
                percent={summary.percentUsed}
                height={8}
                trackColor="rgba(255,255,255,0.22)"
                fillColor={theme.colors.onPrimary}
              />
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: 8,
              }}
            >
              <AppText variant="caption" style={{ color: theme.colors.onPrimary, opacity: 0.8 }}>
                {summary.percentUsed}% used
              </AppText>
              <AppText variant="caption" style={{ color: theme.colors.onPrimary, opacity: 0.8 }}>
                {summary.totalFiles} files · {summary.totalFolders} folders
              </AppText>
            </View>
          </Card>

          <SectionHeader title="By file type" />
          <Card style={{ marginBottom: 20 }}>
            {(Object.keys(mediaMeta) as MediaType[]).map((mediaType, index) => {
              const meta = mediaMeta[mediaType];
              const row = summary.byMedia[mediaType];
              const percent = summary.usedBytes > 0 ? (row.bytes / summary.usedBytes) * 100 : 0;
              return (
                <View
                  key={mediaType}
                  style={{
                    paddingVertical: 11,
                    borderBottomWidth: index === 5 ? 0 : 1,
                    borderBottomColor: theme.colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 9,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: theme.colors.surfaceMuted,
                      }}
                    >
                      <Ionicons name={meta.icon} size={16} color={meta.color} />
                    </View>
                    <AppText variant="smallStrong" style={{ flex: 1 }}>
                      {meta.label}
                    </AppText>
                    <AppText variant="caption" color="textSecondary">
                      {row.count} · {formatBytes(row.bytes)}
                    </AppText>
                  </View>
                  <View
                    style={{
                      height: 5,
                      backgroundColor: theme.colors.surfaceMuted,
                      borderRadius: 3,
                      marginTop: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${Math.max(percent, row.bytes > 0 ? 2 : 0)}%`,
                        height: '100%',
                        backgroundColor: meta.color,
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </Card>

          <SectionHeader title="Reclaim space" />
          <Card style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.warningSoft,
                }}
              >
                <Ionicons name="trash-outline" size={21} color={theme.colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">Recycle bin</AppText>
                <AppText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                  {summary.trash.count} items · {formatBytes(summary.trash.bytes)} counted
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open recycle bin"
                onPress={() => router.push('/trash')}
                style={{
                  minHeight: 48,
                  paddingHorizontal: 12,
                  borderRadius: theme.radii.md,
                  backgroundColor: theme.colors.surfaceMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppText variant="caption" style={{ fontWeight: '700' }}>
                  Review
                </AppText>
              </Pressable>
            </View>
            <View
              style={{
                height: 1,
                backgroundColor: theme.colors.border,
                marginVertical: 14,
              }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.accentSoft,
                }}
              >
                <Ionicons name="star-outline" size={21} color={theme.colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">Favorites</AppText>
                <AppText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                  {summary.favorites} starred files
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open favorites"
                onPress={() => router.push('/(tabs)/files')}
                style={{
                  minHeight: 48,
                  paddingHorizontal: 12,
                  borderRadius: theme.radii.md,
                  backgroundColor: theme.colors.surfaceMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppText variant="caption" style={{ fontWeight: '700' }}>
                  Browse
                </AppText>
              </Pressable>
            </View>
          </Card>

          <SectionHeader
            title="Recently added"
            actionLabel="All files"
            onAction={() => router.push('/(tabs)/files')}
          />
          {data?.recentFiles.length === 0 ? (
            <EmptyState
              icon="cloud-upload-outline"
              title="No files yet"
              message="Upload something and its storage footprint will appear here."
              action={<Button label="Go to Files" onPress={() => router.push('/(tabs)/files')} />}
            />
          ) : (
            <View style={{ marginBottom: 16 }}>
              {data?.recentFiles.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  onPress={() => router.push(`/preview/${file.id}`)}
                  onMore={() => setSelectedFile(file)}
                />
              ))}
            </View>
          )}
        </>
      )}

      <FileActionsSheet
        visible={Boolean(selectedFile)}
        file={selectedFile}
        onClose={() => setSelectedFile(null)}
      />
    </Screen>
  );
}
