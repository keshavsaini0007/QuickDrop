import { useState } from 'react';
import { Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import type { CreatedShare } from '@/types/api';
import { useAppTheme } from '@/theme';
import { AppText, Button, Sheet } from './ui';

export function ShareLinkDialog({
  result,
  visible,
  onClose,
}: {
  result: CreatedShare | null;
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const copy = async () => {
    await Clipboard.setStringAsync(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Share link ready"
      subtitle="Copy it now. The raw link is shown only once."
    >
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
        onPress={() =>
          void Share.share({
            message: `A file from my QuickDrop vault: ${result.url}`,
            url: result.url,
            title: result.share.fileName ?? 'QuickDrop share',
          })
        }
        style={{ marginTop: 10 }}
      />
      <Button label="Done" variant="ghost" onPress={onClose} style={{ marginTop: 8 }} />
    </Sheet>
  );
}
