import { Alert, Pressable, RefreshControl, View } from 'react-native';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import type { OfflineFile } from '@/lib/offline';
import { removeOfflineFile } from '@/lib/offline';
import { useOfflineFiles } from '@/hooks/queries';
import { errorMessage } from '@/lib/api';
import { formatBytes, formatRelativeTime } from '@/lib/format';
import { useAppTheme } from '@/theme';
import {
  AppHeader,
  AppText,
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineBanner,
  Screen,
} from '@/components/ui';

function OfflineRow({
  record,
  onOpen,
  onRemove,
}: {
  record: OfflineFile;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open offline file ${record.name}`}
        onPress={onOpen}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.primarySoft,
          }}
        >
          <Ionicons name="cloud-done-outline" size={22} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {record.name}
          </AppText>
          <AppText variant="caption" color="textSecondary" style={{ marginTop: 3 }}>
            {formatBytes(record.sizeBytes)} · saved {formatRelativeTime(record.savedAt)}
          </AppText>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove offline copy of ${record.name}`}
        onPress={onRemove}
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="trash-outline" size={19} color={theme.colors.danger} />
      </Pressable>
    </View>
  );
}

export default function OfflineScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const offlineQuery = useOfflineFiles();

  const openFile = async (record: OfflineFile) => {
    try {
      const file = new File(record.localUri);
      if (!file.exists) {
        await queryClient.invalidateQueries({ queryKey: ['offline'] });
        Alert.alert('File missing', 'The local copy is no longer on this device.');
        return;
      }
      if (await file.canPreview()) {
        await file.preview();
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: record.mimeType,
          dialogTitle: 'Open offline file',
        });
        return;
      }
      Alert.alert('Cannot open file', 'No compatible app is available on this device.');
    } catch (error) {
      Alert.alert('Could not open file', errorMessage(error));
    }
  };

  const confirmRemove = (record: OfflineFile) => {
    Alert.alert('Remove offline copy?', `${record.name} will no longer be available offline.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          removeOfflineFile(record)
            .then(() => queryClient.invalidateQueries({ queryKey: ['offline'] }))
            .catch((error) => Alert.alert('Could not remove file', errorMessage(error))),
      },
    ]);
  };

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      refreshControl={
        <RefreshControl
          refreshing={offlineQuery.isRefetching}
          onRefresh={() => void offlineQuery.refetch()}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      <AppHeader
        title="Offline files"
        subtitle="Available without a connection"
        showBack
        onBack={() => router.back()}
      />
      <OfflineBanner />

      {offlineQuery.isLoading ? (
        <LoadingState label="Loading offline files…" />
      ) : offlineQuery.isError ? (
        <ErrorState
          message={offlineQuery.error.message}
          onRetry={() => void offlineQuery.refetch()}
        />
      ) : (offlineQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon="cloud-download-outline"
          title="No offline files yet"
          message="Open any file and choose Offline to keep a local copy on this device."
          action={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse files"
              onPress={() => router.push('/(tabs)/files')}
              style={{
                minHeight: 50,
                borderRadius: theme.radii.md,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText variant="button" style={{ color: theme.colors.onPrimary }}>
                Browse files
              </AppText>
            </Pressable>
          }
        />
      ) : (
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderWidth: 1,
            borderRadius: theme.radii.lg,
            paddingHorizontal: 14,
          }}
        >
          {(offlineQuery.data ?? []).map((record) => (
            <OfflineRow
              key={record.id}
              record={record}
              onOpen={() => void openFile(record)}
              onRemove={() => confirmRemove(record)}
            />
          ))}
        </View>
      )}

      <AppText variant="caption" color="textTertiary" style={{ marginTop: 16 }}>
        Offline copies are stored in the app’s document directory. Removing the app removes them.
      </AppText>
    </Screen>
  );
}
