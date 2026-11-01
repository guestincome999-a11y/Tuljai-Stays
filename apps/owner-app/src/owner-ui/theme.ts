import { tuljaiLightTheme } from '@tuljai/ui';
import { Platform } from 'react-native';
import type { MD3Theme } from 'react-native-paper';

// Owner-only tokens. Shared tokens remain unchanged for pilgrim and admin apps.
export const ownerColors = {
  primary: '#861632',
  deep: '#5C1024',
  secondary: '#A32949',
  cream: '#FFF9F3',
  surface: '#FFFFFF',
  text: '#20232B',
  muted: '#666C78',
  border: '#EAE1DC',
  blush: '#F8ECF0',
  success: '#256B46',
  successSoft: '#EDF7F0',
  warning: '#8A560D',
  warningSoft: '#FFF4DE',
  error: '#AC3040',
  errorSoft: '#FCEEF0',
} as const;

export const spacing = { xs: 6, sm: 10, md: 16, lg: 20, xl: 28, xxl: 40 } as const;
export const radius = { sm: 16, md: 12, lg: 18, xl: 24, full: 9999 } as const;

const fontFamily = Platform.OS === 'ios' ? 'System' : 'sans-serif';
export const ownerTheme: MD3Theme = {
  ...tuljaiLightTheme,
  roundness: 3,
  fonts: Object.fromEntries(
    Object.entries(tuljaiLightTheme.fonts).map(([key, value]) => [
      key,
      {
        ...value,
        fontFamily,
        ...(key.startsWith('title') ? { fontWeight: '600' } : {}),
        ...(key === 'headlineSmall' ? { fontSize: 23, lineHeight: 30, fontWeight: '700' } : {}),
      },
    ]),
  ) as MD3Theme['fonts'],
  colors: {
    ...tuljaiLightTheme.colors,
    primary: ownerColors.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: ownerColors.blush,
    onPrimaryContainer: ownerColors.deep,
    secondary: ownerColors.secondary,
    onSecondary: '#FFFFFF',
    secondaryContainer: ownerColors.blush,
    onSecondaryContainer: ownerColors.deep,
    tertiary: ownerColors.success,
    onTertiary: '#FFFFFF',
    background: ownerColors.cream,
    surface: ownerColors.surface,
    surfaceVariant: '#F5F0ED',
    onSurface: ownerColors.text,
    onSurfaceVariant: ownerColors.muted,
    outline: ownerColors.border,
    outlineVariant: ownerColors.border,
    error: ownerColors.error,
    onError: '#FFFFFF',
    errorContainer: ownerColors.errorSoft,
    onErrorContainer: '#761B2A',
    inverseSurface: ownerColors.deep,
    inverseOnSurface: '#FFFFFF',
    elevation: {
      level0: 'transparent',
      level1: '#FFFFFF',
      level2: '#FFF9F3',
      level3: '#FFF4F0',
      level4: '#F8ECF0',
      level5: '#F5E6EB',
    },
  },
};
