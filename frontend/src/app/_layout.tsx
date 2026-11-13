import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AppProviders } from '@/providers/app-providers';
import { useAppTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const theme = useAppTheme();
  return (
    <AppProviders>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(protected)" />
        <Stack.Screen name="s/[token]" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </AppProviders>
  );
}
