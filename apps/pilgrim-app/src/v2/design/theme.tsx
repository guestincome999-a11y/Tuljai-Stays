import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

export interface RemoteThemeTokens {
  accent: string;
  background: string;
  ink: string;
  primary: string;
  surface: string;
}

export interface ThemeColors extends RemoteThemeTokens {
  accentSoft: string;
  danger: string;
  inkFaint: string;
  inkMuted: string;
  line: string;
  onPrimary: string;
  primaryPressed: string;
  primarySoft: string;
  scrim: string;
  star: string;
  success: string;
  surfaceMuted: string;
}

export const DEFAULT_THEME_TOKENS: RemoteThemeTokens = {
  accent: '#C95516',
  background: '#FFF8F0',
  ink: '#2B1B12',
  primary: '#8A1F11',
  surface: '#FFFFFF',
};

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const value = Number.parseInt(clean.length === 3 ? clean.replace(/./gu, '$&$&') : clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Blends `from` toward `to` by `amount` (0 keeps `from`, 1 becomes `to`). */
export function mix(from: string, to: string, amount: number): string {
  const [r1, g1, b1] = parseHex(from);
  const [r2, g2, b2] = parseHex(to);
  const channel = (a: number, b: number) =>
    Math.round(a + (b - a) * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r1, r2)}${channel(g1, g2)}${channel(b1, b2)}`;
}

export function buildColors(tokens: RemoteThemeTokens): ThemeColors {
  return {
    ...tokens,
    accentSoft: mix(tokens.accent, tokens.background, 0.86),
    danger: '#B3261E',
    inkFaint: mix(tokens.ink, tokens.background, 0.62),
    inkMuted: mix(tokens.ink, tokens.background, 0.32),
    line: mix(tokens.ink, tokens.background, 0.88),
    onPrimary: '#FFFFFF',
    primaryPressed: mix(tokens.primary, '#000000', 0.18),
    primarySoft: mix(tokens.primary, tokens.background, 0.9),
    scrim: 'rgba(30, 14, 8, 0.55)',
    star: '#E0A100',
    success: '#2E7D4F',
    surfaceMuted: mix(tokens.surface, tokens.background, 0.6),
  };
}

const ThemeContext = createContext<ThemeColors>(buildColors(DEFAULT_THEME_TOKENS));

export function ThemeProvider({
  children,
  tokens,
}: {
  children: ReactNode;
  tokens: RemoteThemeTokens;
}) {
  const colors = useMemo(() => buildColors(tokens), [tokens]);
  return <ThemeContext.Provider value={colors}>{children}</ThemeContext.Provider>;
}

export function useColors(): ThemeColors {
  return useContext(ThemeContext);
}
