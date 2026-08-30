import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { PromotionalBanner } from '@tuljai/types';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useAuth } from '../../auth/auth-context';
import { usePublicSettings } from '../../settings/usePublicSettings';
import {
  AppScreen,
  BrandMark,
  IconButton,
  LodgeCard,
  LodgeCardSkeleton,
  SearchBox,
  SectionTitle,
  StatusBadge,
  ui,
} from '../components';
import { formatRupees, type PilgrimLodge } from '../mock-data';
import { usePilgrimApp } from '../PilgrimAppProvider';

const categories = [
  {
    icon: 'temple-hindu' as const,
    label: 'Near temple',
    labelMr: 'मंदिराजवळ',
    quick: 'near-temple',
  },
  {
    icon: 'account-group' as const,
    label: 'Family stays',
    labelMr: 'कुटुंबासाठी',
    quick: 'family',
  },
  { icon: 'wallet-outline' as const, label: 'Budget', labelMr: 'बजेट', quick: 'budget' },
  { icon: 'car' as const, label: 'Parking', labelMr: 'पार्किंग', quick: 'parking' },
];

// How many featured lodges show in the "Loved by pilgrims" strip. Only
// these get their full details (photos, price) requested from the home
// screen — the rest of the catalog stays untouched until the user opens
// the full lodges list.
const FEATURED_LODGE_COUNT = 4;

