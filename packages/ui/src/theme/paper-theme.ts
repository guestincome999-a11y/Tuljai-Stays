import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

import { colors, palette, radius } from './tokens';

export const tuljaiLightTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: radius.md,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.light.primary,
    onPrimary: colors.light.onPrimary,
    primaryContainer: palette.saffron[100],
    onPrimaryContainer: palette.saffron[900],
    secondary: colors.light.secondary,
    onSecondary: colors.light.onSecondary,
    secondaryContainer: palette.maroon[50],
    onSecondaryContainer: palette.maroon[900],
    background: colors.light.background,
    surface: colors.light.surface,
    surfaceVariant: colors.light.surfaceSubtle,
    onSurface: colors.light.text,
    onSurfaceVariant: colors.light.textMuted,
    outline: colors.light.border,
    error: colors.light.error,
  },
};

export const tuljaiDarkTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: radius.md,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.adminDark.primary,
    onPrimary: colors.adminDark.onPrimary,
    secondary: colors.adminDark.secondary,
    onSecondary: colors.adminDark.onSecondary,
    background: colors.adminDark.background,
    surface: colors.adminDark.surface,
    surfaceVariant: colors.adminDark.surfaceSubtle,
    onSurface: colors.adminDark.text,
    onSurfaceVariant: colors.adminDark.textMuted,
    outline: colors.adminDark.border,
    error: colors.adminDark.error,
  },
};
