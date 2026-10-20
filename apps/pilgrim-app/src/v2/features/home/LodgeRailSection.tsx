import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { fetchCatalog } from '../../core/catalog';
import { usePreferences } from '../../core/preferences';
import { useCachedFetch } from '../../core/useCachedFetch';
import { gutter, space } from '../../design/tokens';
import { bilingualProp, useLang } from '../../i18n/language';
import { strings } from '../../i18n/strings';
import { PressableScale } from '../../ui/PressableScale';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { LodgeCard } from '../lodges/LodgeCard';

const MAX_RAIL_ITEMS = 12;

export function LodgeRailSection({
  onOpenLodge,
  onSeeAll,
  props,
}: {
  onOpenLodge: (lodgeId: string) => void;
  onSeeAll: () => void;
  props: Record<string, unknown>;
}) {
  const { t } = useLang();
  const { isSaved, toggleSaved } = usePreferences();
  const { width } = useWindowDimensions();
  const limit = Math.min(typeof props['limit'] === 'number' ? props['limit'] : 8, MAX_RAIL_ITEMS);
  const { data, error, loading } = useCachedFetch(`catalog:home:${limit}`, () =>
    fetchCatalog({ pageSize: limit, sort: 'distance' }),
  );
  const cardWidth = Math.min(width * 0.78, 320);
  const title = t(bilingualProp(props, 'title'));
  const subtitle = t(bilingualProp(props, 'subtitle'));

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text variant="title">{title}</Text>
          {subtitle.length > 0 ? (
            <Text color="inkMuted" variant="label">
              {subtitle}
            </Text>
          ) : null}
        </View>
        <PressableScale accessibilityLabel={t(strings.allLodges)} onPress={onSeeAll}>
          <Text color="primary" variant="label">
            {t(strings.allLodges)}
          </Text>
        </PressableScale>
      </View>

      {loading && !data ? (
        <View style={styles.skeletonRow}>
          <Skeleton height={300} width={cardWidth} />
          <Skeleton height={300} width={cardWidth} />
        </View>
      ) : null}

      {error && !data ? (
        <Text color="inkMuted" style={styles.message}>
          {t(strings.loadError)}
        </Text>
      ) : null}

      {data && data.items.length === 0 ? (
        <Text color="inkMuted" style={styles.message}>
          {t(strings.noLodges)}
        </Text>
      ) : null}

      {data && data.items.length > 0 ? (
        <FlatList
          contentContainerStyle={styles.list}
          data={data.items}
          decelerationRate="fast"
          horizontal
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          keyExtractor={(card) => card.id}
          renderItem={({ item }) => (
            <LodgeCard
              card={item}
              saved={isSaved(item.id)}
              width={cardWidth}
              onPress={onOpenLodge}
              onToggleSaved={toggleSaved}
            />
          )}
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + space.lg}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { width: space.lg },
  header: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
  },
  headerCopy: { flex: 1, gap: space.xs, paddingRight: space.lg },
  list: { paddingHorizontal: gutter, paddingVertical: space.sm },
  message: { paddingHorizontal: gutter },
  section: { gap: space.lg },
  skeletonRow: { flexDirection: 'row', gap: space.lg, paddingHorizontal: gutter },
});
