import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { queryClient, startOnlineManager } from '@/lib/queryClient';
import { configureNotifications } from '@/lib/notifications';
import { setSessionExpiredHandler } from '@/lib/session';
import { authenticateWithBiometrics } from '@/lib/biometrics';
import { useAuthStore } from '@/store/auth';
import { usePreferencesStore } from '@/store/preferences';
import { useUploadStore } from '@/lib/uploadQueue';
import { useAppTheme } from '@/theme';
import { AppText, Button } from '@/components/ui';

function AppLockGate({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  const authStatus = useAuthStore((state) => state.status);
  const enabled = usePreferencesStore((state) => state.biometricEnabled);
  const hydrated = usePreferencesStore((state) => state.hydrated);
  const signOut = useAuthStore((state) => state.logout);
  const [locked, setLocked] = useState(true);
  const [checking, setChecking] = useState(false);
  const appState = useRef(AppState.currentState);
  const shouldLock = Platform.OS !== 'web' && enabled && hydrated && authStatus === 'authenticated';

  const unlock = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const success = await authenticateWithBiometrics();
      if (success) setLocked(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!shouldLock) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackground =
        appState.current === 'background' || appState.current === 'inactive';
      appState.current = nextState;
      if (nextState === 'background' || (wasBackground && nextState === 'active')) {
        setLocked(true);
      }
    });
    return () => subscription.remove();
  }, [shouldLock]);

  return (
    <View style={styles.fill}>
      {children}
      {shouldLock && locked ? (
        <View
          accessibilityViewIsModal
          style={[styles.lockOverlay, { backgroundColor: theme.colors.background }]}
        >
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: 26,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.primarySoft,
              marginBottom: 20,
            }}
          >
            <Ionicons name="lock-closed" size={36} color={theme.colors.primary} />
          </View>
          <AppText variant="title" style={{ textAlign: 'center' }}>
            QuickDrop is locked
          </AppText>
          <AppText
            variant="body"
            color="textSecondary"
            style={{ textAlign: 'center', marginTop: 8, maxWidth: 300 }}
          >
            Unlock with your device biometrics to view your vault.
          </AppText>
          <Button
            label={checking ? 'Checking…' : 'Unlock QuickDrop'}
            icon="finger-print"
            onPress={() => void unlock()}
            loading={checking}
            fullWidth={false}
            style={{ marginTop: 28, minWidth: 220 }}
          />
          <Button
            label="Sign out instead"
            variant="ghost"
            onPress={() => void signOut()}
            fullWidth={false}
            style={{ marginTop: 8, minWidth: 220 }}
          />
        </View>
      ) : null}
    </View>
  );
}

function Bootstrap({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  const [ready, setReady] = useState(false);
  const authStatus = useAuthStore((state) => state.status);
  const bootstrapAuth = useAuthStore((state) => state.bootstrap);
  const hydratePreferences = usePreferencesStore((state) => state.hydrate);
  const hydrateUploads = useUploadStore((state) => state.hydrate);
  const processUploads = useUploadStore((state) => state.processQueue);
  const pauseUploads = useUploadStore((state) => state.pauseAll);

  useEffect(() => {
    let active = true;
    setSessionExpiredHandler(() => useAuthStore.getState().handleSessionExpired());
    startOnlineManager();
    void configureNotifications().catch(() => undefined);

    void Promise.all([hydratePreferences(), bootstrapAuth()])
      .catch(() => {
        if (useAuthStore.getState().status === 'loading') {
          useAuthStore.getState().handleSessionExpired();
        }
      })
      .finally(() => {
        if (!active) return;
        setReady(true);
        void SplashScreen.hideAsync();
      });

    return () => {
      active = false;
      setSessionExpiredHandler(null);
    };
  }, [bootstrapAuth, hydratePreferences]);

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      // Stop in-flight transfers as soon as the session ends. The queue rows
      // stay scoped to their original account and resume after that account
      // signs back in.
      void pauseUploads().catch(() => undefined);
      return;
    }
    void hydrateUploads()
      .then(() => processUploads())
      .catch(() => undefined);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void processUploads();
    });
    return () => subscription.remove();
  }, [authStatus, hydrateUploads, processUploads, pauseUploads]);

  if (!ready) {
    return <View style={[styles.fill, { backgroundColor: theme.colors.background }]} />;
  }

  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  const userId = useAuthStore((state) => state.user?.id);
  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={theme.isDark ? 'light' : 'dark'} />
          <Bootstrap>
            <AppLockGate key={userId ?? 'guest'}>{children}</AppLockGate>
          </Bootstrap>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
});
