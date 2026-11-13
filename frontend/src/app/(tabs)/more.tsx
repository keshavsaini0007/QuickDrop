import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '@/theme';
import { AppHeader, AppText, Card, OfflineBanner, Screen } from '@/components/ui';

const items: {
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}[] = [
  {
    href: '/activity',
    icon: 'time-outline',
    title: 'Activity',
    subtitle: 'Review uploads, downloads, shares, and account events',
  },
  {
    href: '/storage',
    icon: 'pie-chart-outline',
    title: 'Storage',
    subtitle: 'See usage, media breakdown, and cleanup actions',
  },
  {
    href: '/trash',
    icon: 'trash-outline',
    title: 'Recycle bin',
    subtitle: 'Restore or permanently delete trashed items',
  },
  {
    href: '/uploads',
    icon: 'cloud-upload-outline',
    title: 'Upload queue',
    subtitle: 'Check foreground uploads, retries, and failures',
  },
  {
    href: '/offline',
    icon: 'cloud-done-outline',
    title: 'Offline files',
    subtitle: 'Open copies saved on this device',
  },
];

export default function MoreScreen() {
  const theme = useAppTheme();
  const router = useRouter();

  return (
    <Screen scroll edges={['top']}>
      <AppHeader title="More" subtitle="Activity, storage, and offline tools" />
      <OfflineBanner />

      <Card style={{ paddingVertical: 0 }}>
        {items.map((item, index) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            accessibilityHint={item.subtitle}
            android_ripple={{ color: theme.colors.surfaceMuted }}
            onPress={() => router.push(item.href)}
            style={({ pressed }) => ({
              minHeight: 72,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 13,
              paddingVertical: 10,
              paddingHorizontal: 4,
              borderBottomWidth: index === items.length - 1 ? 0 : 1,
              borderBottomColor: theme.colors.border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primarySoft,
              }}
            >
              <Ionicons name={item.icon} size={21} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="bodyStrong">{item.title}</AppText>
              <AppText variant="caption" color="textSecondary" numberOfLines={2} style={{ marginTop: 2 }}>
                {item.subtitle}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}
