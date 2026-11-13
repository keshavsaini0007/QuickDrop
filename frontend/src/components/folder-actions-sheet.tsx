import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FolderItem } from '@/types/api';
import { errorMessage } from '@/lib/api';
import { useMoveFolder, useRenameFolder, useTrashFolder } from '@/hooks/mutations';
import { useAppTheme } from '@/theme';
import { AppText, Sheet } from './ui';
import { PromptDialog } from './prompt-dialog';
import { MoveDialog } from './move-dialog';

function Row({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        paddingHorizontal: 6,
        borderRadius: theme.radii.md,
        opacity: pressed ? 0.6 : 1,
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

export function FolderActionsSheet({
  visible,
  folder,
  onClose,
}: {
  visible: boolean;
  folder: FolderItem | null;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  const renameFolder = useRenameFolder();
  const moveFolder = useMoveFolder();
  const trashFolder = useTrashFolder();
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!folder) return null;

  const confirmTrash = () => {
    Alert.alert(
      'Move folder to recycle bin?',
      `${folder.name} and everything inside it will stay in the recycle bin until permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to bin',
          style: 'destructive',
          onPress: () =>
            trashFolder.mutate(folder.id, {
              onSuccess: onClose,
              onError: (error) => Alert.alert('Could not delete folder', errorMessage(error)),
            }),
        },
      ],
    );
  };

  return (
    <>
      <Sheet
        visible={visible && !renameOpen && !moveOpen}
        onClose={onClose}
        title={folder.name}
        subtitle="Folder actions"
      >
        <Row
          icon="pencil-outline"
          label="Rename folder"
          onPress={() => {
            setActionError(null);
            setRenameOpen(true);
          }}
        />
        <Row
          icon="folder-open-outline"
          label="Move to folder"
          onPress={() => {
            setActionError(null);
            setMoveOpen(true);
          }}
        />
        <View
          style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 6 }}
        />
        <Row icon="trash-outline" label="Move to recycle bin" danger onPress={confirmTrash} />
      </Sheet>

      {renameOpen ? (
        <PromptDialog
          visible
          title="Rename folder"
          label="Folder name"
          initialValue={folder.name}
          confirmLabel="Rename"
          loading={renameFolder.isPending}
          error={actionError}
          onCancel={() => {
            setRenameOpen(false);
            onClose();
          }}
          onSubmit={(name) => {
            setActionError(null);
            renameFolder.mutate(
              { id: folder.id, name },
              {
                onSuccess: () => {
                  setRenameOpen(false);
                  onClose();
                },
                onError: (error) => setActionError(errorMessage(error)),
              },
            );
          }}
        />
      ) : null}
      {moveOpen ? (
        <MoveDialog
          visible
          title={`Move ${folder.name}`}
          currentParentId={folder.parentId}
          excludeFolderId={folder.id}
          loading={moveFolder.isPending}
          error={actionError}
          onClose={() => {
            setMoveOpen(false);
            onClose();
          }}
          onMove={(parentId) => {
            setActionError(null);
            moveFolder.mutate(
              { id: folder.id, parentId },
              {
                onSuccess: () => {
                  setMoveOpen(false);
                  onClose();
                },
                onError: (error) => setActionError(errorMessage(error)),
              },
            );
          }}
        />
      ) : null}
    </>
  );
}
