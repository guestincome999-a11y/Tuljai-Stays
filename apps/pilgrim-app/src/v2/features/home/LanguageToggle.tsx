import { StyleSheet, View } from 'react-native';

import { radius, space } from '../../design/tokens';
import { useLang } from '../../i18n/language';
import type { Lang } from '../../i18n/language';
import { PressableScale } from '../../ui/PressableScale';
import { Text } from '../../ui/Text';

const OPTIONS: Array<{ label: string; lang: Lang }> = [
  { label: 'EN', lang: 'en' },
  { label: 'मराठी', lang: 'mr' },
];

/** Compact two-way switch sitting on the hero photo. */
export function LanguageToggle() {
  const { lang, setLang } = useLang();

  return (
    <View style={styles.track}>
      {OPTIONS.map((option) => {
        const selected = option.lang === lang;
        return (
          <PressableScale
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            key={option.lang}
            pressedScale={0.94}
            style={[styles.option, selected ? styles.optionSelected : null]}
            onPress={() => setLang(option.lang)}
          >
            <Text color={selected ? 'primary' : 'onPrimary'} variant="label">
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  option: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  optionSelected: { backgroundColor: '#FFFFFF' },
  track: {
    backgroundColor: 'rgba(30,14,8,0.42)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    padding: 3,
  },
});
