import { StyleSheet, View } from 'react-native';

import { useColors } from '../../design/theme';
import { gutter, radius, space } from '../../design/tokens';
import { bilingualProp, useLang } from '../../i18n/language';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/Icon';
import { Text } from '../../ui/Text';

const ICONS: IconName[] = ['shield', 'zap', 'lock', 'check-circle'];

export function TrustSection({ props }: { props: Record<string, unknown> }) {
  const colors = useColors();
  const { t } = useLang();
  const raw = props['points'];
  const points = Array.isArray(raw)
    ? raw.filter(
        (point): point is Record<string, unknown> => typeof point === 'object' && point !== null,
      )
    : [];
  if (points.length === 0) return null;

  return (
    <View style={[styles.panel, { backgroundColor: colors.primarySoft }]}>
      {points.slice(0, 4).map((point, index) => (
        <View key={index} style={styles.item}>
          <View style={[styles.icon, { backgroundColor: colors.surface }]}>
            <Icon color="primary" name={ICONS[index % ICONS.length] ?? 'shield'} size={20} />
          </View>
          <Text align="center" variant="caption">
            {t(bilingualProp(point, 'title'))}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  item: { alignItems: 'center', flex: 1, gap: space.sm },
  panel: {
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: space.md,
    marginHorizontal: gutter,
    padding: space.lg,
  },
});
