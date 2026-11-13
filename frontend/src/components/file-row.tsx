import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { FileItem } from '@/types/api';
import { formatBytes, formatDate, mediaLabel } from '@/lib/format';
import { useAppTheme } from '@/theme';
import { AppText, IconButton } from './ui';

const iconByType: Record<FileItem['mediaType'], keyof typeof Ionicons.glyphMap> = {
  image: 'image-outline',
  video: 'videocam-outline',
  audio: 'musical-notes-outline',
  document: 'document-text-outline',
  archive: 'archive-outline',
  other: 'document-outline',
};

export function FileRow({
  file,
  onPress,
  onMore,
  subtitle,
  showFavorite = true,
}: {
  file: FileItem;
  onPress: () => void;
  onMore?: () => void;
  subtitle?: string;
  showFavorite?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${file.name}, ${mediaLabel(file.mediaType)}, ${formatBytes(file.sizeBytes)}`}
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
          styles.thumbnail,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
          },
        ]}
      >
        {file.thumbnailUrl ? (
          <Image
            source={{ uri: file.thumbnailUrl }}
            style={styles.thumbnailImage}
            contentFit="cover"
            transition={150}
            accessibilityLabel={`${file.name} thumbnail`}
          />
        ) : (
          <Ionicons
            name={iconByType[file.mediaType]}
            size={24}
            color={theme.colors.primary}
          />
        )}
        {file.mediaType === 'video' ? (
          <View style={styles.playBadge}>
            <Ionicons name="play" size={10} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <AppText variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
            {file.name}
          </AppText>
          {showFavorite && file.isFavorite ? (
            <Ionicons name="star" size={13} color={theme.colors.accent} />
          ) : null}
        </View>
        <AppText variant="caption" color="textSecondary" numberOfLines={1} style={{ marginTop: 3 }}>
          {subtitle ?? `${formatBytes(file.sizeBytes)} · ${formatDate(file.createdAt)}`}
        </AppText>
      </View>
      {onMore ? (
        <IconButton
          icon="ellipsis-horizontal"
          label={`More actions for ${file.name}`}
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
    minHeight: 68,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbnailImage: { width: '100%', height: '100%' },
  playBadge: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
