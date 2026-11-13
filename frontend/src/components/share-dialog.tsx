import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import type { CreatedShare } from '@/types/api';
import { useCreateShare } from '@/hooks/mutations';
import { errorMessage } from '@/lib/api';
import { useAppTheme } from '@/theme';
import { AppText, Button, Sheet, TextField } from './ui';

const expiryOptions = [
  { label: '1 day', value: 1 },
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: 'Never', value: 0 },
];

export function ShareDialog({
  visible,
  fileId,
  fileName,
  onClose,
}: {
  visible: boolean;
  fileId: string;
  fileName: string;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  const createShare = useCreateShare();
  const [password, setPassword] = useState('');
  const [expiryDays, setExpiryDays] = useState(7);
  const [maxDownloads, setMaxDownloads] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatedShare | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    setFormError(null);
    if (password.length > 0 && password.length < 8) {
      setFormError('Share passwords must be at least 8 characters.');
      return;
    }
    const parsedMax = maxDownloads.trim() ? Number(maxDownloads) : undefined;
    if (parsedMax !== undefined && (!Number.isInteger(parsedMax) || parsedMax < 1)) {
      setFormError('Download limit must be a positive whole number.');
      return;
    }
    try {
      const created = await createShare.mutateAsync({
        fileId,
        ...(password ? { password } : {}),
        ...(expiryDays > 0 ? { expiresInDays: expiryDays } : {}),
        ...(parsedMax ? { maxDownloads: parsedMax } : {}),
      });
      setResult(created);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const copy = async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nativeShare = async () => {
    if (!result) return;
    await Share.share({
      message: `A file from my QuickDrop vault: ${result.url}`,
      url: result.url,
      title: fileName,
    });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={result ? 'Share link ready' : 'Create a share link'}
      subtitle={result ? 'Copy it now. The raw link is shown only once.' : fileName}
    >
      {result ? (
        <View>
          <View
            style={{
              backgroundColor: theme.colors.primarySoft,
              borderRadius: theme.radii.lg,
              padding: 16,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="shield-checkmark" size={20} color={theme.colors.primary} />
              <AppText variant="smallStrong" color="primary">
                {result.share.hasPassword ? 'Password protected' : 'Anyone with the link'}
              </AppText>
            </View>
            <AppText selectable variant="small" style={{ lineHeight: 21 }}>
              {result.url}
            </AppText>
          </View>
          <Button
            label={copied ? 'Copied' : 'Copy link'}
            icon={copied ? 'checkmark' : 'copy-outline'}
            onPress={() => void copy()}
            style={{ marginTop: 16 }}
          />
          <Button
            label="Share with an app"
            variant="secondary"
            icon="share-outline"
            onPress={() => void nativeShare()}
            style={{ marginTop: 10 }}
          />
          <AppText variant="caption" color="textSecondary" style={{ marginTop: 14 }}>
            Revoke or regenerate this link any time from the Shares tab.
          </AppText>
          <Button label="Done" variant="ghost" onPress={onClose} style={{ marginTop: 8 }} />
        </View>
      ) : (
        <View>
          {formError ? (
            <View
              accessibilityRole="alert"
              style={{
                backgroundColor: theme.colors.dangerSoft,
                borderRadius: theme.radii.md,
                padding: 12,
                marginBottom: 14,
              }}
            >
              <AppText variant="small" color="danger">
                {formError}
              </AppText>
            </View>
          ) : null}
          <TextField
            label="Password (optional)"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <AppText variant="smallStrong" style={{ marginBottom: 8 }}>
            Expires
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {expiryOptions.map((option) => {
              const active = expiryDays === option.value;
              return (
                <Pressable
                  key={option.label}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setExpiryDays(option.value)}
                  style={{
                    minHeight: 48,
                    justifyContent: 'center',
                    paddingHorizontal: 15,
                    borderRadius: theme.radii.pill,
                    borderWidth: 1,
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                    backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface,
                  }}
                >
                  <AppText
                    variant="smallStrong"
                    color={active ? 'primary' : 'textSecondary'}
                  >
                    {option.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <TextField
            label="Download limit (optional)"
            value={maxDownloads}
            onChangeText={setMaxDownloads}
            placeholder="Unlimited"
            keyboardType="number-pad"
          />
          <Button
            label="Create secure link"
            icon="link-outline"
            onPress={() => void submit()}
            loading={createShare.isPending}
          />
        </View>
      )}
    </Sheet>
  );
}
