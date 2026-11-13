import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FolderItem } from '@/types/api';
import { useAllFolders } from '@/hooks/queries';
import { useAppTheme } from '@/theme';
import { AppText, Button, LoadingState, Sheet } from './ui';

function depthMap(folders: FolderItem[]): Map<string, number> {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const depths = new Map<string, number>();
  const resolve = (folder: FolderItem, seen: Set<string>): number => {
    if (depths.has(folder.id)) return depths.get(folder.id) ?? 0;
    if (!folder.parentId || seen.has(folder.id)) return 0;
    const parent = byId.get(folder.parentId);
    if (!parent) return 0;
    seen.add(folder.id);
    const depth = resolve(parent, seen) + 1;
    depths.set(folder.id, depth);
    return depth;
  };
  for (const folder of folders) resolve(folder, new Set());
  return depths;
}

export function MoveDialog({
  visible,
  title,
  currentParentId,
  excludeFolderId,
  loading = false,
  error,
  onClose,
  onMove,
}: {
  visible: boolean;
  title: string;
  currentParentId: string | null;
  excludeFolderId?: string;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onMove: (folderId: string | null) => void;
}) {
  const theme = useAppTheme();
  const foldersQuery = useAllFolders(visible);
  const [selected, setSelected] = useState<string | null>(currentParentId);

  const excludedIds = useMemo(() => {
    const excluded = new Set<string>();
    if (!excludeFolderId) return excluded;
    excluded.add(excludeFolderId);
    const all = foldersQuery.data ?? [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const folder of all) {
        if (folder.parentId && excluded.has(folder.parentId) && !excluded.has(folder.id)) {
          excluded.add(folder.id);
          changed = true;
        }
      }
    }
    return excluded;
  }, [excludeFolderId, foldersQuery.data]);

  const folders = useMemo(
    () => (foldersQuery.data ?? []).filter((folder) => !excludedIds.has(folder.id)),
    [excludedIds, foldersQuery.data],
  );
  const depths = useMemo(() => depthMap(folders), [folders]);

  const renderOption = (id: string | null, name: string, depth: number) => {
    const isSelected = selected === id;
    return (
      <Pressable
        key={id ?? 'root'}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        onPress={() => setSelected(id)}
        style={({ pressed }) => ({
          minHeight: 50,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 8,
          paddingHorizontal: 10,
          marginLeft: depth * 16,
          borderRadius: theme.radii.md,
          backgroundColor: isSelected
            ? theme.colors.primarySoft
            : pressed
              ? theme.colors.surfaceMuted
              : 'transparent',
        })}
      >
        <Ionicons
          name={id ? 'folder-outline' : 'home-outline'}
          size={20}
          color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
        />
        <AppText
          variant="body"
          color={isSelected ? 'primary' : 'text'}
          numberOfLines={1}
          style={{ flex: 1 }}
        >
          {name}
        </AppText>
        {isSelected ? (
          <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
        ) : null}
      </Pressable>
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle="Choose a destination folder.">
      {foldersQuery.isLoading ? <LoadingState label="Loading folders…" /> : null}
      {foldersQuery.isError ? (
        <AppText variant="small" color="danger" style={{ marginBottom: 12 }}>
          {foldersQuery.error.message}
        </AppText>
      ) : null}
      {renderOption(null, 'My vault (root)', 0)}
      {folders.map((folder) =>
        renderOption(folder.id, folder.name, depths.get(folder.id) ?? 0),
      )}
      {error ? (
        <AppText variant="small" color="danger" style={{ marginTop: 10 }}>
          {error}
        </AppText>
      ) : null}
      <Button
        label="Move here"
        onPress={() => onMove(selected)}
        loading={loading}
        style={{ marginTop: 18 }}
      />
    </Sheet>
  );
}
