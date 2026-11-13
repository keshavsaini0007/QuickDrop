import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth';

export default function Index() {
  const status = useAuthStore((state) => state.status);
  if (status === 'loading') return null;
  return <Redirect href={status === 'authenticated' ? '/(tabs)' : '/(auth)/sign-in'} />;
}
