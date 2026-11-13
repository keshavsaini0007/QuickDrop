import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ActivityItem, ActivityType } from '@/types/api';
import { useActivity } from '@/hooks/queries';
import {
  activityLabel,
  activityMetadataName,
  formatDate,
  formatDateTime,
  formatRelativeTime,
} from '@/lib/format';
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

type ActivityFilter = 'all' | 'files' | 'shares' | 'account';

function iconFor(type: ActivityType): keyof typeof Ionicons.glyphMap {
  if (type.startsWith('share')) return 'link-outline';
  if (type.startsWith('folder')) return 'folder-outline';
  if (type.includes('download')) return 'download-outline';
  if (type.includes('upload')) return 'cloud-upload-outline';
  if (type.includes('favorite')) return 'star-outline';
  if (type.includes('delete')) return 'trash-outline';
  if (type.includes('password')) return 'key-outline';
  if (type.includes('profile') || type.includes('avatar')) return 'person-outline';
  return 'document-text-outline';
}

function dateGroup(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const startOfDay = (input: Date) =>
    new Date(input.getFullYear(), input.getMonth(), input.getDate()).getTime();
  const difference = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (difference === 0) return 'Today';
  if (difference === 1) return 'Yesterday';
  return formatDate(date);
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const theme = useAppTheme();
  const name = activityMetadataName(item.metadata);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 12,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surfaceMuted,
        }}
      >
        <Ionicons name={iconFor(item.type)} size={18} color={theme.colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="bodyStrong">{activityLabel(item.type)}</AppText>
        {name ? (
          <AppText variant="small" color="textSecondary" numberOfLines={1} style={{ marginTop: 2 }}>
            {name}
          </AppText>
        ) : null}
        <AppText variant="caption" color="textTertiary" style={{ marginTop: 3 }}>
          {formatDateTime(item.createdAt)}
        </AppText>
      </View>
      <AppText variant="caption" color="textTertiary">
        {formatRelativeTime(item.createdAt)}
      </AppText>
    </View>
  );
}

export default function ActivityScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const activityQuery = useActivity(100);
  const [filter, setFilter] = useState<ActivityFilter>('all');

  const filtered = useMemo(() => {
    const items = activityQuery.data ?? [];
    return items.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'shares') return item.type.startsWith('share');
      if (filter === 'account') {
        return item.type.includes('profile') || item.type.includes('password') || item.type.includes('avatar');
      }
      return item.type.startsWith('file') || item.type.startsWith('folder');
    });
  }, [activityQuery.data, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, ActivityItem[]>();
    for (const item of filtered) {
      const group = dateGroup(item.createdAt);
      const existing = map.get(group) ?? [];
      existing.push(item);
      map.set(group, existing);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      refreshControl={
        <RefreshControl
          refreshing={activityQuery.isRefetching}
          onRefresh={() => void activityQuery.refetch()}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      <AppHeader
        title="Activity"
        subtitle="A private audit trail for your vault"
        showBack
        onBack={() => router.back()}
      />
      <OfflineBanner />

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
            ['shares', 'Shares'],
            ['account', 'Account'],
          ] as [ActivityFilter, string][]
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

      {activityQuery.isLoading ? (
        <LoadingState label="Loading activity…" />
      ) : activityQuery.isError ? (
        <ErrorState
          message={activityQuery.error.message}
          onRetry={() => void activityQuery.refetch()}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="No activity yet"
          message="Uploads, downloads, shares, and account changes will appear here."
        />
      ) : (
        groups.map(([group, items]) => (
          <View key={group} style={{ marginBottom: 18 }}>
            <AppText variant="smallStrong" color="textSecondary" style={{ marginBottom: 7 }}>
              {group}
            </AppText>
            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderWidth: 1,
                borderRadius: theme.radii.lg,
                paddingHorizontal: 14,
                paddingVertical: 2,
              }}
            >
              {items.map((item, index) => (
                <View
                  key={item.id}
                  style={{
                    borderBottomWidth: index === items.length - 1 ? 0 : 1,
                    borderBottomColor: theme.colors.border,
                  }}
                >
                  <ActivityRow item={item} />
                </View>
              ))}
            </View>
          </View>
        ))
      )}
    </Screen>
  );
}
