import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '../../design/theme';
import { gutter, space } from '../../design/tokens';
import { bilingualProp, useLang } from '../../i18n/language';
import { Photo } from '../../ui/Photo';
import { Text } from '../../ui/Text';

import { LanguageToggle } from './LanguageToggle';

const HERO_HEIGHT = 320;

function secureUrl(value: unknown): string | null {
  return typeof value === 'string' && /^https:\/\//iu.test(value) ? value : null;
}

export function HeroSection({ props }: { props: Record<string, unknown> }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const imageUrl = secureUrl(props['imageUrl']);
  const title = t(bilingualProp(props, 'title'));
  const subtitle = t(bilingualProp(props, 'subtitle'));

  return (
    <View style={{ height: HERO_HEIGHT + insets.top }}>
      {imageUrl ? (
        <Photo scrim style={StyleSheet.absoluteFill} uri={imageUrl} />
      ) : (
        <LinearGradient
          colors={[colors.primary, colors.primaryPressed]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={[styles.content, { paddingTop: insets.top + space.md }]}>
        <View style={styles.topRow}>
          <LanguageToggle />
        </View>
        <View style={styles.copy}>
          <Text color="onPrimary" variant="display">
            {title}
          </Text>
          {subtitle.length > 0 ? (
            <Text color="onPrimary" style={styles.subtitle} variant="body">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: space.huge + space.lg,
    paddingHorizontal: gutter,
  },
  copy: { gap: space.sm },
  subtitle: { opacity: 0.9 },
  topRow: { alignItems: 'flex-end' },
});
