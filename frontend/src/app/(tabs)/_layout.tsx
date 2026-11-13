import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth';
import { useAppTheme } from '@/theme';

export default function TabsLayout() {
  const theme = useAppTheme();
  const status = useAuthStore((state) => state.status);

  if (status === 'loading') return null;
  if (status !== 'authenticated') return <Redirect href="/(auth)/sign-in" />;
  const tint = (color: unknown) =>
    typeof color === 'string' ? color : theme.colors.textTertiary;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          paddingTop: 5,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 2,
        },
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={tint(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="files"
        options={{
          title: 'Files',
          tabBarAccessibilityLabel: 'Files',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'folder-open' : 'folder-open-outline'}
              size={size}
              color={tint(color)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="shares"
        options={{
          title: 'Shares',
          tabBarAccessibilityLabel: 'Share links',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'link' : 'link-outline'}
              size={size}
              color={tint(color)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarAccessibilityLabel: 'More tools',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'}
              size={size}
              color={tint(color)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={size}
              color={tint(color)}
            />
          ),
        }}
      />
    </Tabs>
  );
}
