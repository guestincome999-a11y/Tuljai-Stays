import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppScreen, LodgeCard, PrimaryButton, SearchBox, ui } from '../components';
import { formatRupees } from '../mock-data';
import { usePilgrimApp } from '../PilgrimAppProvider';
import { PriceRangeSlider } from '../PriceRangeSlider';

const filterChips = [
  { key: 'all', label: 'All stays', labelMr: 'सर्व निवास' },
  { key: 'saved', label: 'Saved', labelMr: 'जतन केलेले' },
  { key: 'near-temple', label: 'Near temple', labelMr: 'मंदिराजवळ' },
  { key: 'budget', label: 'Under ₹1,200', labelMr: '₹१,२०० पेक्षा कमी' },
  { key: 'family', label: 'Family rooms', labelMr: 'कुटुंब खोली' },
  { key: 'parking', label: 'Parking', labelMr: 'पार्किंग' },
] as const;

type QuickFilter = (typeof filterChips)[number]['key'];
type SortOption = 'recommended' | 'price' | 'rating' | 'distance';

interface PriceRange {
  maximum: number;
  minimum: number;
}

export function PilgrimLodgesScreen() {
  const params = useLocalSearchParams<{ quick?: string; search?: string }>();
  const router = useRouter();
  const { favoriteIds, lodges, refresh, syncError, t, toggleFavorite } = usePilgrimApp();
  const [search, setSearch] = useState(typeof params.search === 'string' ? params.search : '');
  const [activeFilter, setActiveFilter] = useState<QuickFilter>(() =>
    normalizeQuickFilter(params.quick),
  );
  const [sort, setSort] = useState<SortOption>('recommended');
  const [priceRange, setPriceRange] = useState<PriceRange | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftSort, setDraftSort] = useState<SortOption>('recommended');
  const priceBounds = useMemo(() => getPriceBounds(lodges.map((lodge) => lodge.price)), [lodges]);
  const appliedPriceRange = useMemo(
    () => clampPriceRange(priceRange ?? priceBounds, priceBounds),
    [priceBounds, priceRange],
  );
  const [draftPriceRange, setDraftPriceRange] = useState<PriceRange>(priceBounds);
  const hasCustomPriceRange =
    appliedPriceRange.minimum > priceBounds.minimum ||
    appliedPriceRange.maximum < priceBounds.maximum;
  const modalFilterCount = Number(hasCustomPriceRange) + Number(sort !== 'recommended');

  useEffect(() => {
    if (typeof params.search === 'string') {
      setSearch(params.search);
    }
    setActiveFilter(normalizeQuickFilter(params.quick));
  }, [params.quick, params.search]);

  const results = useMemo(() => {
    let items = lodges.filter((lodge) => {
      const phrase = search.trim().toLowerCase();
      const matchesSearch =
        !phrase || `${lodge.name} ${lodge.location} ${lodge.type}`.toLowerCase().includes(phrase);
      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'saved' && favoriteIds.includes(lodge.id)) ||
        (activeFilter === 'near-temple' && distanceInMeters(lodge.distance) < 900) ||
        (activeFilter === 'budget' && lodge.price <= 1200) ||
        (activeFilter === 'family' &&
          lodge.tags.some((tag) => tag.toLowerCase().includes('family'))) ||
        (activeFilter === 'parking' &&
          lodge.amenities.some((item) => item.label.toLowerCase().includes('parking')));
      const matchesPrice =
        lodge.price >= appliedPriceRange.minimum && lodge.price <= appliedPriceRange.maximum;
      return matchesSearch && matchesFilter && matchesPrice;
    });
    if (sort === 'price') items = [...items].sort((a, b) => a.price - b.price);
    if (sort === 'rating') items = [...items].sort((a, b) => b.rating - a.rating);
    if (sort === 'distance')
      items = [...items].sort(
        (a, b) => distanceInMeters(a.distance) - distanceInMeters(b.distance),
      );
    return items;
  }, [activeFilter, appliedPriceRange, favoriteIds, lodges, search, sort]);

  function openFilters() {
    setDraftPriceRange(appliedPriceRange);
    setDraftSort(sort);
    setFilterOpen(true);
  }

  function applyFilters() {
    const normalizedDraft = clampPriceRange(draftPriceRange, priceBounds);
    const isFullRange =
      normalizedDraft.minimum === priceBounds.minimum &&
      normalizedDraft.maximum === priceBounds.maximum;
    setPriceRange(isFullRange ? null : normalizedDraft);
    setSort(draftSort);
    setFilterOpen(false);
  }

  function clearAllFilters() {
    setSearch('');
    setActiveFilter('all');
    setPriceRange(null);
    setSort('recommended');
  }

  return (
    <AppScreen className="gap-5 pt-2">
      <View>
        <Text className="text-2xl font-extrabold tracking-tight text-warm-900">
          {t('Find your stay', 'तुमचा निवास शोधा')}
        </Text>
        <Text className="mt-1 text-sm text-warm-500">
          {t(
            'Verified places around Tulja Bhavani Temple',
            'तुळजाभवानी मंदिराजवळील सत्यापित निवास',
          )}
        </Text>
      </View>

      <SearchBox
        onChangeText={setSearch}
        placeholder={t('Search lodge or locality', 'लॉज किंवा परिसर शोधा')}
        value={search}
      />

      {syncError ? (
        <View className="flex-row items-center gap-3 rounded-2xl bg-danger-50 p-4">
          <MaterialCommunityIcons color={ui.danger} name="cloud-alert-outline" size={22} />
          <Text className="flex-1 text-sm font-semibold text-danger-700">
            {t(
              'Showing saved details. Live availability may have changed.',
              'जतन केलेली माहिती दाखवत आहोत. लाइव्ह उपलब्धता बदलली असू शकते.',
            )}
          </Text>
          <Pressable className="min-h-11 justify-center" onPress={() => void refresh()}>
            <Text className="text-sm font-extrabold text-danger-700">{t('Retry', 'पुन्हा')}</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -20, paddingLeft: 20 }}
      >
        <View className="flex-row gap-2 pr-5">
          {filterChips.map((chip) => {
            const active = activeFilter === chip.key;
            return (
              <Pressable
                className={`min-h-11 justify-center rounded-full border px-4 ${active ? 'border-saffron-500 bg-saffron-500' : 'border-warm-200 bg-white'}`}
                key={chip.key}
                onPress={() => setActiveFilter(chip.key)}
              >
                <Text className={`text-sm font-bold ${active ? 'text-white' : 'text-warm-700'}`}>
                  {t(chip.label, chip.labelMr)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-base font-extrabold text-warm-900">
            {results.length} {t('verified stays', 'सत्यापित निवास')}
          </Text>
          <Text className="mt-0.5 text-xs text-warm-500">
            {t('Prices include taxes shown at checkout', 'चेकआउटवर करांसह किंमत दिसेल')}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={t('Open filters and sorting', 'फिल्टर आणि क्रमवारी उघडा')}
          accessibilityRole="button"
          className="min-h-11 flex-row items-center gap-2 rounded-xl bg-warm-100 px-3"
          onPress={openFilters}
        >
          <MaterialCommunityIcons color={ui.maroon} name="tune-variant" size={20} />
          <Text className="text-sm font-extrabold text-maroon-700">{t('Filters', 'फिल्टर')}</Text>
          {modalFilterCount > 0 ? (
            <View className="h-6 min-w-6 items-center justify-center rounded-full bg-maroon-700 px-1.5">
              <Text className="text-xs font-extrabold text-white">{modalFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {hasCustomPriceRange ? (
        <View className="flex-row items-center justify-between rounded-2xl border border-saffron-100 bg-saffron-50 px-4 py-3">
          <View className="flex-row items-center gap-2">
            <MaterialCommunityIcons color={ui.saffronDeep} name="currency-inr" size={18} />
            <Text className="text-sm font-extrabold text-warm-800">
              {formatRupees(appliedPriceRange.minimum)} – {formatRupees(appliedPriceRange.maximum)}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={t('Remove price filter', 'किंमत फिल्टर काढा')}
            className="min-h-10 justify-center"
            onPress={() => setPriceRange(null)}
          >
            <Text className="text-sm font-extrabold text-maroon-700">{t('Clear', 'काढा')}</Text>
          </Pressable>
        </View>
      ) : null}

      <View className="gap-5">
        {results.map((lodge) => (
          <LodgeCard
            favorite={favoriteIds.includes(lodge.id)}
            key={lodge.id}
            lodge={lodge}
            onFavorite={() => toggleFavorite(lodge.id)}
            onPress={() =>
              router.push({ pathname: '/(app)/lodges/[id]', params: { id: lodge.id } })
            }
          />
        ))}
        {results.length === 0 ? (
          <View className="items-center rounded-3xl border border-warm-100 bg-white px-7 py-12">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-saffron-50">
              <MaterialCommunityIcons color={ui.saffronDeep} name="bed-empty" size={32} />
            </View>
            <Text className="mt-4 text-lg font-extrabold text-warm-900">
              {t('No matching stays', 'जुळणारा निवास नाही')}
            </Text>
            <Text className="mt-2 text-center text-sm text-warm-500">
              {t('Try another search or remove a filter.', 'दुसरा शोध वापरा किंवा फिल्टर काढा.')}
            </Text>
            <Pressable className="mt-5 min-h-11 justify-center" onPress={clearAllFilters}>
              <Text className="font-extrabold text-saffron-700">
                {t('Clear all filters', 'सर्व फिल्टर काढा')}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Modal
        animationType="slide"
        transparent
        visible={filterOpen}
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable className="flex-1 justify-end bg-black/35" onPress={() => setFilterOpen(false)}>
          <Pressable
            className="rounded-t-3xl bg-warm-50 px-5 pb-9 pt-3"
            onPress={(event) => event.stopPropagation()}
            style={{ maxHeight: '92%' }}
          >
            <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-warm-300" />
            <SafeAreaView edges={['bottom']} style={{ flexShrink: 1 }}>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-2xl font-extrabold text-warm-900">
                    {t('Filters & sort', 'फिल्टर आणि क्रमवारी')}
                  </Text>
                  <Text className="mt-1 text-sm text-warm-500">
                    {t('Set your budget and preferred order', 'तुमचे बजेट आणि क्रम निवडा')}
                  </Text>
                </View>
                <Pressable
                  className="h-11 w-11 items-center justify-center rounded-full bg-warm-100"
                  onPress={() => setFilterOpen(false)}
                >
                  <MaterialCommunityIcons color={ui.ink} name="close" size={22} />
                </Pressable>
              </View>
              <ScrollView
                className="mt-5"
                showsVerticalScrollIndicator={false}
                style={{ flexShrink: 1 }}
              >
                <View className="rounded-3xl border border-warm-100 bg-white p-5">
                  <View className="mb-5 flex-row items-center justify-between">
                    <View>
                      <Text className="text-lg font-extrabold text-warm-900">
                        {t('Price per night', 'प्रति रात्री किंमत')}
                      </Text>
                      <Text className="mt-1 text-xs text-warm-500">
                        {t('Drag either handle to set your range', 'श्रेणीसाठी दोन्ही हँडल सरकवा')}
                      </Text>
                    </View>
                    <MaterialCommunityIcons color={ui.saffronDeep} name="currency-inr" size={23} />
                  </View>
                  <PriceRangeSlider
                    max={priceBounds.maximum}
                    maximumLabel={t('Maximum', 'कमाल')}
                    min={priceBounds.minimum}
                    minimumLabel={t('Minimum', 'किमान')}
                    onChange={(minimum, maximum) => setDraftPriceRange({ maximum, minimum })}
                    step={100}
                    valueMax={draftPriceRange.maximum}
                    valueMin={draftPriceRange.minimum}
                  />
                </View>

                <Text className="mb-3 mt-6 text-lg font-extrabold text-warm-900">
                  {t('Sort by', 'क्रमवारी')}
                </Text>
                <View className="mb-5 overflow-hidden rounded-2xl border border-warm-100 bg-white px-4">
                  {[
                    {
                      key: 'recommended' as const,
                      label: t('Recommended', 'शिफारस केलेले'),
                      icon: 'star-four-points' as const,
                    },
                    {
                      key: 'distance' as const,
                      label: t('Closest to temple', 'मंदिराच्या सर्वात जवळ'),
                      icon: 'temple-hindu' as const,
                    },
                    {
                      key: 'price' as const,
                      label: t('Price: low to high', 'किंमत: कमी ते जास्त'),
                      icon: 'currency-inr' as const,
                    },
                    {
                      key: 'rating' as const,
                      label: t('Guest rating', 'पाहुण्यांचे रेटिंग'),
                      icon: 'star' as const,
                    },
                  ].map((item, index, array) => (
                    <Pressable
                      className={`min-h-16 flex-row items-center gap-3 ${index < array.length - 1 ? 'border-b border-warm-100' : ''}`}
                      key={item.key}
                      onPress={() => setDraftSort(item.key)}
                    >
                      <MaterialCommunityIcons
                        color={draftSort === item.key ? ui.saffronDeep : ui.muted}
                        name={item.icon}
                        size={22}
                      />
                      <Text className="flex-1 text-base font-bold text-warm-900">{item.label}</Text>
                      <MaterialCommunityIcons
                        color={draftSort === item.key ? ui.saffronDeep : '#D7C8B8'}
                        name={draftSort === item.key ? 'radiobox-marked' : 'radiobox-blank'}
                        size={23}
                      />
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              <View className="mt-4 flex-row items-center gap-4">
                <Pressable
                  className="min-h-14 justify-center px-2"
                  onPress={() => {
                    setDraftPriceRange(priceBounds);
                    setDraftSort('recommended');
                  }}
                >
                  <Text className="text-sm font-extrabold text-maroon-700">
                    {t('Reset', 'रीसेट')}
                  </Text>
                </Pressable>
                <PrimaryButton className="flex-1" onPress={applyFilters}>
                  {t('Apply filters', 'फिल्टर लागू करा')}
                </PrimaryButton>
              </View>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

function distanceInMeters(value: string): number {
  const distance = Number.parseFloat(value.replace(/,/gu, ''));
  if (!Number.isFinite(distance)) return Number.MAX_SAFE_INTEGER;
  return /\bkm\b/iu.test(value) ? distance * 1000 : distance;
}

function normalizeQuickFilter(value: string | string[] | undefined): QuickFilter {
  const candidate = typeof value === 'string' ? value : 'all';
  return filterChips.some((filter) => filter.key === candidate)
    ? (candidate as QuickFilter)
    : 'all';
}

function getPriceBounds(prices: number[]): PriceRange {
  const validPrices = prices.filter((price) => Number.isFinite(price) && price >= 0);
  if (validPrices.length === 0) {
    return { maximum: 5000, minimum: 0 };
  }

  const minimum = Math.floor(Math.min(...validPrices) / 100) * 100;
  const maximum = Math.ceil(Math.max(...validPrices) / 100) * 100;
  return {
    maximum: Math.max(maximum, minimum + 100),
    minimum,
  };
}

function clampPriceRange(range: PriceRange, bounds: PriceRange): PriceRange {
  const minimum = Math.min(
    bounds.maximum,
    Math.max(bounds.minimum, Math.min(range.minimum, range.maximum)),
  );
  const maximum = Math.max(
    minimum,
    Math.min(bounds.maximum, Math.max(range.minimum, range.maximum)),
  );
  return { maximum, minimum };
}
