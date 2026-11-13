import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import type { User } from '@/types/api';
import { useAuthStore } from '@/store/auth';
import { usePreferencesStore } from '@/store/preferences';
import { useStorage } from '@/hooks/queries';
import { errorMessage } from '@/lib/api';
import { API_BASE_URL, APP_NAME, APP_VERSION } from '@/lib/config';
import { openAppSettings } from '@/lib/permissions';
import {
  authenticateWithBiometrics,
  getBiometricSupport,
  type BiometricSupport,
} from '@/lib/biometrics';
import {
  notificationPermissionGranted,
  requestNotificationPermission,
} from '@/lib/notifications';
import { changePasswordSchema, profileSchema } from '@/lib/validation';
import { formatBytes } from '@/lib/format';
import type { ThemeMode } from '@/theme/tokens';
import { useAppTheme } from '@/theme';
import {
  AppHeader,
  AppText,
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  OfflineBanner,
  Screen,
  SectionHeader,
  Sheet,
  StorageBar,
  TextField,
} from '@/components/ui';

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof changePasswordSchema>;

function SettingRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
}) {
  const theme = useAppTheme();
  const content = (
    <View
      style={{
        minHeight: 62,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 9,
        paddingHorizontal: 4,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: danger ? theme.colors.dangerSoft : theme.colors.surfaceMuted,
        }}
      >
        <Ionicons
          name={icon}
          size={19}
          color={danger ? theme.colors.danger : theme.colors.text}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="bodyStrong" color={danger ? 'danger' : 'text'}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} /> : null)}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      android_ripple={{ color: theme.colors.surfaceMuted }}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.58 : 1 })}
    >
      {content}
    </Pressable>
  );
}

function ProfileSheet({
  visible,
  user,
  onClose,
}: {
  visible: boolean;
  user: User;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, email: user.email, currentPassword: '' },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (visible) {
      reset({ name: user.name, email: user.email, currentPassword: '' });
    }
  }, [reset, user.email, user.name, visible]);

  const emailValue = useWatch({ control, name: 'email' });
  const emailChanged = (emailValue ?? '').trim().toLowerCase() !== user.email.toLowerCase();

  const submit = handleSubmit(async (values) => {
    if (emailChanged && !values.currentPassword) {
      setError('currentPassword', {
        message: 'Current password is required to change email.',
      });
      return;
    }
    try {
      await updateProfile({
        name: values.name,
        email: values.email,
        ...(emailChanged && values.currentPassword
          ? { currentPassword: values.currentPassword }
          : {}),
      });
      onClose();
    } catch (error) {
      setError('root', { message: errorMessage(error) });
    }
  });

  return (
    <Sheet visible={visible} onClose={onClose} title="Edit profile" subtitle="Your account details">
      {errors.root?.message ? (
        <View
          accessibilityRole="alert"
          style={{
            backgroundColor: theme.colors.dangerSoft,
            borderRadius: theme.radii.md,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <AppText variant="small" color="danger">
            {errors.root.message}
          </AppText>
        </View>
      ) : null}
      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Name"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.name?.message}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Email"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.email?.message}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
          />
        )}
      />
      {emailChanged ? (
        <Controller
          control={control}
          name="currentPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              label="Current password"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.currentPassword?.message}
              hint="Required to confirm an email change."
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
            />
          )}
        />
      ) : null}
      <Button label="Save changes" onPress={() => void submit()} loading={isSubmitting} />
    </Sheet>
  );
}

function PasswordSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useAppTheme();
  const changePassword = useAuthStore((state) => state.changePassword);
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (visible) reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
  }, [reset, visible]);

  const submit = handleSubmit(async (values) => {
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      onClose();
      Alert.alert('Password changed', 'Other sessions have been signed out.');
    } catch (error) {
      setError('root', { message: errorMessage(error) });
    }
  });

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Change password"
      subtitle="Other sessions will be signed out."
    >
      {errors.root?.message ? (
        <View
          accessibilityRole="alert"
          style={{
            backgroundColor: theme.colors.dangerSoft,
            borderRadius: theme.radii.md,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <AppText variant="small" color="danger">
            {errors.root.message}
          </AppText>
        </View>
      ) : null}
      <Controller
        control={control}
        name="currentPassword"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Current password"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.currentPassword?.message}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
          />
        )}
      />
      <Controller
        control={control}
        name="newPassword"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="New password"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.newPassword?.message}
            hint="At least 8 characters with a letter and a number."
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
          />
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Confirm new password"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.confirmPassword?.message}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={() => void submit()}
          />
        )}
      />
      <Button label="Update password" onPress={() => void submit()} loading={isSubmitting} />
    </Sheet>
  );
}

