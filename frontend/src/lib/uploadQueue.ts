import NetInfo from '@react-native-community/netinfo';
import { File, UploadType } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { create } from 'zustand';
import type { FileItem, PickedUploadFile, UploadSignature } from '@/types/api';
import { apiPost, errorMessage } from './api';
import { queryClient, queryKeys } from './queryClient';
import { notifyUploadComplete } from './notifications';
import { useAuthStore } from '@/store/auth';
import { usePreferencesStore } from '@/store/preferences';

export type UploadStatus =
  | 'queued'
  | 'signing'
  | 'uploading'
  | 'confirming'
  | 'complete'
  | 'error'
  | 'cancelled';

export interface UploadItem {
  id: string;
  ownerId: string;
  localUri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  folderId: string | null;
  status: UploadStatus;
  progress: number;
  error: string | null;
  createdAt: string;
  attempts: number;
  serverFileId: string | null;
  sessionId: string | null;
}

interface UploadState {
  items: UploadItem[];
  hydrated: boolean;
  isProcessing: boolean;
  hydrate: () => Promise<void>;
  enqueue: (files: PickedUploadFile[], folderId: string | null) => Promise<void>;
  processQueue: () => Promise<void>;
  retry: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  clearFinished: () => Promise<void>;
  pauseAll: () => Promise<void>;
}

const DB_NAME = 'quickdrop.db';
const MAX_SINGLE_UPLOAD_BYTES = 100 * 1024 * 1024;
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let hydrationPromise: Promise<void> | null = null;
const activeTasks = new Map<string, { cancel: () => void }>();
let processing = false;
let hydratedOwnerId: string | null = null;

function currentOwnerId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

async function database(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS upload_queue (
          id TEXT PRIMARY KEY NOT NULL,
          owner_id TEXT NOT NULL DEFAULT '',
          local_uri TEXT NOT NULL,
          file_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          folder_id TEXT,
          status TEXT NOT NULL,
          progress REAL NOT NULL DEFAULT 0,
          error TEXT,
          created_at TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          server_file_id TEXT,
          session_id TEXT
        );
      `);
      const columns = await db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(upload_queue)',
      );
      if (!columns.some((column) => column.name === 'owner_id')) {
        await db.execAsync(
          "ALTER TABLE upload_queue ADD COLUMN owner_id TEXT NOT NULL DEFAULT ''",
        );
      }
      // Unscoped rows from earlier builds cannot be attributed safely. Delete
      // them rather than uploading them into the next account that signs in.
      await db.execAsync(`
        DELETE FROM upload_queue WHERE owner_id = '';
        CREATE INDEX IF NOT EXISTS upload_queue_owner_status
          ON upload_queue(owner_id, status);
      `);
      return db;
    });
  }
  return databasePromise;
}

export function rowToItem(row: Record<string, unknown>): UploadItem {
  const rawStatus = String(row.status);
  const status: UploadStatus =
    rawStatus === 'signing' || rawStatus === 'uploading' || rawStatus === 'confirming'
      ? 'queued'
      : (rawStatus as UploadStatus);
  return {
    id: String(row.id),
    ownerId: String(row.owner_id ?? ''),
    localUri: String(row.local_uri),
    fileName: String(row.file_name),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    folderId: row.folder_id ? String(row.folder_id) : null,
    status,
    progress: Number(row.progress ?? 0),
    error: row.error ? String(row.error) : null,
    createdAt: String(row.created_at),
    attempts: Number(row.attempts ?? 0),
    serverFileId: row.server_file_id ? String(row.server_file_id) : null,
    sessionId: row.session_id ? String(row.session_id) : null,
  };
}

async function insertItem(item: UploadItem): Promise<void> {
  const db = await database();
  await db.runAsync(
    `INSERT INTO upload_queue
      (id, owner_id, local_uri, file_name, mime_type, size_bytes, folder_id, status, progress, error, created_at, attempts, server_file_id, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.id,
    item.ownerId,
    item.localUri,
    item.fileName,
    item.mimeType,
    item.sizeBytes,
    item.folderId,
    item.status,
    item.progress,
    item.error,
    item.createdAt,
    item.attempts,
    item.serverFileId,
    item.sessionId,
  );
}

