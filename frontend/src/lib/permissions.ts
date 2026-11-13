import { Linking } from 'react-native';

export function isPermissionError(message: string): boolean {
  return /permission|access is required|denied|not authorized/i.test(message);
}

export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Some platforms cannot open settings directly; the caller's alert remains
    // the recovery path.
  }
}
