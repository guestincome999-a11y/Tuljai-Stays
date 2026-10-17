import { FlashList } from '@shopify/flash-list';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCatalogList } from '../../core/useCatalogList';
import type { CatalogListQuery } from '../../core/useCatalogList';
import { useColors } from '../../design/theme';
import { gutter, space } from '../../design/tokens';
import { useLang } from '../../i18n/language';
import {
  amenityOptions,
  exploreStrings,
  priceOptions,
  propertyTypeOptions,
  sortOptions,
} from '../../i18n/strings';
import { Button } from '../../ui/Button';
import { FilterChip } from '../../ui/FilterChip';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { LodgeCard } from '../lodges/LodgeCard';

import { SearchField } from './SearchField';

const SEARCH_DEBOUNCE_MS = 350;

type SortId = (typeof sortOptions)[number]['id'];

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

export function ExploreScreen({ onOpenLodge }: { onOpenLodge: (lodgeId: string) => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [text, setText] = useState('');
  const [sort, setSort] = useState<SortId>('distance');
  const [propertyType, setPropertyType] = useState<string | null>(null);
  const [priceId, setPriceId] = useState<string | null>(null);
  const [amenities, setAmenities] = useState<string[]>([]);
  const search = useDebounced(text.trim(), SEARCH_DEBOUNCE_MS);

  const query = useMemo<CatalogListQuery>(() => {
    const price = priceOptions.find((option) => option.id === priceId);
    return {
      amenities: amenities.length > 0 ? amenities : undefined,
      maxPrice: price && 'max' in price ? price.max : undefined,
      minPrice: price && 'min' in price ? price.min : undefined,
      propertyType: propertyType ?? undefined,
      search: search.length > 0 ? search : undefined,
      sort,
    };
  }, [amenities, priceId, propertyType, search, sort]);

  const list = useCatalogList(query);
  const hasFilters =
    text.length > 0 || propertyType !== null || priceId !== null || amenities.length > 0;

  function clearFilters() {
    setText('');
    setPropertyType(null);
    setPriceId(null);
    setAmenities([]);
  }

  function toggleAmenity(id: string) {
    setAmenities((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  const header = (
    <View style={styles.header}>
      <Text variant="title">{t(exploreStrings.title)}</Text>
      <SearchField
        placeholder={t(exploreStrings.searchPlaceholder)}
        value={text}
        onChangeText={setText}
      />
      <ChipRow>
        {sortOptions.map((option) => (
          <FilterChip
            key={option.id}
            label={t(option.label)}
            selected={sort === option.id}
            onPress={() => setSort(option.id)}
          />
        ))}
      </ChipRow>
      <ChipRow>
        {propertyTypeOptions.map((option) => (
          <FilterChip
            key={option.id}
            label={t(option.label)}
            selected={propertyType === option.id}
            onPress={() => setPropertyType(propertyType === option.id ? null : option.id)}
          />
        ))}
      </ChipRow>
      <ChipRow>
        {priceOptions.map((option) => (
          <FilterChip
            key={option.id}
            label={t(option.label)}
            selected={priceId === option.id}
            onPress={() => setPriceId(priceId === option.id ? null : option.id)}
          />
        ))}
        {amenityOptions.map((option) => (
          <FilterChip
            key={option.id}
            label={t(option.label)}
            selected={amenities.includes(option.id)}
            onPress={() => toggleAmenity(option.id)}
          />
        ))}
      </ChipRow>
      {!list.loading ? (
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
        renderItem={({ item }) => <LodgeCard card={item} onPress={onOpenLodge} />}
        showsVerticalScrollIndicator={false}
        onEndReached={() => void list.loadMore()}
        onEndReachedThreshold={0.6}
        onRefresh={() => void list.refresh()}
      />
    </View>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      contentContainerStyle={styles.chipRow}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipScroll}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chipRow: { gap: space.sm, paddingHorizontal: gutter },
  chipScroll: { marginHorizontal: -gutter },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.huge },
  footer: { paddingVertical: space.xl },
  header: { gap: space.lg, paddingBottom: space.lg, paddingTop: space.lg },
  list: { paddingHorizontal: gutter, paddingBottom: space.huge * 2 },
  screen: { flex: 1 },
  separator: { height: space.lg },
  separatorStack: { gap: space.lg },
});
