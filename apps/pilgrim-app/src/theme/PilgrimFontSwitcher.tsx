import { Fragment, type ReactNode } from 'react';
import { Platform, Text, TextInput, type TextInputProps, type TextProps } from 'react-native';

import { usePilgrimApp } from '../pilgrim-ui/PilgrimAppProvider';

// Android ships Noto Sans Devanagari and iOS falls back to its Devanagari
// system font if the exact family name is unavailable. Applying it as the
// default keeps every NativeWind Text/TextInput in Marathi readable without
// requiring each screen to repeat a fontFamily class.
const marathiFontFamily = Platform.select({
  android: 'NotoSansDevanagari-Regular',
  default: 'Noto Sans Devanagari',
});

type TextWithDefaults = typeof Text & { defaultProps?: TextProps };
type TextInputWithDefaults = typeof TextInput & { defaultProps?: TextInputProps };

export function PilgrimFontSwitcher({ children }: { children: ReactNode }) {
  const { language } = usePilgrimApp();
  const fontFamily = language === 'mr' ? marathiFontFamily : undefined;

  // Text and TextInput are deliberately configured together: changing the
  // app language must also change text the pilgrim enters, not only labels.
  (Text as TextWithDefaults).defaultProps = {
    ...(Text as TextWithDefaults).defaultProps,
    style: fontFamily ? { fontFamily } : undefined,
  };
  (TextInput as TextInputWithDefaults).defaultProps = {
    ...(TextInput as TextInputWithDefaults).defaultProps,
    style: fontFamily ? { fontFamily } : undefined,
  };

  // Remount the route tree when the language changes so default props are
  // applied immediately to every existing label, not only newly opened views.
  return <Fragment key={language}>{children}</Fragment>;
}
