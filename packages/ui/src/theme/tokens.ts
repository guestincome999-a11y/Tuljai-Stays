/** Shared Tuljai Stays primitives for web and native products. */
export const palette = {
  saffron: {
    50: '#FFF7ED',
    100: '#FFEDD5',
    200: '#FED7AA',
    300: '#FDBA74',
    400: '#FB923C',
    500: '#E67E22',
    600: '#C96818',
    700: '#A64F12',
    800: '#853F16',
    900: '#6C3517',
  },
  maroon: {
    50: '#FFF1F2',
    100: '#FFE4E6',
    200: '#FECDD3',
    300: '#FDA4AF',
    400: '#FB7185',
    500: '#A83A48',
    600: '#8E2938',
    700: '#7A1F2B',
    800: '#651B25',
    900: '#541922',
  },
  warm: {
    0: '#FFFFFF',
    50: '#FAF7F2',
    100: '#F4EEE6',
    200: '#E8DED2',
    300: '#D7C8B8',
    400: '#AD9C8C',
    500: '#817267',
    600: '#62554E',
    700: '#493D38',
    800: '#352B27',
    900: '#2B2320',
    950: '#1D1816',
  },
  green: {
    50: '#EFF7F1',
    100: '#DDEEE1',
    200: '#BCDEC5',
    300: '#8FC39C',
    400: '#68A87A',
    500: '#4A7C59',
    600: '#3E684B',
    700: '#35543F',
    800: '#2D4435',
    900: '#27382D',
  },
  red: {
    50: '#FDF2F0',
    100: '#FBE3DF',
    200: '#F7C9C1',
    300: '#F0A397',
    400: '#E47060',
    500: '#C0392B',
    600: '#A52F23',
    700: '#89291F',
    800: '#71271F',
    900: '#5E251F',
  },
  bell: {
    50: '#FFFAEB',
    100: '#FFF0C2',
    200: '#FFE188',
    300: '#F8C94D',
    400: '#E9AF26',
    500: '#C98B17',
    600: '#A96A12',
    700: '#884E13',
    800: '#713F17',
    900: '#603519',
  },
} as const;

export const colors = {
  light: {
    background: palette.warm[50],
    surface: palette.warm[0],
    surfaceSubtle: palette.warm[100],
    text: palette.warm[900],
    textMuted: palette.warm[600],
    border: palette.warm[200],
    primary: palette.saffron[500],
    onPrimary: palette.warm[950],
    secondary: palette.maroon[700],
    onSecondary: palette.warm[0],
    success: palette.green[500],
    warning: palette.bell[500],
    error: palette.red[500],
  },
  adminDark: {
    background: palette.warm[950],
    surface: palette.warm[900],
    surfaceSubtle: palette.warm[800],
    text: palette.warm[50],
    textMuted: palette.warm[300],
    border: palette.warm[700],
    primary: palette.saffron[400],
    onPrimary: palette.warm[950],
    secondary: palette.maroon[300],
    onSecondary: palette.warm[950],
    success: palette.green[300],
    warning: palette.bell[300],
    error: palette.red[300],
  },
} as const;

export const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 } as const;
export const typography = {
  heading: 'Poppins',
  body: 'Inter',
  devanagari: 'NotoSansDevanagari',
  sizes: { xs: 12, sm: 14, base: 16, lg: 18, xl: 22, '2xl': 28, '3xl': 36 },
} as const;
export const shadows = {
  card: {
    shadowColor: palette.warm[900],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  /** Subtle colored glow for primary CTAs. Use sparingly - one glowing
   * element per view (a hero button or the single most important action). */
  primaryGlow: {
    shadowColor: palette.saffron[600],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 6,
  },
} as const;

/**
 * Gradient tokens for the Phase 8 design system.
 *
 * Each gradient ships two equivalent representations from the same source
 * stops so web and native stay visually identical:
 *  - `colors`: ordered stop array for React Native `LinearGradient` (pair
 *    with `start`/`end` props, typically `{x:0,y:0}` -> `{x:1,y:1}` for the
 *    135deg-style diagonal look used here).
 *  - `css`: ready-to-use `linear-gradient(...)` string for admin-panel CSS.
 *
 * Usage guidance (see Phase 8 design system): reserve gradients for primary
 * actions, hero areas, selected states, and small accent moments. Do not
 * apply gradients to ordinary cards, tables, or body surfaces.
 */
export const gradients = {
  /** Primary buttons, primary CTAs, active tab indicator. */
  primary: {
    colors: [palette.saffron[400], palette.saffron[500], palette.saffron[600]],
    css: `linear-gradient(135deg, ${palette.saffron[400]} 0%, ${palette.saffron[500]} 55%, ${palette.saffron[600]} 100%)`,
  },
  /** Hover/pressed state for primary buttons - one step lighter. */
  primaryHover: {
    colors: [palette.saffron[300], palette.saffron[400], palette.saffron[500]],
    css: `linear-gradient(135deg, ${palette.saffron[300]} 0%, ${palette.saffron[400]} 55%, ${palette.saffron[500]} 100%)`,
  },
  /** Full-bleed hero banners / auth screens - deeper, richer saffron-to-maroon. */
  hero: {
    colors: [palette.saffron[600], palette.saffron[700], palette.maroon[700]],
    css: `linear-gradient(135deg, ${palette.saffron[600]} 0%, ${palette.saffron[700]} 55%, ${palette.maroon[700]} 100%)`,
  },
  /** Low-opacity wash for glass-effect panels over a dark hero/sidebar. */
  heroGlass: {
    colors: ['rgba(230,126,34,0.18)', 'rgba(168,58,72,0.12)'],
    css: 'linear-gradient(160deg, rgba(230,126,34,0.18) 0%, rgba(168,58,72,0.12) 100%)',
  },
  /** Small accent moments: badges, avatar rings, icon chips, brand mark. */
  accent: {
    colors: [palette.saffron[500], palette.maroon[600]],
    css: `linear-gradient(135deg, ${palette.saffron[500]} 0%, ${palette.maroon[600]} 100%)`,
  },
  /** Selected/active list rows, chips, and nav items. Soft, not a full CTA. */
  selected: {
    colors: ['rgba(230,126,34,0.16)', 'rgba(230,126,34,0.06)'],
    css: 'linear-gradient(135deg, rgba(230,126,34,0.16) 0%, rgba(230,126,34,0.06) 100%)',
  },
} as const;
