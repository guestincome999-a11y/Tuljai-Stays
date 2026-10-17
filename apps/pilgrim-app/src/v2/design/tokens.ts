import { Platform } from 'react-native';
import type { ViewStyle } from 'react-native';

/** 4px base grid. Every margin, padding and gap in the app comes from here. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

/** Horizontal screen margin used by every screen so edges always line up. */
export const gutter = space.xl;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export type TextRole = 'body' | 'bodyBold' | 'bodyMedium' | 'bodySemi' | 'display';

export interface TextStyleToken {
  letterSpacing: number;
  lineHeight: number;
  role: TextRole;
  size: number;
}

export const typeScale = {
  caption: { letterSpacing: 0.2, lineHeight: 16, role: 'body', size: 12 },
  body: { letterSpacing: 0, lineHeight: 24, role: 'body', size: 16 },
  label: { letterSpacing: 0.1, lineHeight: 20, role: 'bodySemi', size: 14 },
  heading: { letterSpacing: 0, lineHeight: 24, role: 'bodyBold', size: 18 },
  price: { letterSpacing: -0.2, lineHeight: 28, role: 'bodyBold', size: 22 },
  title: { letterSpacing: -0.3, lineHeight: 32, role: 'display', size: 26 },
  display: { letterSpacing: -0.6, lineHeight: 42, role: 'display', size: 36 },
} as const satisfies Record<string, TextStyleToken>;

export type TextVariant = keyof typeof typeScale;

const shadowColor = '#2B1B12';

export const elevation = {
  none: {} as ViewStyle,
  card: Platform.select<ViewStyle>({
    android: { elevation: 2 },
    default: {
      shadowColor,
      shadowOffset: { height: 4, width: 0 },
      shadowOpacity: 0.07,
      shadowRadius: 14,
    },
  }),
  raised: Platform.select<ViewStyle>({
    android: { elevation: 8 },
    default: {
      shadowColor,
      shadowOffset: { height: 10, width: 0 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
    },
  }),
} as const;

/** Minimum tappable size (Android and iOS accessibility guidance). */
export const hitTarget = 48;
