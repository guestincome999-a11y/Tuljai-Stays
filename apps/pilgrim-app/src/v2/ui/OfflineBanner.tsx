import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConnectivity } from '../core/connectivity';
import { useColors } from '../design/theme';
import { space } from '../design/tokens';
import { extraStrings } from '../i18n/extraStrings';
import { useLang } from '../i18n/language';

import { Text } from './Text';

export function OfflineBanner() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { offline } = useConnectivity();
  if (!offline) return null;

  return (
    <Text
      align="center"
      color="onPrimary"
      style={[styles.banner, { backgroundColor: colors.ink, paddingTop: insets.top + space.xs }]}
      variant="label"
    >
      {t(extraStrings.offline)}
    </Text>
  );
}

const styles = StyleSheet.create({
  banner: { left: 0, paddingBottom: space.xs, position: 'absolute', right: 0, top: 0, zIndex: 50 },
});
