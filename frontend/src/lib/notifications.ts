import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

let configured = false;

export async function configureNotifications(): Promise<void> {
  if (configured || Platform.OS === 'web') return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('uploads', {
      name: 'Uploads',
      importance: AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180],
      lightColor: '#0F766E',
    });
  }
}

export async function notificationPermissionGranted(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  return current.granted;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await configureNotifications();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function notifyUploadComplete(fileName: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await configureNotifications();
    const permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Upload complete',
        body: `${fileName} is now in your QuickDrop vault.`,
        ...(Platform.OS === 'android' ? { channelId: 'uploads' } : {}),
      },
      trigger: null,
    });
  } catch {
    // Notifications are best-effort and must never fail an upload.
  }
}
