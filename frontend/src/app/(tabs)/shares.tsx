import { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { CreatedShare, ShareItem } from '@/types/api';
import { useShares } from '@/hooks/queries';
import { useRegenerateShare, useRevokeShare } from '@/hooks/mutations';
import { errorMessage } from '@/lib/api';
import { formatDate, formatRelativeTime, pluralize } from '@/lib/format';
import { useAppTheme } from '@/theme';
import {
  AppHeader,
  AppText,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineBanner,
  Screen,
} from '@/components/ui';
import { ShareLinkDialog } from '@/components/share-link-dialog';

type Filter = 'all' | 'active' | 'expired' | 'revoked';

function statusOf(share: ShareItem): 'active' | 'expired' | 'revoked' {
  if (share.isRevoked) return 'revoked';
  if (share.isExpired) return 'expired';
  return 'active';
}

function ShareCard({
  share,
  onOpen,
  onRegenerate,
  onRevoke,
}: {
  share: ShareItem;
  onOpen: () => void;
  onRegenerate: () => void;
  onRevoke: () => void;
}) {
  const theme = useAppTheme();
  const status = statusOf(share);
  const tone = status === 'active' ? 'success' : status === 'expired' ? 'warning' : 'danger';
  const label = status === 'active' ? 'Active' : status === 'expired' ? 'Expired' : 'Revoked';

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: theme.radii.lg,
        padding: 15,
        marginBottom: 11,
        ...theme.shadows.card,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            backgroundColor: theme.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="link-outline" size={21} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {share.fileName ?? 'Shared file'}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 }}>
            <Badge label={label} tone={tone} />
            {share.hasPassword ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="lock-closed" size={11} color={theme.colors.textSecondary} />
                <AppText variant="caption" color="textSecondary">
                  Password
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
        <View>
          <AppText variant="caption" color="textTertiary">
            Downloads
          </AppText>
          <AppText variant="smallStrong">
            {share.downloadCount}
            {share.maxDownloads ? ` / ${share.maxDownloads}` : ''}
          </AppText>
        </View>
        <View>
          <AppText variant="caption" color="textTertiary">
            Expires
          </AppText>
          <AppText variant="smallStrong">
            {share.expiresAt ? formatDate(share.expiresAt) : 'Never'}
          </AppText>
        </View>
        <View>
          <AppText variant="caption" color="textTertiary">
            Created
          </AppText>
          <AppText variant="smallStrong">{formatRelativeTime(share.createdAt)}</AppText>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open shared file ${share.fileName ?? ''}`}
          onPress={onOpen}
          style={{
            minHeight: 48,
            flex: 1,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="smallStrong">Open file</AppText>
        </Pressable>
        {status !== 'revoked' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Regenerate share link"
            onPress={onRegenerate}
            style={{
              minHeight: 48,
              flex: 1,
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText variant="smallStrong" color="primary">
              New link
            </AppText>
          </Pressable>
        ) : null}
        {status === 'active' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Revoke share link"
            onPress={onRevoke}
            style={{
              minHeight: 48,
              paddingHorizontal: 13,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.dangerSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function SharesScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const sharesQuery = useShares();
  const regenerate = useRegenerateShare();
  const revoke = useRevokeShare();
  const [filter, setFilter] = useState<Filter>('all');
  const [newShare, setNewShare] = useState<CreatedShare | null>(null);

  const shares = useMemo(() => sharesQuery.data ?? [], [sharesQuery.data]);
  const filtered = useMemo(
    () => shares.filter((share) => filter === 'all' || statusOf(share) === filter),
    [filter, shares],
  );
  const activeCount = shares.filter((share) => statusOf(share) === 'active').length;
  const downloads = shares.reduce((sum, share) => sum + share.downloadCount, 0);

  const confirmRevoke = (share: ShareItem) => {
    Alert.alert(
      'Revoke this link?',
      'Anyone using the old link will lose access immediately. The file itself stays in your vault.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke link',
          style: 'destructive',
          onPress: () =>
            revoke.mutate(share.id, {
              onError: (error) => Alert.alert('Could not revoke link', errorMessage(error)),
            }),
        },
      ],
    );
  };

  const confirmRegenerate = (share: ShareItem) => {
    Alert.alert(
      'Replace this link?',
      'The current link stops working immediately. A new one-time link will be shown after you confirm.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create new link',
          onPress: () =>
            regenerate.mutate(share.id, {
              onSuccess: (result) => setNewShare(result),
              onError: (error) => Alert.alert('Could not regenerate link', errorMessage(error)),
            }),
        },
      ],
    );
  };

  return (
    <Screen
      scroll
      edges={['top']}
      refreshControl={
        <RefreshControl
          refreshing={sharesQuery.isRefetching}
          onRefresh={() => void sharesQuery.refetch()}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      <AppHeader title="Shares" subtitle="Secure links to files in your vault" />
      <OfflineBanner />

      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: 1,
          borderRadius: theme.radii.lg,
          padding: 16,
          marginBottom: 18,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 24 }}>
          <View>
            <AppText variant="caption" color="textTertiary">
              Active links
            </AppText>
            <AppText variant="title">{activeCount}</AppText>
          </View>
          <View>
            <AppText variant="caption" color="textTertiary">
              Total downloads
            </AppText>
            <AppText variant="title">{downloads}</AppText>
          </View>
        </View>
        <AppText variant="caption" color="textSecondary" style={{ marginTop: 12 }}>
          Raw share URLs are shown once at creation. Use “New link” to issue a replacement.
        </AppText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: 14 }}
        contentContainerStyle={{ gap: 7 }}
      >
        {(['all', 'active', 'expired', 'revoked'] as Filter[]).map((key) => {
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
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {sharesQuery.isLoading ? (
        <LoadingState label="Loading share links…" />
      ) : sharesQuery.isError ? (
        <ErrorState
          message={sharesQuery.error.message}
          onRetry={() => void sharesQuery.refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="link-outline"
          title={shares.length === 0 ? 'No share links yet' : 'No links match this filter'}
          message={
            shares.length === 0
              ? 'Open a file in Files, choose Share, and create a protected link.'
              : 'Choose another status filter to see your links.'
          }
          action={
            shares.length === 0 ? (
              <Button
                label="Browse files"
                onPress={() => router.push('/(tabs)/files')}
              />
            ) : undefined
          }
        />
      ) : (
        <>
          <AppText variant="caption" color="textSecondary" style={{ marginBottom: 10 }}>
            {pluralize(filtered.length, 'link')}
          </AppText>
          {filtered.map((share) => (
            <ShareCard
              key={share.id}
              share={share}
              onOpen={() => router.push(`/preview/${share.fileId}`)}
              onRegenerate={() => confirmRegenerate(share)}
              onRevoke={() => confirmRevoke(share)}
            />
          ))}
        </>
      )}

      <ShareLinkDialog
        result={newShare}
        visible={Boolean(newShare)}
        onClose={() => setNewShare(null)}
      />
    </Screen>
  );
}
