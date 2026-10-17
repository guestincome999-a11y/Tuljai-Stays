import { Text as NativeText } from 'react-native';
import type { TextProps as NativeTextProps, TextStyle } from 'react-native';

import { fontFamily } from '../design/fonts';
import { useColors } from '../design/theme';
import type { ThemeColors } from '../design/theme';
import { typeScale } from '../design/tokens';
import type { TextVariant } from '../design/tokens';
import { useLang } from '../i18n/language';

export interface TextProps extends NativeTextProps {
  align?: TextStyle['textAlign'];
  color?: keyof ThemeColors;
  variant?: TextVariant;
}

// Devanagari glyphs sit taller than Latin, so Marathi needs more line height to avoid clipping.
const MARATHI_LINE_HEIGHT_FACTOR = 1.18;

export function Text({ align, color = 'ink', style, variant = 'body', ...rest }: TextProps) {
  const colors = useColors();
  const { lang } = useLang();
  const token = typeScale[variant];
  const family =
    token.role === 'display' && lang === 'mr' ? fontFamily.displayMr : fontFamily[token.role];

  return (
    <NativeText
      {...rest}
      allowFontScaling
      maxFontSizeMultiplier={1.3}
      style={[
        {
          color: colors[color],
          fontFamily: family,
          fontSize: token.size,
          letterSpacing: lang === 'mr' ? 0 : token.letterSpacing,
          lineHeight: Math.round(
            token.lineHeight * (lang === 'mr' ? MARATHI_LINE_HEIGHT_FACTOR : 1),
          ),
          textAlign: align,
        },
        style,
      ]}
    />
  );
}
