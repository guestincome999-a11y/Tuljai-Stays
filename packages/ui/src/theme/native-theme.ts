import { colors, palette, radius, shadows, spacing, typography } from './tokens';

export const nativeTheme = {
  colors: colors.light,
  palette,
  radius,
  shadows,
  spacing,
  typography,
  components: {
    button: { minHeight: 52, radius: radius.md },
    card: { radius: radius.lg, padding: spacing.md },
    input: { minHeight: 56, radius: radius.md },
    bottomNav: { minHeight: 72 },
  },
} as const;

export type NativeTheme = typeof nativeTheme;
