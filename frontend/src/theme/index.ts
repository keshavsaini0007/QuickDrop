import { useColorScheme, useWindowDimensions } from 'react-native';
import { usePreferencesStore } from '@/store/preferences';
import {
  colors,
  layout,
  radii,
  shadows,
  spacing,
  typography,
  type ThemeColors,
} from './tokens';

export interface AppTheme {
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  shadows: typeof shadows;
  isDark: boolean;
  scheme: 'light' | 'dark';
  mode: 'system' | 'light' | 'dark';
}

export function useAppTheme(): AppTheme {
  const systemScheme = useColorScheme();
  const mode = usePreferencesStore((state) => state.themeMode);
  const scheme: 'light' | 'dark' =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  return {
    colors: colors[scheme],
    spacing,
    radii,
    typography,
    shadows,
    isDark: scheme === 'dark',
    scheme,
    mode,
  };
}

export function useContentWidth(): number {
  const { width } = useWindowDimensions();
  return Math.min(width, layout.maxContentWidth);
}

export { colors, layout, radii, shadows, spacing, typography };
export type { ThemeColors };