export function PilgrimHomeScreen() {
  const router = useRouter();
  const auth = useAuth();
  const publicSettings = usePublicSettings();
  const {
    bookings,
    ensureLodgesHydrated,
    favoriteIds,
    isSyncing,
    lodges,
    notifications,
    refresh,
    syncError,
    t,
    toggleFavorite,
  } = usePilgrimApp();
  const upcoming = bookings.find(
    (booking) => booking.status === 'checked-in' || booking.status === 'confirmed',
  );
  const unread = notifications.filter((item) => !item.read).length;
  const firstName = auth.user?.displayName?.trim().split(/\s+/)[0];
  const featuredLodges = useMemo(() => lodges.slice(0, FEATURED_LODGE_COUNT), [lodges]);
  const featuredLodgeIdsKey = useMemo(
    () => featuredLodges.map((lodge) => lodge.id).join('|'),
    [featuredLodges],
  );

  useEffect(() => {
    if (!featuredLodgeIdsKey) return;
    ensureLodgesHydrated(featuredLodgeIdsKey.split('|'));
  }, [ensureLodgesHydrated, featuredLodgeIdsKey]);

  return (
    <AppScreen className="gap-7 pt-2">
      <View className="flex-row items-center justify-between">
        <BrandMark compact />
        <View className="relative">
          <IconButton
            accessibilityLabel="Open notifications"
            icon="bell-outline"
            onPress={() => router.push('/(app)/notifications')}
          />
          {unread > 0 ? (
            <View
              className="absolute right-0 top-0 h-5 min-w-5 items-center justify-center rounded-full border-2 border-warm-50 bg-maroon-700 px-1"
              style={{ pointerEvents: 'none' }}
            >
              <Text className="text-[10px] font-extrabold text-white">{unread}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View>
        <Text className="text-sm font-bold text-maroon-700">
          {t('Namaskar', 'नमस्कार')}
          {firstName ? ` ${firstName}` : ''} 🙏
        </Text>
        <Text className="mt-1 text-[28px] font-extrabold leading-9 tracking-tight text-warm-900">
          {t('Plan a peaceful darshan', 'शांत दर्शनाची योजना करा')}
        </Text>
        <Text className="mt-1 text-sm leading-5 text-warm-500">
          {t('Verified stays around Tulja Bhavani Temple', 'तुळजाभवानी मंदिराजवळील सत्यापित निवास')}
        </Text>
      </View>

      <SearchBox
        onPress={() => router.push('/(app)/lodges')}
        placeholder={t('Search lodges, Bhakt Niwas or area', 'लॉज, भक्त निवास किंवा परिसर शोधा')}
      />

      {syncError ? (
        <View className="flex-row items-center gap-3 rounded-2xl bg-danger-50 p-4">
          <MaterialCommunityIcons color={ui.danger} name="cloud-alert-outline" size={22} />
          <View className="flex-1">
            <Text className="text-sm font-extrabold text-danger-700">
              {t('Live updates are paused', 'लाइव्ह अपडेट थांबले आहेत')}
            </Text>
            <Text className="mt-0.5 text-xs text-warm-600">
              {t('Saved lodge details are still available.', 'जतन केलेली लॉज माहिती उपलब्ध आहे.')}
            </Text>
          </View>
          <Pressable className="min-h-11 justify-center" onPress={() => void refresh()}>
            <Text className="text-sm font-extrabold text-danger-700">{t('Retry', 'पुन्हा')}</Text>
          </Pressable>
        </View>
      ) : isSyncing ? (
        <View className="flex-row items-center gap-2 rounded-2xl bg-warm-100 px-4 py-3">
          <MaterialCommunityIcons color={ui.saffronDeep} name="cloud-sync-outline" size={20} />
          <Text className="text-xs font-bold text-warm-600">
            {t('Updating live availability…', 'लाइव्ह उपलब्धता अपडेट होत आहे…')}
          </Text>
        </View>
      ) : null}

      {publicSettings.promotionalBanners.length > 0 ? (
        <PromotionalBannerCarousel banners={publicSettings.promotionalBanners} lodges={lodges} />
      ) : (
        <View className="overflow-hidden rounded-3xl bg-maroon-700 p-5">
          <View className="absolute -right-8 -top-7 h-32 w-32 rounded-full bg-saffron-500/20" />
          <View className="absolute -bottom-12 right-12 h-28 w-28 rounded-full bg-white/5" />
          <View className="flex-row items-start gap-4">
            <View className="min-w-0 flex-1">
              <View className="self-start rounded-full bg-white/10 px-3 py-1.5">
                <Text className="text-xs font-bold text-orange-100">
                  NAVRATRI 2026 · EARLY ACCESS
                </Text>
              </View>
              <Text className="mt-3 text-2xl font-extrabold leading-8 text-white">
                {t('Book early. Travel with peace of mind.', 'लवकर बुक करा. निश्चिंत प्रवास करा.')}
              </Text>
              <Text className="mt-2 text-sm leading-5 text-orange-100">
                {t(
                  'Free cancellation on selected stays until 30 September.',
                  'निवडक निवासांवर ३० सप्टेंबरपर्यंत मोफत रद्दीकरण.',
                )}
              </Text>
              <Pressable
                className="mt-4 min-h-11 self-start justify-center rounded-xl bg-white px-4"
                onPress={() =>
                  router.push({ pathname: '/(app)/lodges', params: { quick: 'family' } })
                }
              >
                <Text className="text-sm font-extrabold text-maroon-700">
                  {t('Explore Navratri stays', 'नवरात्र निवास पहा')}
                </Text>
              </Pressable>
            </View>
            <View className="h-20 w-20 items-center justify-center rounded-full bg-white/10">
              <MaterialCommunityIcons color="#FFE8C8" name="temple-hindu" size={47} />
            </View>
          </View>
        </View>
      )}

      <View className="gap-4">
        <SectionTitle title={t('Find your kind of stay', 'तुमच्या पसंतीचा निवास')} />
        <View className="flex-row justify-between gap-2">
          {categories.map((category) => (
            <Pressable
              className="min-h-24 flex-1 items-center justify-center gap-2 rounded-2xl border border-warm-100 bg-white px-1 active:bg-saffron-50"
              key={category.quick}
              onPress={() =>
                router.push({ pathname: '/(app)/lodges', params: { quick: category.quick } })
              }
            >
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-saffron-50">
                <MaterialCommunityIcons color={ui.saffronDeep} name={category.icon} size={23} />
              </View>
              <Text className="text-center text-[11px] font-bold text-warm-700" numberOfLines={2}>
                {t(category.label, category.labelMr)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {upcoming ? (
        <View className="gap-4">
          <SectionTitle
            action={t('View booking', 'बुकिंग पहा')}
            onAction={() =>
              router.push({ pathname: '/(app)/bookings/[id]', params: { id: upcoming.id } })
            }
            title={t('Your upcoming yatra', 'तुमची आगामी यात्रा')}
          />
          <Pressable
            className="overflow-hidden rounded-3xl border border-warm-100 bg-white"
            onPress={() =>
              router.push({ pathname: '/(app)/bookings/[id]', params: { id: upcoming.id } })
            }
          >
            <View className="bg-templeGreen-50 px-4 py-3">
              <StatusBadge status={upcoming.status} />
            </View>
            <View className="gap-4 p-4">
              <View>
                <Text className="text-lg font-extrabold text-warm-900">{upcoming.lodgeName}</Text>
                <Text className="mt-1 text-sm text-warm-500">{upcoming.roomName}</Text>
              </View>
              <View className="flex-row items-center gap-4 rounded-2xl bg-warm-50 p-3.5">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white">
                  <MaterialCommunityIcons color={ui.maroon} name="calendar-check" size={25} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-warm-500">CHECK-IN · CHECK-OUT</Text>
                  <Text className="mt-1 text-sm font-extrabold text-warm-900">
                    {upcoming.checkIn} — {upcoming.checkOut}
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>
        </View>
      ) : null}

      <View className="gap-4">
        <SectionTitle
          action={t('View all', 'सर्व पहा')}
          onAction={() => router.push('/(app)/lodges')}
          subtitle={t(
            'Handpicked for comfort, location and trust',
            'आराम, स्थान आणि विश्वासासाठी निवडलेले',
          )}
          title={t('Loved by pilgrims', 'भाविकांची आवड')}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -20, paddingLeft: 20 }}
        >
          {featuredLodges.map((lodge) =>
            lodge.hydrated === false ? (
              <LodgeCardSkeleton horizontal key={lodge.id} />
            ) : (
              <LodgeCard
                favorite={favoriteIds.includes(lodge.id)}
                horizontal
                key={lodge.id}
                lodge={lodge}
                onFavorite={() => toggleFavorite(lodge.id)}
                onPress={() =>
                  router.push({ pathname: '/(app)/lodges/[id]', params: { id: lodge.id } })
                }
              />
            ),
          )}
        </ScrollView>
      </View>

      <View className="gap-4">
        <SectionTitle title={t('Why book with Tuljai Stays?', 'तुळजाई स्टेजसोबत का बुक करावे?')} />
        <View className="flex-row gap-3">
          {[
            { icon: 'check-decagram' as const, label: t('Verified lodges', 'सत्यापित लॉज') },
            { icon: 'currency-inr' as const, label: t('Clear pricing', 'स्पष्ट किंमत') },
            { icon: 'headset' as const, label: t('Local support', 'स्थानिक मदत') },
          ].map((item) => (
            <View
              className="flex-1 items-center gap-2 rounded-2xl bg-saffron-50 px-2 py-4"
              key={item.label}
            >
              <MaterialCommunityIcons color={ui.saffronDeep} name={item.icon} size={25} />
              <Text className="text-center text-xs font-extrabold text-warm-700">{item.label}</Text>
            </View>
          ))}
        </View>
        <Text className="text-center text-xs text-warm-500">
          {t(
            `Rooms from ${formatRupees(699)} per night · No hidden platform fees`,
            `${formatRupees(699)} प्रति रात्र पासून · कोणतेही लपलेले शुल्क नाही`,
          )}
        </Text>
      </View>
    </AppScreen>
  );
}

function PromotionalBannerCarousel({
  banners,
  lodges,
}: {
  banners: PromotionalBanner[];
  lodges: PilgrimLodge[];
}) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const cardWidth = Math.max(width - 40, 280);

  useEffect(() => {
    if (banners.length < 2) return undefined;
    const interval = setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % banners.length;
        scrollRef.current?.scrollTo({ animated: true, x: next * cardWidth });
        return next;
      });
    }, 5_000);
    return () => clearInterval(interval);
  }, [banners.length, cardWidth]);

  async function openBanner(banner: PromotionalBanner) {
    if (banner.category === 'LODGE_PROMOTION' && banner.lodgeSlug) {
      const lodge = lodges.find((item) => item.slug === banner.lodgeSlug);
      if (lodge) {
        router.push({ pathname: '/(app)/lodges/[id]', params: { id: lodge.id } });
      }
      return;
    }

    if (banner.linkUrl) {
      await Linking.openURL(banner.linkUrl).catch(() => undefined);
    }
  }

  return (
    <View className="gap-3">
      <ScrollView
        horizontal
        pagingEnabled
        ref={scrollRef}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth}
        onMomentumScrollEnd={(event) =>
          setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / cardWidth))
        }
      >
        {banners.map((banner) => {
          const clickable = Boolean(
            (banner.category === 'LODGE_PROMOTION' && banner.lodgeSlug) || banner.linkUrl,
          );
          return (
            <Pressable
              accessibilityRole={clickable ? 'button' : undefined}
              className="overflow-hidden rounded-3xl bg-maroon-800"
              disabled={!clickable}
              key={banner.id}
              style={{ height: 210, width: cardWidth }}
              onPress={() => void openBanner(banner)}
            >
              <Image
                className="absolute inset-0 h-full w-full"
                resizeMode="cover"
                source={{ uri: banner.imageUrl }}
              />
              <View className="absolute inset-0 bg-black/40" />
              <View className="flex-1 justify-end p-5">
                <View className="self-start rounded-full bg-white/90 px-3 py-1.5">
                  <Text className="text-[11px] font-extrabold text-maroon-700">
                    {banner.category.replace('_', ' ')}
                  </Text>
                </View>
                <Text className="mt-3 text-2xl font-extrabold leading-8 text-white">
                  {banner.title}
                </Text>
                {banner.subtitle ? (
                  <Text className="mt-1 text-sm leading-5 text-white/90" numberOfLines={2}>
                    {banner.subtitle}
                  </Text>
                ) : null}
                {clickable ? (
                  <View className="mt-3 flex-row items-center gap-1.5">
                    <Text className="text-xs font-extrabold text-white">View details</Text>
                    <MaterialCommunityIcons color="#FFFFFF" name="arrow-right" size={16} />
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {banners.length > 1 ? (
        <View className="flex-row justify-center gap-1.5">
          {banners.map((banner, index) => (
            <View
              className={`h-2 rounded-full ${index === activeIndex ? 'w-6 bg-saffron-500' : 'w-2 bg-warm-200'}`}
              key={banner.id}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
