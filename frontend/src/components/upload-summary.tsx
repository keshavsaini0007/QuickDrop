import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUploadStore } from '@/lib/uploadQueue';
import { useAppTheme } from '@/theme';
import { AppText } from './ui';

export function UploadSummaryCard() {
  const theme = useAppTheme();
  const router = useRouter();
  const items = useUploadStore((state) => state.items);
  const active = items.filter((item) =>
    ['queued', 'signing', 'uploading', 'confirming', 'error'].includes(item.status),
  );
  if (active.length === 0) return null;

  const uploading = active.filter((item) =>
    ['signing', 'uploading', 'confirming'].includes(item.status),
  ).length;
  const queued = active.filter((item) => item.status === 'queued').length;
  const failed = active.filter((item) => item.status === 'error').length;
  const average =
    active.reduce((sum, item) => sum + item.progress, 0) / Math.max(1, active.length);
  const title = failed
    ? `${failed} upload${failed === 1 ? '' : 's'} need attention`
    : uploading
      ? 'Uploading to your vault'
      : `${queued} upload${queued === 1 ? '' : 's'} queued`;
  const subtitle = failed
    ? 'Open the queue to retry or remove failed uploads.'
    : `${Math.round(average * 100)}% complete · foreground queue`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityLiveRegion="polite"
      android_ripple={{ color: theme.colors.primarySoft }}
      onPress={() => router.push('/uploads')}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        borderColor: failed ? theme.colors.danger : theme.colors.border,
        backgroundColor: theme.colors.surface,
        opacity: pressed ? 0.8 : 1,
        marginBottom: 16,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: failed ? theme.colors.dangerSoft : theme.colors.primarySoft,
        }}
      >
        <Ionicons
          name={failed ? 'alert-circle-outline' : 'cloud-upload-outline'}
          size={21}
          color={failed ? theme.colors.danger : theme.colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="smallStrong">{title}</AppText>
        <AppText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
          {subtitle}
        </AppText>
        {!failed ? (
          <View
            style={{
              height: 4,
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: 2,
              marginTop: 8,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.round(average * 100)}%`,
                height: '100%',
                backgroundColor: theme.colors.primary,
              }}
            />
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
    </Pressable>
  );
}
