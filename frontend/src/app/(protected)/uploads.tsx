import { useEffect } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { UploadItem } from '@/lib/uploadQueue';
import { useUploadStore } from '@/lib/uploadQueue';
import { useNetworkStatus } from '@/hooks/use-network';
import { formatBytes } from '@/lib/format';
import { useAppTheme } from '@/theme';
import {
  AppHeader,
  AppText,
  Button,
  EmptyState,
  OfflineBanner,
  Screen,
  SectionHeader,
} from '@/components/ui';

const statusMeta: Record<
  UploadItem['status'],
  { label: string; icon: keyof typeof Ionicons.glyphMap; tone: 'primary' | 'danger' | 'success' | 'muted' }
> = {
  queued: { label: 'Queued', icon: 'time-outline', tone: 'muted' },
  signing: { label: 'Preparing', icon: 'shield-outline', tone: 'primary' },
  uploading: { label: 'Uploading', icon: 'cloud-upload-outline', tone: 'primary' },
  confirming: { label: 'Verifying', icon: 'checkmark-circle-outline', tone: 'primary' },
  complete: { label: 'Complete', icon: 'checkmark-circle', tone: 'success' },
  error: { label: 'Needs attention', icon: 'alert-circle-outline', tone: 'danger' },
  cancelled: { label: 'Cancelled', icon: 'close-circle-outline', tone: 'muted' },
};

function UploadRow({
  item,
  onRetry,
  onCancel,
  onRemove,
}: {
  item: UploadItem;
  onRetry: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const theme = useAppTheme();
  const meta = statusMeta[item.status];
  const toneColor =
    meta.tone === 'danger'
      ? theme.colors.danger
      : meta.tone === 'success'
        ? theme.colors.success
        : meta.tone === 'primary'
          ? theme.colors.primary
          : theme.colors.textSecondary;
  const active = ['queued', 'signing', 'uploading', 'confirming'].includes(item.status);

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: item.status === 'error' ? theme.colors.danger : theme.colors.border,
        borderWidth: 1,
        borderRadius: theme.radii.lg,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              meta.tone === 'danger'
                ? theme.colors.dangerSoft
                : meta.tone === 'success'
                  ? theme.colors.successSoft
                  : theme.colors.primarySoft,
          }}
        >
          <Ionicons name={meta.icon} size={21} color={toneColor} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {item.fileName}
          </AppText>
          <AppText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
            {formatBytes(item.sizeBytes)} · {meta.label}
            {item.status === 'uploading' ? ` · ${Math.round(item.progress * 100)}%` : ''}
          </AppText>
        </View>
        {item.status === 'error' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Retry upload of ${item.fileName}`}
            onPress={onRetry}
            style={{
              minHeight: 48,
              paddingHorizontal: 12,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText variant="caption" color="primary" style={{ fontWeight: '700' }}>
              Retry
            </AppText>
          </Pressable>
        ) : null}
        {active ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Cancel upload of ${item.fileName}`}
            onPress={onCancel}
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={21} color={theme.colors.textSecondary} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.fileName} from queue`}
            onPress={onRemove}
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="trash-outline" size={19} color={theme.colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {active ? (
        <View
          style={{
            height: 5,
            backgroundColor: theme.colors.surfaceMuted,
            borderRadius: 3,
            marginTop: 12,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${Math.round(item.progress * 100)}%`,
              height: '100%',
              backgroundColor: theme.colors.primary,
            }}
          />
        </View>
      ) : null}

      {item.error ? (
        <AppText variant="caption" color="danger" style={{ marginTop: 9 }}>
          {item.error}
        </AppText>
      ) : null}
    </View>
  );
}

export default function UploadsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const network = useNetworkStatus();
  const items = useUploadStore((state) => state.items);
  const hydrate = useUploadStore((state) => state.hydrate);
  const processQueue = useUploadStore((state) => state.processQueue);
  const retry = useUploadStore((state) => state.retry);
  const remove = useUploadStore((state) => state.remove);
  const cancel = useUploadStore((state) => state.cancel);
  const clearFinished = useUploadStore((state) => state.clearFinished);

  useEffect(() => {
    void hydrate().then(() => {
      if (network.isOnline) void processQueue();
    });
  }, [hydrate, network.isOnline, processQueue]);

  const active = items.filter((item) =>
    ['queued', 'signing', 'uploading', 'confirming'].includes(item.status),
  );
  const failed = items.filter((item) => item.status === 'error');
  const finished = items.filter(
    (item) => item.status === 'complete' || item.status === 'cancelled',
  );

  const confirmRemove = (item: UploadItem) => {
    Alert.alert('Remove from queue?', `${item.fileName} will be removed from this device queue.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void remove(item.id) },
    ]);
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <AppHeader
        title="Upload queue"
        subtitle="Foreground uploads survive an app restart"
        showBack
        onBack={() => router.back()}
        right={
          finished.length > 0 ? (
            <Button
              label="Clear done"
              variant="ghost"
              fullWidth={false}
              onPress={() => void clearFinished()}
              style={{ minHeight: 48, paddingHorizontal: 8 }}
            />
          ) : undefined
        }
      />
      <OfflineBanner />

      <View
        style={{
          backgroundColor: theme.colors.primarySoft,
          borderRadius: theme.radii.md,
          padding: 13,
          marginBottom: 16,
        }}
      >
        <AppText variant="small" color="primary">
          Uploads run while QuickDrop is open. Queue metadata is stored locally so interrupted
          uploads can be retried after a restart. This build uses a single-request uploader for
          files up to 100 MB; larger files are rejected honestly rather than pretending to chunk.
        </AppText>
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon="cloud-upload-outline"
          title="Nothing in the queue"
          message="Files you add from Home or Files appear here while they upload."
          action={<Button label="Browse files" onPress={() => router.push('/(tabs)/files')} />}
        />
      ) : (
        <>
          {active.length > 0 ? (
            <View style={{ marginBottom: 16 }}>
              <SectionHeader title={`Active · ${active.length}`} />
              {active.map((item) => (
                <UploadRow
                  key={item.id}
                  item={item}
                  onRetry={() => void retry(item.id)}
                  onCancel={() => void cancel(item.id)}
                  onRemove={() => confirmRemove(item)}
                />
              ))}
            </View>
          ) : null}

          {failed.length > 0 ? (
            <View style={{ marginBottom: 16 }}>
              <SectionHeader title={`Needs attention · ${failed.length}`} />
              {failed.map((item) => (
                <UploadRow
                  key={item.id}
                  item={item}
                  onRetry={() => void retry(item.id)}
                  onCancel={() => void cancel(item.id)}
                  onRemove={() => confirmRemove(item)}
                />
              ))}
            </View>
          ) : null}

          {finished.length > 0 ? (
            <View style={{ marginBottom: 16 }}>
              <SectionHeader title={`Finished · ${finished.length}`} />
              {finished.map((item) => (
                <UploadRow
                  key={item.id}
                  item={item}
                  onRetry={() => void retry(item.id)}
                  onCancel={() => void cancel(item.id)}
                  onRemove={() => void remove(item.id)}
                />
              ))}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
