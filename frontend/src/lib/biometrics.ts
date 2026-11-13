import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

export interface BiometricSupport {
  available: boolean;
  enrolled: boolean;
  label: string;
}

export async function getBiometricSupport(): Promise<BiometricSupport> {
  if (Platform.OS === 'web') {
    return { available: false, enrolled: false, label: 'Biometrics' };
  }
  const [available, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  let label = 'Biometrics';
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    label = Platform.OS === 'ios' ? 'Face ID' : 'Face unlock';
  } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    label = Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
  } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    label = 'Iris unlock';
  }

  return { available, enrolled, label };
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock QuickDrop',
    cancelLabel: 'Use later',
    disableDeviceFallback: false,
  });
  return result.success;
}
