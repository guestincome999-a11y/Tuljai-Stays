import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Mukta_400Regular } from '@expo-google-fonts/mukta/400Regular';
import { Mukta_500Medium } from '@expo-google-fonts/mukta/500Medium';
import { Mukta_600SemiBold } from '@expo-google-fonts/mukta/600SemiBold';
import { Mukta_700Bold } from '@expo-google-fonts/mukta/700Bold';
import { TiroDevanagariMarathi_400Regular } from '@expo-google-fonts/tiro-devanagari-marathi/400Regular';
import { useFonts } from 'expo-font';

import type { TextRole } from './tokens';

/**
 * English headings use Fraunces (an editorial serif); Marathi headings use Tiro Devanagari
 * Marathi, which is drawn for the script. Mukta carries body text because it covers both scripts.
 */
export const fontFamily: Record<TextRole | 'displayMr', string> = {
  body: 'Mukta_400Regular',
  bodyBold: 'Mukta_700Bold',
  bodyMedium: 'Mukta_500Medium',
  bodySemi: 'Mukta_600SemiBold',
  display: 'Fraunces_600SemiBold',
  displayMr: 'TiroDevanagariMarathi_400Regular',
};

/** Resolves true once fonts are ready (or have failed, so the app never hangs on a splash). */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Fraunces_600SemiBold,
    Mukta_400Regular,
    Mukta_500Medium,
    Mukta_600SemiBold,
    Mukta_700Bold,
    TiroDevanagariMarathi_400Regular,
  });
  return loaded || error !== null;
}
