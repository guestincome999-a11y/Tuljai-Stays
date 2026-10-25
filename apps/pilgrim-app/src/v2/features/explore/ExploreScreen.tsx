import { FlashList } from '@shopify/flash-list';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useExploreFilters } from '../../core/exploreFilters';
import { usePreferences } from '../../core/preferences';
import { useCatalogList } from '../../core/useCatalogList';
import type { CatalogListQuery } from '../../core/useCatalogList';
import { useColors } from '../../design/theme';
import { gutter, space } from '../../design/tokens';
import { useLang } from '../../i18n/language';
import { detailStrings, exploreStrings, strings } from '../../i18n/strings';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { PressableScale } from '../../ui/PressableScale';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { LodgeCard } from '../lodges/LodgeCard';

import { FilterSheet } from './FilterSheet';
import type { FilterValues } from './FilterSheet';
import { SearchField } from './SearchField';

const SEARCH_DEBOUNCE_MS = 350;

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

export function ExploreScreen({
  initialSavedOnly = false,
  onOpenLodge,
}: {
  initialSavedOnly?: boolean;
  onOpenLodge: (lodgeId: string) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { favoriteIds, isSaved, toggleSaved } = usePreferences();
  const [savedOnly, setSavedOnly] = useState(initialSavedOnly);
  const [text, setText] = useState('');
  const options = useExploreFilters();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sort, setSort] = useState<string>('distance');
  const [propertyType, setPropertyType] = useState<string | null>(null);
  const [priceId, setPriceId] = useState<string | null>(null);
  const [amenities, setAmenities] = useState<string[]>([]);
  const search = useDebounced(text.trim(), SEARCH_DEBOUNCE_MS);

  const query = useMemo<CatalogListQuery>(() => {
    const price = options.prices.find((option) => option.id === priceId);
    return {
      amenities: amenities.length > 0 ? amenities : undefined,
      ids: savedOnly ? (favoriteIds.length > 0 ? favoriteIds : ['none']) : undefined,
      maxPrice: price && 'max' in price ? price.max : undefined,
      minPrice: price && 'min' in price ? price.min : undefined,
      propertyType: propertyType ?? undefined,
      search: search.length > 0 ? search : undefined,
      sort: sort as CatalogListQuery['sort'],
    };
  }, [amenities, favoriteIds, options.prices, priceId, propertyType, savedOnly, search, sort]);

  const list = useCatalogList(query);
  const hasFilters =
    savedOnly ||
    text.length > 0 ||
    propertyType !== null ||
    priceId !== null ||
    amenities.length > 0;

  const activeCount =
    (savedOnly ? 1 : 0) +
    (propertyType !== null ? 1 : 0) +
    (priceId !== null ? 1 : 0) +
    (sort !== 'distance' ? 1 : 0) +
    amenities.length;

  function clearFilters() {
    setText('');
    resetSheetFilters();
  }

  function resetSheetFilters() {
    setSavedOnly(false);
    setSort('distance');
    setPropertyType(null);
    setPriceId(null);
    setAmenities([]);
  }

  function applyFilters(next: FilterValues) {
    setSavedOnly(next.savedOnly);
    setSort(next.sort);
    setPropertyType(next.propertyType);
    setPriceId(next.priceId);
    setAmenities(next.amenities);
  }

  const header = (
    <View style={styles.header}>
      <Text variant="title">{t(exploreStrings.title)}</Text>
      <View style={styles.searchRow}>
        <View style={styles.searchGrow}>
          <SearchField
            placeholder={t(exploreStrings.searchPlaceholder)}
            value={text}
            onChangeText={setText}
          />
        </View>
        <PressableScale
          accessibilityLabel={t({ en: 'Filters', mr: 'फिल्टर' })}
          pressedScale={0.94}
          style={[
            styles.filterButton,
            {
              backgroundColor: activeCount > 0 ? colors.primary : colors.surface,
              borderColor: activeCount > 0 ? colors.primary : colors.line,
            },
          ]}
          onPress={() => setSheetOpen(true)}
        >
          <Icon color={activeCount > 0 ? 'onPrimary' : 'primary'} name="sliders" size={20} />
          {activeCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text color="onPrimary" variant="caption">
                {activeCount}
              </Text>
            </View>
          ) : null}
        </PressableScale>
      </View>
      {!list.loading && !list.error ? (
        <Text color="inkMuted" variant="label">
          {list.totalItems} {t(exploreStrings.resultCount)}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <FlashList
        contentContainerStyle={styles.list}
        data={list.items}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyExtractor={(card) => card.id}
        ListEmptyComponent={
          list.loading ? (
            <View style={styles.separatorStack}>
              <Skeleton height={300} />
              <Skeleton height={300} />
            </View>
          ) : list.error ? (
            <View style={styles.empty}>
              <Text align="center" color="inkMuted">
                {t(strings.loadError)}
              </Text>
              <Button
                label={t(detailStrings.tryAgain)}
                variant="secondary"
                onPress={() => void list.refresh()}
              />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text align="center" variant="heading">
                {t(exploreStrings.emptyTitle)}
              </Text>
              <Text align="center" color="inkMuted">
                {t(exploreStrings.emptyBody)}
              </Text>
              {hasFilters ? (
                <Button
                  label={t(exploreStrings.clearFilters)}
                  variant="secondary"
                  onPress={clearFilters}
                />
              ) : null}
            </View>
          )
        }
        ListFooterComponent={
          list.loadingMore ? (
            <ActivityIndicator color={colors.primary} style={styles.footer} />
          ) : null
        }
        ListHeaderComponent={header}
        refreshing={false}
        renderItem={({ item }) => (
          <LodgeCard
            card={item}
            saved={isSaved(item.id)}
            onPress={onOpenLodge}
            onToggleSaved={toggleSaved}
          />
        )}
        showsVerticalScrollIndicator={false}
        onEndReached={() => void list.loadMore()}
        onEndReachedThreshold={0.6}
        onRefresh={() => void list.refresh()}
      />
      <FilterSheet
        options={options}
        value={{ amenities, priceId, propertyType, savedOnly, sort }}
        visible={sheetOpen}
        onApply={applyFilters}
        onClose={() => setSheetOpen(false)}
        onReset={resetSheetFilters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: 999,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -4,
    top: -4,
  },
  filterButton: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.huge },
  footer: { paddingVertical: space.xl },
  header: { gap: space.lg, paddingBottom: space.lg, paddingTop: space.lg },
  list: { paddingHorizontal: gutter, paddingBottom: space.huge * 2 },
  screen: { flex: 1 },
  searchGrow: { flex: 1 },
  searchRow: { alignItems: 'center', flexDirection: 'row', gap: space.sm },
  separator: { height: space.lg },
  separatorStack: { gap: space.lg },
});
