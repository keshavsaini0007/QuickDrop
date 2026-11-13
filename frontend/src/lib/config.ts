import Constants from 'expo-constants';
import { Platform } from 'react-native';

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const configuredShareBaseUrl = process.env.EXPO_PUBLIC_SHARE_BASE_URL?.trim();

/**
 * Expo injects EXPO_PUBLIC_* variables at build time. The fallback is useful for
 * local development, but a physical device must use the computer's LAN address
 * (or an HTTPS tunnel), not localhost. That requirement is documented in
 * SETUP.md and shown on the Settings screen in development.
 */
export const API_BASE_URL = normalizeUrl(configuredApiUrl || 'http://localhost:4000/api');
export const SHARE_BASE_URL = normalizeUrl(configuredShareBaseUrl || 'http://localhost:4000');
export const APP_SCHEME = process.env.EXPO_PUBLIC_APP_SCHEME || 'quickdrop';
export const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME || 'QuickDrop';
export const APP_VERSION =
  Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';

export const IS_WEB = Platform.OS === 'web';
export const IS_IOS = Platform.OS === 'ios';
export const IS_ANDROID = Platform.OS === 'android';
