import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/theme';
import { AppText } from './ui';

export function BrandMark({ size = 48 }: { size?: number }) {
  const theme = useAppTheme();
  return (
    <View
      accessibilityLabel="QuickDrop"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primary,
      }}
    >
      <Ionicons name="cloud-done" size={size * 0.54} color={theme.colors.onPrimary} />
    </View>
  );
}

export function BrandRow({ compact = false }: { compact?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
      <BrandMark size={compact ? 34 : 42} />
      <View>
        <AppText variant={compact ? 'subheading' : 'heading'} style={{ letterSpacing: -0.5 }}>
          QuickDrop
        </AppText>
        {!compact ? (
          <AppText variant="caption" color="textSecondary">
            Your private vault, everywhere.
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
