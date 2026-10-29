import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CatalogQuery } from '../../v2/core/catalog';
import {
  AppScreen,
  EmptyState,
  Field,
  LodgeCard,
  LodgeCardSkeleton,
  PrimaryButton,
  SearchBox,
  SecondaryButton,
  TopBar,
  ui,
} from '../components';
import { usePilgrimApp } from '../PilgrimAppProvider';
import { useBrowseCatalog } from '../useBrowseCatalog';

const filters = [
  { id: 'all', en: 'All stays', mr: 'सर्व निवास' },
  { id: 'saved', en: 'Saved', mr: 'जतन केलेले' },
  { id: 'near-temple', en: 'Near temple', mr: 'मंदिराजवळ' },
  { id: 'budget', en: 'Under ₹1,200', mr: '₹१,२०० पेक्षा कमी' },
  { id: 'family', en: 'Family rooms', mr: 'कुटुंब खोली' },
  { id: 'parking', en: 'Parking', mr: 'पार्किंग' },
];
const sorts = [
  { id: 'name' as const, en: 'Lodge name', mr: 'लॉजचे नाव' },
  { id: 'price' as const, en: 'Price: low to high', mr: 'किंमत: कमी ते जास्त' },
  { id: 'rating' as const, en: 'Highest rated', mr: 'सर्वोच्च मानांकन' },
  { id: 'distance' as const, en: 'Nearest to temple', mr: 'मंदिराजवळ' },
];
export function PilgrimLodgesScreen() {
  const params = useLocalSearchParams<{ quick?: string; search?: string }>();
  const router = useRouter();
  const { favoriteIds, toggleFavorite, t } = usePilgrimApp();
  const [search, setSearch] = useState(params.search ?? '');
  const [filter, setFilter] = useState(params.quick ?? 'all');
  const [sort, setSort] = useState<CatalogQuery['sort']>('name');
  const [range, setRange] = useState({ min: '', max: '' });
  const [draft, setDraft] = useState({ min: '', max: '', sort });
  const [open, setOpen] = useState(false);
  const [rangeError, setRangeError] = useState(false);
  useEffect(() => {
    setSearch(params.search ?? '');
    setFilter(params.quick ?? 'all');
  }, [params.search, params.quick]);
  const query = useMemo<CatalogQuery>(
    () => ({
      search: search.trim() || undefined,
      sort,
      minPrice: range.min ? Number(range.min) : undefined,
      maxPrice:
        filter === 'budget'
          ? Math.min(range.max ? Number(range.max) : 1200, 1200)
          : range.max
            ? Number(range.max)
            : undefined,
      maxDistance: filter === 'near-temple' ? 900 : undefined,
      amenities:
        filter === 'parking' ? ['parking'] : filter === 'family' ? ['family-friendly'] : undefined,
      ids: filter === 'saved' ? favoriteIds : undefined,
    }),
    [favoriteIds, filter, range, search, sort],
  );
  const catalog = useBrowseCatalog(query, filter === 'saved' && favoriteIds.length === 0);
  function clear() {
    setSearch('');
    setFilter('all');
    setSort('name');
    setRange({ min: '', max: '' });
  }
  function apply() {
    if (
      (draft.min && !/^\d+$/.test(draft.min)) ||
      (draft.max && !/^\d+$/.test(draft.max)) ||
      (draft.min && draft.max && Number(draft.min) > Number(draft.max))
    ) {
      setRangeError(true);
      return;
    }
    setRange({ min: draft.min, max: draft.max });
    setSort(draft.sort);
    setOpen(false);
  }
  return (
    <AppScreen
      className="gap-5 pt-2"
      refreshing={catalog.loading && catalog.items.length > 0}
      onRefresh={catalog.refresh}
      onScroll={(event) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        if (contentSize.height - contentOffset.y - layoutMeasurement.height < 400)
          catalog.loadMore();
      }}
    >
      <TopBar
        title={t('Find your peaceful stay', 'तुमचा शांत निवास शोधा')}
        subtitle={t('Tuljapur, Maharashtra', 'तुळजापूर, महाराष्ट्र')}
      />
      <SearchBox
        value={search}
        onChangeText={setSearch}
        placeholder={t('Search lodge or locality', 'लॉज किंवा परिसर शोधा')}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      >
        {filters.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === item.id }}
            className={`min-h-12 justify-center rounded-full border px-4 ${filter === item.id ? 'border-maroon-700 bg-maroon-700' : 'border-warm-200 bg-white'}`}
            onPress={() => setFilter(item.id)}
          >
            <Text
              className={`text-sm font-bold ${filter === item.id ? 'text-white' : 'text-warm-600'}`}
            >
              {t(item.en, item.mr)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-sm text-warm-600">
          {catalog.total} {t('stays found', 'निवास सापडले')}
        </Text>
        <SecondaryButton
          icon="tune-variant"
          onPress={() => {
            setDraft({ ...range, sort });
            setRangeError(false);
            setOpen(true);
          }}
        >
          {t('Sort & filter', 'क्रम व फिल्टर')}
        </SecondaryButton>
      </View>
      {range.min || range.max ? (
        <Text className="text-sm text-maroon-700">
          {t('Price per night', 'प्रति रात्र किंमत')}: ₹{range.min || '0'} –{' '}
          {range.max ? `₹${range.max}` : t('Any', 'कोणतीही')}
        </Text>
      ) : null}
      {catalog.error ? (
        <View className="gap-3 rounded-2xl bg-danger-50 p-4">
          <Text accessibilityRole="alert" className="text-sm text-danger-700">
            {t(
              'Could not load stays. Check your connection and try again.',
              'निवास लोड झाले नाहीत. कनेक्शन तपासून पुन्हा प्रयत्न करा.',
            )}
          </Text>
          <SecondaryButton icon="refresh" onPress={catalog.refresh}>
            {t('Retry', 'पुन्हा')}
          </SecondaryButton>
        </View>
      ) : null}
      {catalog.items.map((lodge) => (
        <LodgeCard
          key={lodge.id}
          lodge={lodge}
          favorite={favoriteIds.includes(lodge.id)}
          onFavorite={() => toggleFavorite(lodge.id)}
          onPress={() => router.push({ pathname: '/(app)/lodges/[id]', params: { id: lodge.id } })}
        />
      ))}
      {catalog.loading ? <LodgeCardSkeleton /> : null}
      {!catalog.loading && !catalog.error && catalog.items.length === 0 ? (
        <EmptyState
          icon="bed-empty"
          title={t('No matching stays', 'जुळणारा निवास नाही')}
          body={t('Try another search or remove a filter.', 'दुसरा शोध वापरा किंवा फिल्टर काढा.')}
          action={t('Clear filters', 'फिल्टर काढा')}
          onAction={clear}
        />
      ) : null}
      {!catalog.loading && catalog.hasMore ? (
        <SecondaryButton icon="chevron-down" onPress={catalog.loadMore}>
          {t('Load more stays', 'आणखी निवास पहा')}
        </SecondaryButton>
      ) : null}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <SafeAreaView edges={['bottom']} className="max-h-[90%] rounded-t-3xl bg-warm-50">
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 24, gap: 18 }}
            >
              <TopBar
                title={t('Sort & filter', 'क्रम व फिल्टर')}
                right={
                  <Pressable
                    accessibilityLabel={t('Close filters', 'फिल्टर बंद करा')}
                    accessibilityRole="button"
                    className="h-12 w-12 items-center justify-center"
                    onPress={() => setOpen(false)}
                  >
                    <MaterialCommunityIcons name="close" color={ui.ink} size={24} />
                  </Pressable>
                }
              />
              {sorts.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: draft.sort === item.id }}
                  className="min-h-12 flex-row items-center gap-3"
                  onPress={() => setDraft({ ...draft, sort: item.id })}
                >
                  <MaterialCommunityIcons
                    name={draft.sort === item.id ? 'radiobox-marked' : 'radiobox-blank'}
                    color={ui.maroon}
                    size={24}
                  />
                  <Text className="text-base text-warm-900">{t(item.en, item.mr)}</Text>
                </Pressable>
              ))}
              <View className="flex-row gap-3">
                <Field
                  className="flex-1"
                  label={t('Minimum ₹', 'किमान ₹')}
                  value={draft.min}
                  keyboardType="number-pad"
                  maxLength={7}
                  onChangeText={(min) => setDraft({ ...draft, min })}
                  placeholder="0"
                />
                <Field
                  className="flex-1"
                  label={t('Maximum ₹', 'कमाल ₹')}
                  value={draft.max}
                  keyboardType="number-pad"
                  maxLength={7}
                  onChangeText={(max) => setDraft({ ...draft, max })}
                  placeholder={t('Any', 'कोणतीही')}
                />
              </View>
              {rangeError ? (
                <Text accessibilityRole="alert" className="text-sm text-danger-700">
                  {t('Enter a valid price range.', 'वैध किंमत मर्यादा द्या.')}
                </Text>
              ) : null}
              <PrimaryButton onPress={apply}>{t('Show stays', 'निवास दाखवा')}</PrimaryButton>
              <SecondaryButton
                onPress={() => {
                  clear();
                  setOpen(false);
                }}
              >
                {t('Reset filters', 'फिल्टर रीसेट करा')}
              </SecondaryButton>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </AppScreen>
  );
}
