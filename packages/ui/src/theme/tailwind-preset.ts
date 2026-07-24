import { palette, radius, spacing, typography } from './tokens';

/** Values that can be spread into a Tailwind or NativeWind theme.extend object. */
export const tuljaiTailwindTheme = {
  colors: {
    saffron: palette.saffron,
    maroon: palette.maroon,
    warm: palette.warm,
    templeGreen: palette.green,
    danger: palette.red,
    bell: palette.bell,
  },
  spacing,
  borderRadius: radius,
  fontFamily: {
    body: [typography.body],
    heading: [typography.heading],
    devanagari: [typography.devanagari],
  },
} as const;
