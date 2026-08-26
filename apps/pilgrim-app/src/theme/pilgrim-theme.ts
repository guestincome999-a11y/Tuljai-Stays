import { palette } from '@tuljai/ui';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

// Mirrors the shared @tuljai/ui saffron/maroon palette (packages/ui/src/theme/tokens.ts)
// so pilgrim-app's react-native-paper components match the rest of the brand
// instead of drifting with their own hardcoded shades.
export const pilgrimColors = {
  saffron: palette.saffron[600],
  saffronDeep: palette.saffron[700],
  saffronSoft: palette.saffron[50],
  vermilion: palette.maroon[700],
  gold: palette.bell[600],
  goldSoft: palette.bell[50],
  ink: palette.warm[900],
  muted: palette.warm[600],
  canvas: palette.warm[50],
  surface: palette.warm[0],
  line: palette.warm[200],
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
    onPrimaryContainer: palette.saffron[900],
    secondary: pilgrimColors.vermilion,
    onSecondary: '#FFFFFF',
    secondaryContainer: palette.maroon[100],
    onSecondaryContainer: palette.maroon[900],
    tertiary: palette.bell[800],
    onTertiary: '#FFFFFF',
    tertiaryContainer: pilgrimColors.goldSoft,
    onTertiaryContainer: palette.bell[900],
    background: pilgrimColors.canvas,
    onBackground: pilgrimColors.ink,
    surface: pilgrimColors.surface,
    onSurface: pilgrimColors.ink,
    surfaceVariant: palette.warm[100],
    onSurfaceVariant: pilgrimColors.muted,
    outline: palette.warm[400],
    outlineVariant: pilgrimColors.line,
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level1: palette.saffron[50],
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
    primary: palette.saffron[300],
    onPrimary: palette.saffron[900],
    primaryContainer: palette.saffron[800],
    onPrimaryContainer: palette.saffron[100],
    secondary: palette.maroon[300],
    onSecondary: palette.maroon[900],
    secondaryContainer: palette.maroon[800],
    onSecondaryContainer: palette.maroon[100],
    tertiary: palette.bell[300],
    onTertiary: palette.bell[900],
    tertiaryContainer: palette.bell[800],
    onTertiaryContainer: palette.bell[100],
    background: palette.warm[950],
    onBackground: palette.warm[100],
    surface: palette.warm[900],
    onSurface: palette.warm[100],
    surfaceVariant: palette.warm[700],
    onSurfaceVariant: palette.warm[300],
    outline: palette.warm[500],
    outlineVariant: palette.warm[700],
  },
};
