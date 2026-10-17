import { StyleSheet } from 'react-native';

import { useColors } from '../../design/theme';
import { elevation, gutter, radius, space } from '../../design/tokens';
import { useLang } from '../../i18n/language';
import { strings } from '../../i18n/strings';
import { Icon } from '../../ui/Icon';
import { PressableScale } from '../../ui/PressableScale';
import { Text } from '../../ui/Text';

/** Looks like a search field but simply opens the Explore tab, where the real search lives. */
export function SearchSection({
  onPress,
  overlapsHero,
}: {
  onPress: () => void;
  overlapsHero: boolean;
}) {
  const colors = useColors();
  const { t } = useLang();

  return (
    <PressableScale
      accessibilityLabel={t(strings.searchHint)}
      pressedScale={0.985}
      style={[
        styles.field,
        elevation.raised,
        {
          backgroundColor: colors.surface,
          marginTop: overlapsHero ? -(space.xxl + space.xxxl) : 0,
        },
      ]}
      onPress={onPress}
    >
      <Icon color="primary" name="search" size={20} />
      <Text color="inkMuted" numberOfLines={1} style={styles.hint}>
        {t(strings.searchHint)}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  field: {
    alignItems: 'center',
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: space.md,
    marginHorizontal: gutter,
    minHeight: 56,
    paddingHorizontal: space.lg,
  },
  hint: { flex: 1 },
});
