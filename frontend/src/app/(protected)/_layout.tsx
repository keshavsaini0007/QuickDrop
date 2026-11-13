import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { useAppTheme } from '@/theme';

export default function ProtectedLayout() {
  const theme = useAppTheme();
  const status = useAuthStore((state) => state.status);

  if (status === 'loading') return null;
  if (status !== 'authenticated') return <Redirect href="/(auth)/sign-in" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="folder/[id]" />
      <Stack.Screen name="preview/[id]" />
      <Stack.Screen name="activity" />
      <Stack.Screen name="trash" />
      <Stack.Screen name="storage" />
      <Stack.Screen name="uploads" />
      <Stack.Screen name="offline" />
    </Stack>
  );
}
