import { useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  PublicShareAccess,
  PublicShareDownload,
  PublicShareInfo,
} from '@/types/api';
import { ApiClientError, apiGet, apiPost, errorMessage } from '@/lib/api';
import { SHARE_BASE_URL } from '@/lib/config';
import { formatBytes, formatDate, mediaLabel } from '@/lib/format';
import { useAppTheme } from '@/theme';
import {
  AppHeader,
  AppText,
  Badge,
  Button,
  Card,
  ErrorState,
  LoadingState,
  Screen,
  TextField,
} from '@/components/ui';
import { BrandRow } from '@/components/brand';

export default function PublicShareScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const [password, setPassword] = useState('');
  const [access, setAccess] = useState<PublicShareAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const shareQuery = useQuery({
    queryKey: ['public-share', token],
    queryFn: () =>
      apiGet<PublicShareInfo>(`/public/shares/${encodeURIComponent(token)}`),
    enabled: Boolean(token),
    retry: false,
  });

  const unlock = useMutation({
    mutationFn: (input: { password?: string }) =>
      apiPost<PublicShareAccess>(
        `/public/shares/${encodeURIComponent(token)}/access`,
        input,
      ),
  });

  const info = shareQuery.data;

  const download = async () => {
    setError(null);
    setDownloading(true);
    try {
      let accessToken = access?.accessToken;
      if (!accessToken) {
        if (info?.share.hasPassword && !password) {
          setError('Enter the password to unlock this file.');
          return;
        }
        const unlocked = await unlock.mutateAsync({
          ...(info?.share.hasPassword ? { password } : {}),
        });
        accessToken = unlocked.accessToken;
        setAccess(unlocked);
      }
      const result = await apiGet<PublicShareDownload>(
        `/public/shares/${encodeURIComponent(token)}/download`,
        { headers: { 'X-Share-Access-Token': accessToken } },
      );
      const supported = await Linking.canOpenURL(result.url);
      if (!supported) throw new Error('This device cannot open the download link.');
      await Linking.openURL(result.url);
    } catch (downloadError) {
      if (
        downloadError instanceof ApiClientError &&
        (downloadError.status === 401 || downloadError.status === 403)
      ) {
        // The short-lived unlock token expired. Force a fresh unlock on the
        // next tap instead of retrying with a token we know is stale.
        setAccess(null);
      }
      setError(errorMessage(downloadError));
    } finally {
      setDownloading(false);
    }
  };

  const openWebPage = async () => {
    if (!info) return;
    const url = `${SHARE_BASE_URL}/s/${encodeURIComponent(token)}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Cannot open browser', 'The share page URL is not supported on this device.');
      return;
    }
    await Linking.openURL(url);
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <AppHeader
        title="Shared file"
        subtitle="A private link from QuickDrop"
        showBack={router.canGoBack()}
        onBack={() => router.back()}
      />
      <View style={{ marginTop: 14, marginBottom: 24 }}>
        <BrandRow compact />
      </View>

      {!token ? (
        <ErrorState message="This share link is missing its token." />
      ) : shareQuery.isLoading ? (
        <LoadingState label="Checking share link…" />
      ) : shareQuery.isError || !info ? (
        <ErrorState
          message={shareQuery.error?.message ?? 'This share link is not available.'}
          onRetry={() => void shareQuery.refetch()}
        />
      ) : (
        <>
          <Card style={{ marginBottom: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.primarySoft,
                }}
              >
                {info.file.thumbnailUrl ? (
                  <Image
                    source={{ uri: info.file.thumbnailUrl }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    accessibilityLabel={`${info.file.name} thumbnail`}
                  />
                ) : (
                  <Ionicons name="document-outline" size={28} color={theme.colors.primary} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="heading" numberOfLines={2}>
                  {info.file.name}
                </AppText>
                <AppText variant="small" color="textSecondary" style={{ marginTop: 3 }}>
                  {mediaLabel(info.file.mediaType)} · {formatBytes(info.file.sizeBytes)}
                </AppText>
                <View style={{ marginTop: 7, flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
                  {info.share.hasPassword ? (
                    <Badge label="Password protected" tone="info" />
                  ) : (
                    <Badge label="Link access" tone="neutral" />
                  )}
                  {info.share.expiresAt ? (
                    <Badge label={`Expires ${formatDate(info.share.expiresAt)}`} tone="warning" />
                  ) : null}
                </View>
              </View>
            </View>
            <View
              style={{
                height: 1,
                backgroundColor: theme.colors.border,
                marginVertical: 14,
              }}
            />
            <AppText variant="small" color="textSecondary">
              Shared by {info.ownerName}
            </AppText>
            <AppText variant="caption" color="textTertiary" style={{ marginTop: 3 }}>
              {info.share.downloadCount} download
              {info.share.downloadCount === 1 ? '' : 's'}
              {info.share.maxDownloads ? ` of ${info.share.maxDownloads}` : ''}
            </AppText>
          </Card>

          {info.share.hasPassword ? (
            <TextField
              label="Share password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter the password from the sender"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={() => void download()}
            />
          ) : null}

          {error ? (
            <View
              accessibilityRole="alert"
              style={{
                backgroundColor: theme.colors.dangerSoft,
                borderRadius: theme.radii.md,
                padding: 13,
                marginBottom: 14,
              }}
            >
              <AppText variant="small" color="danger">
                {error}
              </AppText>
            </View>
          ) : null}

          <Button
            label={access ? 'Download file' : 'Unlock and download'}
            icon="download-outline"
            onPress={() => void download()}
            loading={downloading || unlock.isPending}
          />
          <Button
            label="Open browser version"
            variant="secondary"
            icon="open-outline"
            onPress={() => void openWebPage()}
            style={{ marginTop: 10 }}
          />
          <AppText variant="caption" color="textTertiary" style={{ marginTop: 16 }}>
            QuickDrop does not expose the file’s Cloudinary URL. Each download receives a
            short-lived signed URL after the server verifies this share.
          </AppText>
        </>
      )}
    </Screen>
  );
}
