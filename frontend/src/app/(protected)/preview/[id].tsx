import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { FileDownload, FileItem } from '@/types/api';
import { apiGet, errorMessage } from '@/lib/api';
import { getOfflineFile, saveFileOffline } from '@/lib/offline';
import { formatBytes, safeLocalFileName } from '@/lib/format';
import { useFavoriteFile } from '@/hooks/mutations';
import { useFile, useFilePreview } from '@/hooks/queries';
import { useNetworkStatus } from '@/hooks/use-network';
import { useAppTheme } from '@/theme';
import {
  AppHeader,
  AppText,
  Button,
  ErrorState,
  LoadingState,
  OfflineBanner,
  Screen,
} from '@/components/ui';
import { FileActionsSheet } from '@/components/file-actions-sheet';
import { ShareDialog } from '@/components/share-dialog';

async function downloadAndShare(file: FileItem, mode: 'download' | 'preview'): Promise<void> {
  const result = await apiGet<FileDownload>(
    `/files/${file.id}/${mode === 'download' ? 'download' : 'preview'}`,
  );
  const destination = new File(Paths.cache, safeLocalFileName(file.name));
  await File.downloadFileAsync(result.url, destination, { idempotent: true });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(destination.uri, {
      mimeType: file.mimeType,
      dialogTitle: mode === 'download' ? 'Save or share file' : 'Open file',
      UTI: file.extension,
    });
    return;
  }
  await Linking.openURL(result.url);
}

function VideoPreview({ source }: { source: string }) {
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={{ flex: 1, backgroundColor: '#000000' }}
      nativeControls
      contentFit="contain"
      accessibilityLabel="Video preview"
    />
  );
}

function TextPreview({ url }: { url: string }) {
  const theme = useAppTheme();
  const textQuery = useQuery({
    queryKey: ['text-preview', url],
    queryFn: async () => {
      if (url.startsWith('file://')) {
        const local = new File(url);
        if (!local.exists) throw new Error('The offline copy is no longer available.');
        return (await local.text()).slice(0, 200_000);
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error('The text preview could not be loaded.');
      return (await response.text()).slice(0, 200_000);
    },
    staleTime: 5 * 60_000,
  });

  if (textQuery.isLoading) return <LoadingState label="Loading text preview…" />;
  if (textQuery.isError) {
    return <ErrorState message={textQuery.error.message} onRetry={() => void textQuery.refetch()} />;
  }
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28 }}>
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          padding: 14,
        }}
      >
        <AppText
          selectable
          style={{
            fontFamily: 'monospace',
            fontSize: 13,
            lineHeight: 20,
            color: theme.colors.text,
          }}
        >
          {textQuery.data}
        </AppText>
      </View>
    </ScrollView>
  );
}

