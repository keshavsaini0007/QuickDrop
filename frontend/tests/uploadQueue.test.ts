import { describe, expect, it } from '@jest/globals';
import { rowToItem } from '@/lib/uploadQueue';

describe('upload queue recovery', () => {
  it('maps a persisted interrupted upload back to queued', () => {
    const item = rowToItem({
      id: 'upload-1',
      owner_id: 'user-1',
      local_uri: 'file:///cache/photo.jpg',
      file_name: 'photo.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 2048,
      folder_id: null,
      status: 'uploading',
      progress: 0.42,
      error: null,
      created_at: '2026-01-01T00:00:00.000Z',
      attempts: 1,
      server_file_id: null,
      session_id: 'session-1',
    });

    expect(item.status).toBe('queued');
    expect(item.ownerId).toBe('user-1');
    expect(item.progress).toBe(0.42);
    expect(item.folderId).toBeNull();
    expect(item.sessionId).toBe('session-1');
    expect(item.attempts).toBe(1);
  });

  it('keeps terminal states intact and restores folder ids', () => {
    const item = rowToItem({
      id: 'upload-2',
      owner_id: 'user-1',
      local_uri: 'file:///cache/report.pdf',
      file_name: 'report.pdf',
      mime_type: 'application/pdf',
      size_bytes: 5000,
      folder_id: 'folder-9',
      status: 'error',
      progress: 0,
      error: 'Cloudinary rejected the upload.',
      created_at: '2026-01-01T00:00:00.000Z',
      attempts: 2,
      server_file_id: null,
      session_id: null,
    });

    expect(item.status).toBe('error');
    expect(item.folderId).toBe('folder-9');
    expect(item.error).toBe('Cloudinary rejected the upload.');
    expect(item.attempts).toBe(2);
  });
});
