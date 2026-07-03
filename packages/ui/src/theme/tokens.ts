export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

export const lightPalette = {
  primary: '#7A3E12',
  onPrimary: '#FFFFFF',
  secondary: '#1F6F5B',
  onSecondary: '#FFFFFF',
  tertiary: '#6E4FA3',
  background: '#FFFBFE',
  surface: '#FFFFFF',
  surfaceVariant: '#EFE3DA',
  outline: '#81756D',
  error: '#BA1A1A',
  onError: '#FFFFFF',
  onSurface: '#201A17',
  onSurfaceVariant: '#51443C',
} as const;

export const darkPalette = {
  primary: '#FFB787',
  onPrimary: '#482000',
  secondary: '#8ED8C0',
  onSecondary: '#00382C',
  tertiary: '#D8BBFF',
  background: '#201A17',
  surface: '#181210',
  surfaceVariant: '#51443C',
  outline: '#A08D82',
  error: '#FFB4AB',
  onError: '#690005',
  onSurface: '#EDE0DA',
  onSurfaceVariant: '#D5C3B8',
} as const;