export default function PreviewScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const network = useNetworkStatus();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const fileQuery = useFile(id);
  const previewQuery = useFilePreview(id, Boolean(id));
  const offlineQuery = useQuery({
    queryKey: ['offline-file', id],
    queryFn: () => getOfflineFile(id),
    enabled: Boolean(id),
  });
  const favorite = useFavoriteFile();
  const [actionsOpen, setActionsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);

  const file = fileQuery.data;
  const localUri = offlineQuery.data?.localUri;
  const remoteUrl = previewQuery.data?.url;
  const sourceUrl = localUri ?? remoteUrl;
  const previewLoading = previewQuery.isLoading && !localUri;

  if (fileQuery.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <AppHeader title="Preview" showBack onBack={() => router.back()} />
        <LoadingState label="Opening file…" />
      </Screen>
    );
  }

  if (fileQuery.isError || !file) {
    return (
      <Screen edges={['top', 'bottom']}>
        <AppHeader title="Preview" showBack onBack={() => router.back()} />
        <ErrorState
          message={fileQuery.error?.message ?? 'This file is no longer available.'}
          onRetry={() => void fileQuery.refetch()}
        />
      </Screen>
    );
  }

  const saveOffline = async () => {
    setSavingOffline(true);
    try {
      await saveFileOffline(file);
      await queryClient.invalidateQueries({ queryKey: ['offline'] });
      await queryClient.invalidateQueries({ queryKey: ['offline-file', id] });
      Alert.alert('Saved offline', `${file.name} is available without a connection.`);
    } catch (error) {
      Alert.alert('Could not save offline', errorMessage(error));
    } finally {
      setSavingOffline(false);
    }
  };

  const openExternally = async () => {
    try {
      if (localUri) {
        const local = new File(localUri);
        if (local.exists) {
          try {
            if (await local.canPreview({ mimeType: file.mimeType })) {
              await local.preview({ title: file.name, mimeType: file.mimeType });
              return;
            }
          } catch {
            // Fall through to the share sheet below.
          }
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(local.uri, {
              mimeType: file.mimeType,
              dialogTitle: 'Open file',
              UTI: file.extension,
            });
            return;
          }
        }
      }

      if (file.previewKind === 'pdf' && sourceUrl) {
        await Linking.openURL(sourceUrl);
        return;
      }
      await downloadAndShare(file, 'preview');
    } catch (error) {
      Alert.alert('Could not open file', errorMessage(error));
    }
  };

  const download = async () => {
    try {
      await downloadAndShare(file, 'download');
    } catch (error) {
      Alert.alert('Download failed', errorMessage(error));
    }
  };

  const renderPreview = () => {
    if (previewLoading) return <LoadingState label="Preparing preview…" />;
    if (!sourceUrl) {
      return (
        <ErrorState
          message={
            network.isOnline
              ? 'A preview could not be prepared for this file. You can still download it.'
              : 'This file is not saved offline. Connect to the internet or save it offline first.'
          }
          onRetry={() => void previewQuery.refetch()}
        />
      );
    }

    if (file.previewKind === 'image') {
      return (
        <View
          style={{
            flex: 1,
            borderRadius: theme.radii.lg,
            overflow: 'hidden',
            backgroundColor: theme.colors.surfaceMuted,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Image
            source={{ uri: sourceUrl }}
            style={{ flex: 1 }}
            contentFit="contain"
            transition={200}
            accessibilityLabel={`Preview of ${file.name}`}
          />
        </View>
      );
    }

    if (file.previewKind === 'video') {
      return (
        <View
          style={{
            flex: 1,
            borderRadius: theme.radii.lg,
            overflow: 'hidden',
            backgroundColor: '#000000',
          }}
        >
          <VideoPreview source={sourceUrl} />
        </View>
      );
    }

    if (file.previewKind === 'text') {
      return <TextPreview url={sourceUrl} />;
    }

    const isPdf = file.previewKind === 'pdf';
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <View
          style={{
            width: 82,
            height: 82,
            borderRadius: 26,
            backgroundColor: isPdf ? theme.colors.dangerSoft : theme.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 18,
          }}
        >
          <Ionicons
            name={isPdf ? 'document-text' : 'document-outline'}
            size={38}
            color={isPdf ? theme.colors.danger : theme.colors.primary}
          />
        </View>
        <AppText variant="heading" style={{ textAlign: 'center' }}>
          {isPdf ? 'PDF document' : 'This file needs a native app'}
        </AppText>
        <AppText
          variant="small"
          color="textSecondary"
          style={{ textAlign: 'center', marginTop: 8, maxWidth: 310 }}
        >
          {isPdf
            ? 'Open the signed preview in your device browser. No file content is rendered inside QuickDrop.'
            : 'QuickDrop will download the file to a temporary cache and open the device share sheet so you can view it in a compatible app.'}
        </AppText>
        <Button
          label={isPdf ? 'Open PDF in browser' : 'Open with device'}
          icon={isPdf ? 'open-outline' : 'share-outline'}
          onPress={() => void openExternally()}
          fullWidth={false}
          style={{ marginTop: 24, minWidth: 230 }}
        />
      </View>
    );
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <AppHeader
        title={file.name}
        subtitle={`${file.extension} · ${formatBytes(file.sizeBytes)}`}
        showBack
        onBack={() => router.back()}
        right={
          <View style={{ flexDirection: 'row' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={file.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              onPress={() =>
                favorite.mutate(
                  { id: file.id, isFavorite: !file.isFavorite },
                  {
                    onError: (error) =>
                      Alert.alert('Could not update favorite', errorMessage(error)),
                  },
                )
              }
              style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons
                name={file.isFavorite ? 'star' : 'star-outline'}
                size={22}
                color={file.isFavorite ? theme.colors.accent : theme.colors.text}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More file actions"
              onPress={() => setActionsOpen(true)}
              style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="ellipsis-horizontal" size={23} color={theme.colors.text} />
            </Pressable>
          </View>
        }
      />

      <OfflineBanner />
      <View style={{ flex: 1, marginTop: 4 }}>{renderPreview()}</View>

      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          paddingTop: 12,
          paddingBottom: 4,
        }}
      >
        <Button
          label="Download"
          icon="download-outline"
          variant="secondary"
          onPress={() => void download()}
          fullWidth={false}
          style={{ flex: 1 }}
        />
        <Button
          label="Share"
          icon="link-outline"
          variant="secondary"
          onPress={() => setShareOpen(true)}
          fullWidth={false}
          style={{ flex: 1 }}
        />
        <Button
          label={offlineQuery.data ? 'Saved' : 'Offline'}
          icon={offlineQuery.data ? 'checkmark-circle-outline' : 'cloud-download-outline'}
          variant="secondary"
          onPress={() => void saveOffline()}
          loading={savingOffline}
          disabled={Boolean(offlineQuery.data)}
          fullWidth={false}
          style={{ flex: 1 }}
        />
      </View>

      <FileActionsSheet
        visible={actionsOpen}
        file={file}
        onClose={() => setActionsOpen(false)}
      />
      {shareOpen ? (
        <ShareDialog
          visible
          fileId={file.id}
          fileName={file.name}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
    </Screen>
  );
}
