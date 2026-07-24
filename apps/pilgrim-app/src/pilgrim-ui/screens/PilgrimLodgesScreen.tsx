import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppScreen, LodgeCard, PrimaryButton, SearchBox, ui } from '../components';
import { usePilgrimApp } from '../PilgrimAppProvider';

const filterChips = [
  { key: 'all', label: 'All stays', labelMr: 'सर्व निवास' },
  { key: 'saved', label: 'Saved', labelMr: 'जतन केलेले' },
  { key: 'near-temple', label: 'Near temple', labelMr: 'मंदिराजवळ' },
  { key: 'budget', label: 'Under ₹1,200', labelMr: '₹१,२०० पेक्षा कमी' },
  { key: 'family', label: 'Family rooms', labelMr: 'कुटुंब खोली' },
  { key: 'parking', label: 'Parking', labelMr: 'पार्किंग' },
];

export function PilgrimLodgesScreen() {
  const params = useLocalSearchParams<{ quick?: string; search?: string }>();
  const router = useRouter();
  const { favoriteIds, lodges, refresh, syncError, t, toggleFavorite } = usePilgrimApp();
  const [search, setSearch] = useState(typeof params.search === 'string' ? params.search : '');
  const [activeFilter, setActiveFilter] = useState(
    typeof params.quick === 'string' ? params.quick : 'all',
  );
  const [sort, setSort] = useState<'recommended' | 'price' | 'rating' | 'distance'>('recommended');
  const [filterOpen, setFilterOpen] = useState(false);

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
      return matchesSearch && matchesFilter;
    });
    if (sort === 'price') items = [...items].sort((a, b) => a.price - b.price);
    if (sort === 'rating') items = [...items].sort((a, b) => b.rating - a.rating);
    if (sort === 'distance')
      items = [...items].sort(
        (a, b) => distanceInMeters(a.distance) - distanceInMeters(b.distance),
      );
    return items;
  }, [activeFilter, favoriteIds, lodges, search, sort]);

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
          className="min-h-11 flex-row items-center gap-2 rounded-xl bg-warm-100 px-3"
          onPress={() => setFilterOpen(true)}
        >
          <MaterialCommunityIcons color={ui.maroon} name="sort-variant" size={20} />
          <Text className="text-sm font-extrabold text-maroon-700">{t('Sort', 'क्रम')}</Text>
        </Pressable>
      </View>

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
            <Pressable
              className="mt-5 min-h-11 justify-center"
              onPress={() => {
                setSearch('');
                setActiveFilter('all');
              }}
            >
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
          >
            <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-warm-300" />
            <SafeAreaView edges={['bottom']}>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-2xl font-extrabold text-warm-900">
                    {t('Sort stays', 'निवास क्रमवारी')}
                  </Text>
                  <Text className="mt-1 text-sm text-warm-500">
                    {t('Choose what matters most', 'तुमच्यासाठी महत्त्वाचे निवडा')}
                  </Text>
                </View>
                <Pressable
                  className="h-11 w-11 items-center justify-center rounded-full bg-warm-100"
                  onPress={() => setFilterOpen(false)}
                >
                  <MaterialCommunityIcons color={ui.ink} name="close" size={22} />
                </Pressable>
              </View>
              <View className="my-6 overflow-hidden rounded-2xl border border-warm-100 bg-white px-4">
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
                    onPress={() => setSort(item.key)}
                  >
                    <MaterialCommunityIcons
                      color={sort === item.key ? ui.saffronDeep : ui.muted}
                      name={item.icon}
                      size={22}
                    />
                    <Text className="flex-1 text-base font-bold text-warm-900">{item.label}</Text>
                    <MaterialCommunityIcons
                      color={sort === item.key ? ui.saffronDeep : '#D7C8B8'}
                      name={sort === item.key ? 'radiobox-marked' : 'radiobox-blank'}
                      size={23}
                    />
                  </Pressable>
                ))}
              </View>
              <PrimaryButton onPress={() => setFilterOpen(false)}>
                {t('Show results', 'निकाल पहा')}
              </PrimaryButton>
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
