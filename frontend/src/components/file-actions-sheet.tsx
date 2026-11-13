import { useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import type { FileDownload, FileItem } from '@/types/api';
import { apiGet, errorMessage } from '@/lib/api';
import { saveFileOffline } from '@/lib/offline';
import { useFavoriteFile, useMoveFile, useRenameFile, useTrashFile } from '@/hooks/mutations';
import { useAppTheme } from '@/theme';
import { AppText, Sheet } from './ui';
import { PromptDialog } from './prompt-dialog';
import { MoveDialog } from './move-dialog';
import { ShareDialog } from './share-dialog';

function ActionRow({
  icon,
  label,
  onPress,
  danger = false,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        paddingHorizontal: 6,
        borderRadius: theme.radii.md,
        opacity: disabled ? 0.45 : pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: danger ? theme.colors.dangerSoft : theme.colors.surfaceMuted,
        }}
      >
        <Ionicons
          name={icon}
          size={20}
          color={danger ? theme.colors.danger : theme.colors.text}
        />
      </View>
      <AppText variant="body" color={danger ? 'danger' : 'text'} style={{ flex: 1 }}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
    </Pressable>
  );
}

export function FileActionsSheet({
  visible,
  file,
  onClose,
}: {
  visible: boolean;
  file: FileItem | null;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const renameFile = useRenameFile();
  const moveFile = useMoveFile();
  const favoriteFile = useFavoriteFile();
  const trashFile = useTrashFile();
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!file) return null;

  const closeAnd = (action: () => void) => {
    onClose();
    setTimeout(action, 180);
  };

  const download = async () => {
    try {
      const result = await apiGet<FileDownload>(`/files/${file.id}/download`);
      const supported = await Linking.canOpenURL(result.url);
      if (!supported) throw new Error('This device cannot open the download link.');
      await Linking.openURL(result.url);
    } catch (error) {
      Alert.alert('Download failed', errorMessage(error));
    }
  };

  const saveOffline = async () => {
    try {
      await saveFileOffline(file);
      await queryClient.invalidateQueries({ queryKey: ['offline'] });
      Alert.alert('Saved offline', `${file.name} is available in Offline files.`);
    } catch (error) {
      Alert.alert('Could not save offline', errorMessage(error));
    }
  };

  const confirmTrash = () => {
    Alert.alert(
      'Move to recycle bin?',
      `${file.name} will stay in the recycle bin until you permanently delete it or empty the bin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to bin',
          style: 'destructive',
          onPress: () => {
            trashFile.mutate(file.id, {
              onSuccess: onClose,
              onError: (error) => Alert.alert('Could not delete file', errorMessage(error)),
            });
          },
        },
      ],
    );
  };

  return (
    <>
      <Sheet
        visible={visible && !renameOpen && !moveOpen && !shareOpen}
        onClose={onClose}
        title={file.name}
        subtitle="File actions"
      >
        <View>
          <ActionRow
            icon="eye-outline"
            label="Preview"
            onPress={() => closeAnd(() => router.push(`/preview/${file.id}`))}
          />
          <ActionRow icon="download-outline" label="Download" onPress={() => closeAnd(() => void download())} />
          <ActionRow
            icon={file.isFavorite ? 'star' : 'star-outline'}
            label={file.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            onPress={() => {
              favoriteFile.mutate(
                { id: file.id, isFavorite: !file.isFavorite },
                {
                  onError: (error) => Alert.alert('Could not update favorite', errorMessage(error)),
                },
              );
              onClose();
            }}
          />
          <ActionRow
            icon="cloud-download-outline"
            label="Save offline"
            onPress={() => closeAnd(() => void saveOffline())}
          />
          <ActionRow
            icon="link-outline"
            label="Create share link"
            onPress={() => {
              setActionError(null);
              setShareOpen(true);
            }}
          />
          <ActionRow
            icon="pencil-outline"
            label="Rename"
            onPress={() => {
              setActionError(null);
              setRenameOpen(true);
            }}
          />
          <ActionRow
            icon="folder-open-outline"
            label="Move to folder"
            onPress={() => {
              setActionError(null);
              setMoveOpen(true);
            }}
          />
          <View
            style={{
              height: 1,
              backgroundColor: theme.colors.border,
              marginVertical: 6,
            }}
          />
          <ActionRow
            icon="trash-outline"
            label="Move to recycle bin"
            danger
            onPress={confirmTrash}
          />
        </View>
      </Sheet>

      {renameOpen ? <PromptDialog
        visible
        title="Rename file"
        label="File name"
        initialValue={file.name}
        confirmLabel="Rename"
        loading={renameFile.isPending}
        error={actionError}
        onCancel={() => {
          setRenameOpen(false);
          onClose();
        }}
        onSubmit={(name) => {
          setActionError(null);
          renameFile.mutate(
            { id: file.id, name },
            {
              onSuccess: () => {
                setRenameOpen(false);
                onClose();
              },
              onError: (error) => setActionError(errorMessage(error)),
            },
          );
        }}
      /> : null}
      {moveOpen ? <MoveDialog
        visible
        title={`Move ${file.name}`}
        currentParentId={file.folderId}
        loading={moveFile.isPending}
        error={actionError}
        onClose={() => {
          setMoveOpen(false);
          onClose();
        }}
        onMove={(folderId) => {
          setActionError(null);
          moveFile.mutate(
            { id: file.id, folderId },
            {
              onSuccess: () => {
                setMoveOpen(false);
                onClose();
              },
              onError: (error) => setActionError(errorMessage(error)),
            },
          );
        }}
      /> : null}
      {shareOpen ? (
        <ShareDialog
          visible
          fileId={file.id}
          fileName={file.name}
          onClose={() => {
            setShareOpen(false);
            onClose();
          }}
        />
      ) : null}
    </>
  );
}
