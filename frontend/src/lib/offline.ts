import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import type { FileDownload, FileItem } from '@/types/api';
import { useAuthStore } from '@/store/auth';
import { apiGet } from './api';
import { safeLocalFileName } from './format';

export interface OfflineFile {
  id: string;
  fileId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  localUri: string;
  savedAt: string;
}

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function database(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('quickdrop.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS offline_files (
          id TEXT PRIMARY KEY NOT NULL,
          owner_id TEXT NOT NULL DEFAULT '',
          file_id TEXT NOT NULL,
          name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          local_uri TEXT NOT NULL,
          saved_at TEXT NOT NULL
        );
      `);
      const columns = await db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(offline_files)',
      );
      if (!columns.some((column) => column.name === 'owner_id')) {
        await db.execAsync(
          "ALTER TABLE offline_files ADD COLUMN owner_id TEXT NOT NULL DEFAULT ''",
        );
      }
      // Rows written before per-account scoping cannot be attributed safely;
      // remove them instead of exposing them to the next account.
      await db.execAsync(`
        DELETE FROM offline_files WHERE owner_id = '';
        DROP INDEX IF EXISTS offline_files_file_id_unique;
        DELETE FROM offline_files
          WHERE rowid NOT IN (
            SELECT MAX(rowid) FROM offline_files GROUP BY owner_id, file_id
          );
        CREATE UNIQUE INDEX IF NOT EXISTS offline_files_owner_file_unique
          ON offline_files(owner_id, file_id);
      `);
      return db;
    });
  }
  return databasePromise;
}

function rowToOfflineFile(row: Record<string, unknown>): OfflineFile {
  return {
    id: String(row.id),
    fileId: String(row.file_id),
    name: String(row.name),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    localUri: String(row.local_uri),
    savedAt: String(row.saved_at),
  };
}

function currentOwnerId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

export async function listOfflineFiles(): Promise<OfflineFile[]> {
  if (Platform.OS === 'web') return [];
  const ownerId = currentOwnerId();
  if (!ownerId) return [];
  const db = await database();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM offline_files WHERE owner_id = ? ORDER BY saved_at DESC',
    ownerId,
  );
  const files: OfflineFile[] = [];
  for (const row of rows) {
    const record = rowToOfflineFile(row);
    try {
      if (new File(record.localUri).exists) files.push(record);
      else {
        await db.runAsync(
          'DELETE FROM offline_files WHERE id = ? AND owner_id = ?',
          record.id,
          ownerId,
        );
      }
    } catch {
      await db.runAsync(
        'DELETE FROM offline_files WHERE id = ? AND owner_id = ?',
        record.id,
        ownerId,
      );
    }
  }
  return files;
}

export async function getOfflineFile(fileId: string): Promise<OfflineFile | null> {
  if (Platform.OS === 'web') return null;
  const ownerId = currentOwnerId();
  if (!ownerId) return null;
  const db = await database();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM offline_files WHERE owner_id = ? AND file_id = ?',
    ownerId,
    fileId,
  );
  if (!row) return null;

  const record = rowToOfflineFile(row);
  try {
    if (new File(record.localUri).exists) return record;
  } catch {
    // Fall through to remove a stale record.
  }
  await db.runAsync(
    'DELETE FROM offline_files WHERE id = ? AND owner_id = ?',
    record.id,
    ownerId,
  );
  return null;
}

export async function saveFileOffline(file: FileItem): Promise<OfflineFile> {
  if (Platform.OS === 'web') {
    throw new Error('Offline downloads are available in the QuickDrop mobile app.');
  }
  const ownerId = currentOwnerId();
  if (!ownerId) throw new Error('Sign in before saving a file offline.');

  const download = await apiGet<FileDownload>(`/files/${file.id}/preview`);
  const directory = new Directory(Paths.document, 'quickdrop-offline');
  directory.create({ intermediates: true, idempotent: true });

  const localName = `${file.id}-${safeLocalFileName(file.name)}`;
  const destination = new File(directory, localName);
  await File.downloadFileAsync(download.url, destination, { idempotent: true });

  const saved: OfflineFile = {
    id: `${file.id}-${Date.now()}`,
    fileId: file.id,
    name: file.name,
    mimeType: file.mimeType,
    sizeBytes: destination.size ?? file.sizeBytes,
    localUri: destination.uri,
    savedAt: new Date().toISOString(),
  };

  const db = await database();
  // One offline copy per server file for the current account. Replacing by
  // owner and file id keeps repeated saves from creating duplicate rows
  // without touching another account's copy.
  await db.runAsync(
    'DELETE FROM offline_files WHERE owner_id = ? AND file_id = ?',
    ownerId,
    saved.fileId,
  );
  await db.runAsync(
    `INSERT INTO offline_files
      (id, owner_id, file_id, name, mime_type, size_bytes, local_uri, saved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    saved.id,
    ownerId,
    saved.fileId,
    saved.name,
    saved.mimeType,
    saved.sizeBytes,
    saved.localUri,
    saved.savedAt,
  );
  return saved;
}

export async function removeOfflineFile(record: OfflineFile): Promise<void> {
  if (Platform.OS === 'web') return;
  const ownerId = currentOwnerId();
  if (!ownerId) return;
  try {
    const file = new File(record.localUri);
    if (file.exists) file.delete();
  } catch {
    // The record should still be removed if the file was already gone.
  }
  const db = await database();
  await db.runAsync(
    'DELETE FROM offline_files WHERE id = ? AND owner_id = ?',
    record.id,
    ownerId,
  );
}

export function offlineFileForPreview(record: OfflineFile): File {
  return new File(record.localUri);
}
