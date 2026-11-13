import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import type { PickedUploadFile } from '@/types/api';
import { mimeTypeForName } from './format';

function extensionForMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
  };
  return map[mimeType] ?? 'bin';
}

async function sizeOf(uri: string, provided?: number): Promise<number> {
  if (provided && provided > 0) return provided;
  try {
    return new File(uri).size ?? 0;
  } catch {
    return 0;
  }
}

export async function pickPhotosAndVideos(): Promise<PickedUploadFile[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo access is required to choose files from the library.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: 10,
    quality: 1,
  });
  if (result.canceled) return [];

  const files: PickedUploadFile[] = [];
  for (const asset of result.assets) {
    const mimeType = asset.mimeType ?? mimeTypeForName(asset.fileName ?? asset.uri);
    files.push({
      uri: asset.uri,
      name:
        asset.fileName ??
        `quickdrop-${Date.now()}.${extensionForMime(mimeType)}`,
      mimeType,
      sizeBytes: await sizeOf(asset.uri, asset.fileSize),
    });
  }
  return files;
}

export async function takePhoto(): Promise<PickedUploadFile[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera access is required to take a photo.');
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (result.canceled) return [];
  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? 'image/jpeg';
  return [
    {
      uri: asset.uri,
      name: asset.fileName ?? `quickdrop-${Date.now()}.${extensionForMime(mimeType)}`,
      mimeType,
      sizeBytes: await sizeOf(asset.uri, asset.fileSize),
    },
  ];
}

export async function pickDocuments(): Promise<PickedUploadFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];

  const files: PickedUploadFile[] = [];
  for (const asset of result.assets) {
    // Some Android document providers report application/octet-stream even
    // when the extension is known. Fall back to the extension in that case.
    const mimeType =
      asset.mimeType && asset.mimeType !== 'application/octet-stream'
        ? asset.mimeType
        : mimeTypeForName(asset.name);
    files.push({
      uri: asset.uri,
      name: asset.name,
      mimeType,
      sizeBytes: await sizeOf(asset.uri, asset.size),
    });
  }
  return files;
}
