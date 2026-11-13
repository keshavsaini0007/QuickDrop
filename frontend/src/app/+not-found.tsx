import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/theme';
import { AppText, Button, Screen } from '@/components/ui';

export default function NotFoundScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <View
          style={{
            width: 78,
            height: 78,
            borderRadius: 26,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.primarySoft,
            marginBottom: 20,
          }}
        >
          <Ionicons name="compass-outline" size={36} color={theme.colors.primary} />
        </View>
        <AppText variant="title" style={{ textAlign: 'center' }}>
          This page does not exist
        </AppText>
        <AppText
          variant="body"
          color="textSecondary"
          style={{ textAlign: 'center', marginTop: 8, maxWidth: 320 }}
        >
          The link may be old, or the screen may have moved. Your vault is still safe.
        </AppText>
        <Button
          label="Return to QuickDrop"
          onPress={() => router.replace('/(tabs)')}
          fullWidth={false}
          style={{ marginTop: 26, minWidth: 220 }}
        />
      </View>
    </Screen>
  );
}
