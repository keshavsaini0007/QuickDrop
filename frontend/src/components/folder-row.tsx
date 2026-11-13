import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FolderItem } from '@/types/api';
import { formatDate } from '@/lib/format';
import { useAppTheme } from '@/theme';
import { AppText, IconButton } from './ui';

export function FolderRow({
  folder,
  onPress,
  onMore,
  subtitle,
}: {
  folder: FolderItem;
  onPress: () => void;
  onMore?: () => void;
  subtitle?: string;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Folder ${folder.name}`}
      android_ripple={{ color: theme.colors.surfaceMuted }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent',
          borderRadius: theme.radii.md,
        },
      ]}
    >
      <View
        style={[
          styles.icon,
          {
            backgroundColor: theme.colors.accentSoft,
            borderRadius: theme.radii.md,
          },
        ]}
      >
        <Ionicons name="folder" size={24} color={theme.colors.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {folder.name}
        </AppText>
        <AppText variant="caption" color="textSecondary" style={{ marginTop: 3 }}>
          {subtitle ?? `Created ${formatDate(folder.createdAt)}`}
        </AppText>
      </View>
      {onMore ? (
        <IconButton
          icon="ellipsis-horizontal"
          label={`More actions for folder ${folder.name}`}
          onPress={onMore}
          size={20}
          color="textSecondary"
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  icon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