export default function SettingsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const logoutAll = useAuthStore((state) => state.logoutAll);
  const storage = useStorage();
  const themeMode = usePreferencesStore((state) => state.themeMode);
  const setThemeMode = usePreferencesStore((state) => state.setThemeMode);
  const notificationsEnabled = usePreferencesStore((state) => state.notificationsEnabled);
  const setNotificationsEnabled = usePreferencesStore(
    (state) => state.setNotificationsEnabled,
  );
  const biometricEnabled = usePreferencesStore((state) => state.biometricEnabled);
  const setBiometricEnabled = usePreferencesStore((state) => state.setBiometricEnabled);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [biometricSupport, setBiometricSupport] = useState<BiometricSupport | null>(null);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [togglingBiometric, setTogglingBiometric] = useState(false);

  useEffect(() => {
    void getBiometricSupport().then(setBiometricSupport);
    void notificationPermissionGranted().then((granted) => {
      setPermissionChecked(true);
      if (!granted && notificationsEnabled) void setNotificationsEnabled(false);
    });
  }, [notificationsEnabled, setNotificationsEnabled]);

  if (!user) return null;

  const summary = storage.data?.summary;
  const themeOptions: { key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
    { key: 'light', label: 'Light', icon: 'sunny-outline' },
    { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  ];

  const toggleNotifications = async (enabled: boolean) => {
    if (!enabled) {
      await setNotificationsEnabled(false);
      return;
    }
    const granted = await requestNotificationPermission();
    if (!granted) {
      Alert.alert(
        'Notifications are off',
        'Enable notifications for QuickDrop in your device settings to receive upload updates.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => void openAppSettings() },
        ],
      );
      return;
    }
    await setNotificationsEnabled(true);
  };

  const toggleBiometrics = async (enabled: boolean) => {
    if (!enabled) {
      await setBiometricEnabled(false);
      return;
    }
    if (!biometricSupport?.available || !biometricSupport.enrolled) {
      Alert.alert(
        'Biometrics are not available',
        'Set up a fingerprint, face, or device screen lock in your system settings first.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open settings', onPress: () => void openAppSettings() },
        ],
      );
      return;
    }
    setTogglingBiometric(true);
    try {
      const success = await authenticateWithBiometrics();
      if (!success) {
        Alert.alert('Not enabled', 'Biometric verification did not succeed.');
        return;
      }
      await setBiometricEnabled(true);
    } finally {
      setTogglingBiometric(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert('Sign out?', 'This device will need your password to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  const confirmLogoutAll = () => {
    Alert.alert(
      'Sign out everywhere?',
      'All refresh sessions on every device will be revoked. You will need to sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out everywhere',
          style: 'destructive',
          onPress: () =>
            logoutAll().catch((error) =>
              Alert.alert('Could not sign out everywhere', errorMessage(error)),
            ),
        },
      ],
    );
  };

  return (
    <Screen scroll edges={['top']}>
      <AppHeader title="Settings" subtitle="Your account, security, and storage" />
      <OfflineBanner />

      <Card style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
          <Avatar name={user.name} size={56} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="subheading" numberOfLines={1}>
              {user.name}
            </AppText>
            <AppText variant="small" color="textSecondary" numberOfLines={1}>
              {user.email}
            </AppText>
            <View style={{ marginTop: 6 }}>
              <Badge label="Private vault" tone="info" />
            </View>
          </View>
        </View>
        <Button
          label="Edit profile"
          variant="secondary"
          icon="person-outline"
          onPress={() => setProfileOpen(true)}
          style={{ marginTop: 15 }}
        />
      </Card>

      <SectionHeader title="Storage" />
      <Card style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <AppText variant="caption" color="textSecondary">
              Used
            </AppText>
            <AppText variant="heading">{formatBytes(summary?.usedBytes ?? 0)}</AppText>
          </View>
          <AppText variant="small" color="textSecondary">
            of {formatBytes(summary?.limitBytes ?? 0)}
          </AppText>
        </View>
        <View style={{ marginTop: 12 }}>
          <StorageBar percent={summary?.percentUsed ?? 0} />
        </View>
        <Button
          label="Storage details"
          variant="ghost"
          onPress={() => router.push('/storage')}
          style={{ marginTop: 8 }}
        />
      </Card>

      <SectionHeader title="Appearance" />
      <Card style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {themeOptions.map((option) => {
            const active = themeMode === option.key;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => void setThemeMode(option.key)}
                style={{
                  flex: 1,
                  minHeight: 62,
                  borderRadius: theme.radii.md,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                  backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                }}
              >
                <Ionicons
                  name={option.icon}
                  size={20}
                  color={active ? theme.colors.primary : theme.colors.textSecondary}
                />
                <AppText variant="caption" color={active ? 'primary' : 'textSecondary'}>
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <SectionHeader title="Security" />
      <Card style={{ paddingVertical: 3, marginBottom: 20 }}>
        <SettingRow
          icon="key-outline"
          title="Change password"
          subtitle="Signs out all other sessions"
          onPress={() => setPasswordOpen(true)}
        />
        <Divider />
        <SettingRow
          icon="finger-print-outline"
          title={biometricSupport?.label ?? 'Biometric lock'}
          subtitle={
            biometricSupport && (!biometricSupport.available || !biometricSupport.enrolled)
              ? 'Not set up on this device'
              : 'Require biometrics when QuickDrop returns from the background'
          }
          right={
            <Switch
              accessibilityLabel="Biometric app lock"
              value={biometricEnabled}
              onValueChange={(value) => void toggleBiometrics(value)}
              disabled={togglingBiometric || !biometricSupport?.available || !biometricSupport?.enrolled}
              trackColor={{ false: theme.colors.borderStrong, true: theme.colors.primary }}
              thumbColor={biometricEnabled ? theme.colors.onPrimary : theme.colors.surface}
            />
          }
        />
        <Divider />
        <SettingRow
          icon="notifications-outline"
          title="Upload notifications"
          subtitle={
            permissionChecked && !notificationsEnabled
              ? 'Tap to request notification permission'
              : 'Local notification when an upload finishes'
          }
          right={
            <Switch
              accessibilityLabel="Upload notifications"
              value={notificationsEnabled}
              onValueChange={(value) => void toggleNotifications(value)}
              trackColor={{ false: theme.colors.borderStrong, true: theme.colors.primary }}
              thumbColor={notificationsEnabled ? theme.colors.onPrimary : theme.colors.surface}
            />
          }
        />
      </Card>

      <SectionHeader title="Library" />
      <Card style={{ paddingVertical: 3, marginBottom: 20 }}>
        <SettingRow
          icon="cloud-offline-outline"
          title="Offline files"
          subtitle="Files downloaded to this device"
          onPress={() => router.push('/offline')}
        />
        <Divider />
        <SettingRow
          icon="time-outline"
          title="Activity history"
          subtitle="Uploads, downloads, and account events"
          onPress={() => router.push('/activity')}
        />
        <Divider />
        <SettingRow
          icon="trash-outline"
          title="Recycle bin"
          subtitle="Deleted files still count toward storage"
          onPress={() => router.push('/trash')}
        />
        <Divider />
        <SettingRow
          icon="cloud-upload-outline"
          title="Upload queue"
          subtitle="Foreground uploads and retries"
          onPress={() => router.push('/uploads')}
        />
      </Card>

      {__DEV__ ? (
        <>
          <SectionHeader title="Development" />
          <Card style={{ paddingVertical: 3, marginBottom: 20 }}>
            <SettingRow
              icon="server-outline"
              title="API server"
              subtitle={API_BASE_URL}
            />
          </Card>
        </>
      ) : null}

      <SectionHeader title="Account" />
      <Card style={{ paddingVertical: 3, marginBottom: 20 }}>
        <SettingRow
          icon="log-out-outline"
          title="Sign out"
          subtitle="Keep your files in the vault"
          onPress={confirmLogout}
        />
        <Divider />
        <SettingRow
          icon="shield-outline"
          title="Sign out everywhere"
          subtitle="Revoke every refresh session"
          onPress={confirmLogoutAll}
          danger
        />
      </Card>

      <View style={{ alignItems: 'center', paddingBottom: 18 }}>
        <AppText variant="caption" color="textTertiary">
          {APP_NAME} {APP_VERSION}
        </AppText>
        <AppText variant="caption" color="textTertiary" style={{ marginTop: 3 }}>
          Private cloud storage · Expo + Express
        </AppText>
      </View>

      <ProfileSheet visible={profileOpen} user={user} onClose={() => setProfileOpen(false)} />
      <PasswordSheet visible={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </Screen>
  );
}
