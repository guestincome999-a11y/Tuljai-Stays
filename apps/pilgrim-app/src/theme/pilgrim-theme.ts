import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

export const pilgrimColors = {
  saffron: '#C95516',
  saffronDeep: '#9E3514',
  saffronSoft: '#FFF0E2',
  vermilion: '#8C1D18',
  gold: '#C49328',
  goldSoft: '#FFF4D2',
  ink: '#2A1813',
  muted: '#6E5B53',
  canvas: '#FFF9F3',
  surface: '#FFFFFF',
  line: '#E7D8CC',
} as const;

export const pilgrimSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const pilgrimRadius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  full: 999,
} as const;

export const pilgrimLightTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 4,
  colors: {
    ...MD3LightTheme.colors,
    primary: pilgrimColors.saffronDeep,
    onPrimary: '#FFFFFF',
    primaryContainer: pilgrimColors.saffronSoft,
    onPrimaryContainer: '#5A210D',
    secondary: pilgrimColors.vermilion,
    onSecondary: '#FFFFFF',
    secondaryContainer: '#FFE2DE',
    onSecondaryContainer: '#5C100E',
    tertiary: '#795900',
    onTertiary: '#FFFFFF',
    tertiaryContainer: pilgrimColors.goldSoft,
    onTertiaryContainer: '#4B3600',
    background: pilgrimColors.canvas,
    onBackground: pilgrimColors.ink,
    surface: pilgrimColors.surface,
    onSurface: pilgrimColors.ink,
    surfaceVariant: '#F6EAE1',
    onSurfaceVariant: pilgrimColors.muted,
    outline: '#9B857A',
    outlineVariant: pilgrimColors.line,
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level1: '#FFF7F0',
      level2: '#FFF1E6',
      level3: '#FDEADF',
    },
  },
};

export const pilgrimDarkTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: 4,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#FFB583',
    onPrimary: '#572000',
    primaryContainer: '#783000',
    onPrimaryContainer: '#FFDBC6',
    secondary: '#FFB4AC',
    onSecondary: '#561E1A',
    secondaryContainer: '#73332E',
    onSecondaryContainer: '#FFDAD6',
    tertiary: '#E8C35C',
    onTertiary: '#3D2E00',
    tertiaryContainer: '#574500',
    onTertiaryContainer: '#FFE16D',
    background: '#1D1511',
    onBackground: '#F3E1D8',
    surface: '#241A16',
    onSurface: '#F3E1D8',
    surfaceVariant: '#51443D',
    onSurfaceVariant: '#D8C2B8',
    outline: '#A08D84',
    outlineVariant: '#51443D',
  },
};