async function updateItemRow(item: UploadItem): Promise<void> {
  const db = await database();
  await db.runAsync(
    `UPDATE upload_queue SET status = ?, progress = ?, error = ?, attempts = ?, server_file_id = ?, session_id = ? WHERE id = ?`,
    item.status,
    item.progress,
    item.error,
    item.attempts,
    item.serverFileId,
    item.sessionId,
    item.id,
  );
}

function uploadId(): string {
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function invalidateUploadQueries(): void {
  void queryClient.invalidateQueries({ queryKey: ['files'] });
  void queryClient.invalidateQueries({ queryKey: ['folders'] });
  void queryClient.invalidateQueries({ queryKey: ['storage'] });
  void queryClient.invalidateQueries({ queryKey: ['activity'] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.me });
}

async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected !== false && state.isInternetReachable !== false;
}

export const useUploadStore = create<UploadState>((set, get) => {
  const patchItem = async (id: string, patch: Partial<UploadItem>, persist = true) => {
    let next: UploadItem | undefined;
    set((state) => ({
      items: state.items.map((item) => {
        if (item.id !== id) return item;
        next = { ...item, ...patch };
        return next;
      }),
    }));
    if (next && persist) await updateItemRow(next);
  };

  const processOne = async (item: UploadItem): Promise<void> => {
    const currentItem = () => get().items.find((entry) => entry.id === item.id);
    const cancelledOrRemoved = () => {
      const current = currentItem();
      return (
        !current ||
        current.status === 'cancelled' ||
        currentOwnerId() !== item.ownerId
      );
    };

    if (item.sizeBytes > MAX_SINGLE_UPLOAD_BYTES) {
      throw new Error(
        'This file is too large for the single-request uploader in this build. Chunked mobile uploads are not enabled yet.',
      );
    }

    const source = new File(item.localUri);
    if (!source.exists) {
      throw new Error('The selected file is no longer available. Pick it again.');
    }

    await patchItem(item.id, {
      status: 'signing',
      error: null,
      progress: 0,
      attempts: item.attempts + 1,
    });

    const signature = await apiPost<UploadSignature>('/files/upload/sign', {
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      ...(item.folderId ? { folderId: item.folderId } : {}),
    });

    if (cancelledOrRemoved()) return;

    await patchItem(item.id, {
      status: 'uploading',
      sessionId: signature.sessionId,
      progress: 0,
    });

    if (!source.exists) {
      throw new Error('The selected file is no longer available. Pick it again.');
    }

    let lastPersisted = 0;
    const task = source.createUploadTask(signature.uploadUrl, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType: item.mimeType,
      parameters: signature.params,
      sessionType: 'foreground',
      onProgress: ({ bytesSent, totalBytes }) => {
        const progress = totalBytes > 0 ? Math.min(0.99, bytesSent / totalBytes) : 0;
        if (progress - lastPersisted >= 0.04 || progress >= 0.99) {
          lastPersisted = progress;
          void patchItem(item.id, { progress }, false);
        } else {
          set((state) => ({
            items: state.items.map((current) =>
              current.id === item.id ? { ...current, progress } : current,
            ),
          }));
        }
      },
    });
    activeTasks.set(item.id, { cancel: () => void task.cancel() });

    let result;
    try {
      result = await task.uploadAsync();
    } finally {
      activeTasks.delete(item.id);
    }

    if (cancelledOrRemoved()) return;

    if (result.status < 200 || result.status >= 300) {
      let cloudinaryMessage = 'Cloudinary rejected the upload.';
      try {
        const body = JSON.parse(result.body) as { error?: { message?: string } };
        if (body.error?.message) cloudinaryMessage = body.error.message;
      } catch {
        // Keep the generic message if Cloudinary did not return JSON.
      }
      throw new Error(cloudinaryMessage);
    }

    await patchItem(item.id, { status: 'confirming', progress: 0.99 });
    const created = await apiPost<FileItem>(
      `/files/upload/${signature.sessionId}/confirm`,
      {},
    );

    await patchItem(item.id, {
      status: 'complete',
      progress: 1,
      serverFileId: created.id,
      error: null,
    });

    invalidateUploadQueries();
    void useAuthStore.getState().refreshProfile().catch(() => undefined);
    if (usePreferencesStore.getState().notificationsEnabled) {
      void notifyUploadComplete(created.name);
    }
  };

  return {
    items: [],
    hydrated: false,
    isProcessing: false,

    hydrate: async () => {
      const ownerId = currentOwnerId();
      if (!ownerId) {
        hydratedOwnerId = null;
        set({ items: [], hydrated: true });
        return;
      }
      if (get().hydrated && hydratedOwnerId === ownerId) return;
      if (hydrationPromise) {
        await hydrationPromise;
        if (currentOwnerId() !== ownerId) return get().hydrate();
        return;
      }
      hydrationPromise = (async () => {
        try {
          const db = await database();
          const rows = await db.getAllAsync<Record<string, unknown>>(
            'SELECT * FROM upload_queue WHERE owner_id = ? ORDER BY created_at ASC',
            ownerId,
          );
          if (currentOwnerId() !== ownerId) return;
          const items = rows.map(rowToItem);
          set({ items, hydrated: true });
          hydratedOwnerId = ownerId;
          for (const item of items) {
            if (item.status === 'queued') await updateItemRow(item);
          }
        } catch {
          // A corrupt or unavailable local queue must not block the app.
          set({ hydrated: true });
          hydratedOwnerId = ownerId;
        } finally {
          hydrationPromise = null;
        }
      })();
      return hydrationPromise;
    },

    enqueue: async (files, folderId) => {
      const ownerId = currentOwnerId();
      if (!ownerId) throw new Error('Sign in before adding files to the upload queue.');
      const items: UploadItem[] = files.map((file) => ({
        id: uploadId(),
        ownerId,
        localUri: file.uri,
        fileName: file.name,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        folderId,
        status: 'queued',
        progress: 0,
        error: null,
        createdAt: new Date().toISOString(),
        attempts: 0,
        serverFileId: null,
        sessionId: null,
      }));
      set((state) => ({ items: [...state.items, ...items] }));
      for (const item of items) await insertItem(item);
      void get().processQueue();
    },

    processQueue: async () => {
      if (processing) return;
      processing = true;
      set({ isProcessing: true });
      try {
        if (!(await isOnline())) return;
        const ownerId = currentOwnerId();
        if (!ownerId) return;
        let next = get().items.find(
          (item) => item.status === 'queued' && item.ownerId === ownerId,
        );
        while (next) {
          if (currentOwnerId() !== ownerId) return;
          const currentId = next.id;
          try {
            await processOne(next);
          } catch (error) {
            const current = get().items.find((item) => item.id === currentId);
            const ownerChanged = current ? current.ownerId !== currentOwnerId() : false;
            if (!current || current.status === 'cancelled' || ownerChanged) {
              // The user cancelled, removed, or signed out of this item while
              // the request was in flight. Do not overwrite that decision.
            } else if (!(await isOnline())) {
              await patchItem(currentId, { status: 'queued', error: null });
              return;
            } else {
              await patchItem(currentId, {
                status: 'error',
                error: errorMessage(error),
                progress: 0,
              });
            }
          }
          if (!(await isOnline())) return;
          next = get().items.find(
            (item) => item.status === 'queued' && item.ownerId === ownerId,
          );
        }
      } finally {
        processing = false;
        set({ isProcessing: false });
      }
    },

    retry: async (id) => {
      await patchItem(id, { status: 'queued', error: null, progress: 0 });
      void get().processQueue();
    },

    remove: async (id) => {
      activeTasks.get(id)?.cancel();
      activeTasks.delete(id);
      set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
      const db = await database();
      await db.runAsync('DELETE FROM upload_queue WHERE id = ?', id);
    },

    cancel: async (id) => {
      activeTasks.get(id)?.cancel();
      activeTasks.delete(id);
      await patchItem(id, { status: 'cancelled', error: 'Upload cancelled.', progress: 0 });
    },

    clearFinished: async () => {
      const finished = get().items.filter(
        (item) => item.status === 'complete' || item.status === 'cancelled',
      );
      set((state) => ({
        items: state.items.filter(
          (item) => item.status !== 'complete' && item.status !== 'cancelled',
        ),
      }));
      const db = await database();
      for (const item of finished) {
        await db.runAsync('DELETE FROM upload_queue WHERE id = ?', item.id);
      }
    },

    pauseAll: async () => {
      for (const [id, task] of activeTasks) {
        task.cancel();
        activeTasks.delete(id);
      }
      const active = get().items.filter(
        (item) =>
          item.status === 'signing' ||
          item.status === 'uploading' ||
          item.status === 'confirming',
      );
      for (const item of active) {
        await patchItem(item.id, {
          status: 'queued',
          progress: 0,
          error: null,
          sessionId: null,
        });
      }
    },
  };
});
