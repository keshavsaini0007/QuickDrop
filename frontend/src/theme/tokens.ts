import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';

const lightColors = {
  background: '#F4F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#EDF2F7',
  surfaceElevated: '#FFFFFF',
  text: '#101828',
  textSecondary: '#5D6B82',
  textTertiary: '#8492A6',
  border: '#E0E7F0',
  borderStrong: '#C8D3E1',
  primary: '#0F766E',
  primaryPressed: '#115E59',
  primarySoft: '#CCFBF1',
  onPrimary: '#FFFFFF',
  accent: '#D97706',
  accentSoft: '#FEF3C7',
  success: '#047857',
  successSoft: '#D1FAE5',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  overlay: 'rgba(16, 24, 40, 0.48)',
  tabBar: '#FFFFFF',
  input: '#FFFFFF',
  skeleton: '#E8EEF5',
  shadow: '#0B1B33',
} as const;

const darkColors = {
  background: '#08111F',
  surface: '#101B2C',
  surfaceMuted: '#172438',
  surfaceElevated: '#142136',
  text: '#F4F8FF',
  textSecondary: '#A9B6CB',
  textTertiary: '#7D8CA3',
  border: '#26364E',
  borderStrong: '#354A66',
  primary: '#2DD4BF',
  primaryPressed: '#5EEAD4',
  primarySoft: '#103B3A',
  onPrimary: '#042F2E',
  accent: '#FBBF24',
  accentSoft: '#3D2E0A',
  success: '#34D399',
  successSoft: '#0D332A',
  warning: '#FBBF24',
  warningSoft: '#3D2E0A',
  danger: '#F87171',
  dangerSoft: '#3A171A',
  overlay: 'rgba(2, 6, 23, 0.72)',
  tabBar: '#0C1727',
  input: '#0D192A',
  skeleton: '#1C2A40',
  shadow: '#000000',
} as const;

export const colors = { light: lightColors, dark: darkColors };
export type ThemeColors = { [K in keyof typeof lightColors]: string };

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,
} as const;

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -1.1,
  } satisfies TextStyle,
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.7,
  } satisfies TextStyle,
  heading: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.35,
  } satisfies TextStyle,
  subheading: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
    letterSpacing: -0.2,
  } satisfies TextStyle,
  body: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '400',
  } satisfies TextStyle,
  bodyStrong: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
  } satisfies TextStyle,
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  } satisfies TextStyle,
  smallStrong: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  } satisfies TextStyle,
  caption: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  } satisfies TextStyle,
  button: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  } satisfies TextStyle,
} as const;

export const shadows = {
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0B1B33',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 2 },
    default: {},
  }),
  floating: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0B1B33',
      shadowOpacity: 0.2,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 8 },
    default: {},
  }),
} as const;

export const layout = {
  maxContentWidth: 760,
  minTouchTarget: 48,
  tabBarHeight: 62,
  headerHeight: 56,
} as const;
