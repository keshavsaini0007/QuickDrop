import { describe, expect, it } from '@jest/globals';
import {
  fileExtension,
  formatBytes,
  formatDuration,
  initials,
  mediaLabel,
  mimeTypeForName,
  safeLocalFileName,
} from '@/lib/format';

describe('format helpers', () => {
  it('formats byte values across units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB');
  });

  it('formats durations and initials', () => {
    expect(formatDuration(0)).toBe('');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3600)).toBe('60:00');
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('  quickdrop  ')).toBe('Q');
  });

  it('derives extensions and MIME types', () => {
    expect(fileExtension('archive.tar.gz')).toBe('GZ');
    expect(fileExtension('README')).toBe('FILE');
    expect(mimeTypeForName('photo.JPG')).toBe('image/jpeg');
    expect(mimeTypeForName('clip.mov')).toBe('video/quicktime');
    expect(mimeTypeForName('notes.unknown')).toBe('application/octet-stream');
  });

  it('labels the media types returned by the API', () => {
    expect(mediaLabel('image')).toBe('Image');
    expect(mediaLabel('document')).toBe('Document');
    expect(mediaLabel('archive')).toBe('Archive');
    expect(mediaLabel('other')).toBe('File');
  });

  it('sanitises local file names without leaving path separators', () => {
    const safe = safeLocalFileName('../../My report (final).pdf');
    expect(safe).not.toContain('/');
    expect(safe).not.toContain('\\');
    expect(safe).toContain('My_report');
    expect(safe.length).toBeLessThanOrEqual(120);
  });
});
