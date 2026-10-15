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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/auth-context';
import { usePublicSettings } from '../../settings/usePublicSettings';
import { AppScreen, LodgeCard, StatusBadge, type PilgrimIconName } from '../components';
import { Gradient, home, HomeSectionHeader } from '../home/HomeKit';
import { formatRupees, type PilgrimLodge } from '../mock-data';
import { usePilgrimApp } from '../PilgrimAppProvider';

const categories: Array<{ icon: PilgrimIconName; label: string; labelMr: string; quick: string }> =
  [
    { icon: 'temple-hindu', label: 'Near temple', labelMr: 'मंदिराजवळ', quick: 'near-temple' },
    { icon: 'account-group', label: 'Family', labelMr: 'कुटुंब', quick: 'family' },
    { icon: 'wallet-outline', label: 'Budget', labelMr: 'बजेट', quick: 'budget' },
    { icon: 'car', label: 'Parking', labelMr: 'पार्किंग', quick: 'parking' },
  ];

// Home only requests full details for the featured lodges (count is set from
// the admin panel); the rest of the catalog loads when the lodges list opens.
const STAY_CARD_WIDTH = 290;
const STAY_CARD_GAP = 12;

export function PilgrimHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const publicSettings = usePublicSettings();
  const {
    bookings,
    ensureLodgesHydrated,
    favoriteIds,
    isSyncing,
    lodges,
    refresh,
    syncError,
    t,
    toggleFavorite,
    unreadCount,
  } = usePilgrimApp();
  const upcoming = bookings.find(
    (booking) => booking.status === 'checked-in' || booking.status === 'confirmed',
  );
  const firstName = auth.user?.displayName?.trim().split(/\s+/)[0];
  const content = publicSettings.homeContent;
  const featuredLodges = useMemo(
    () => lodges.slice(0, content.featuredCount),
    [lodges, content.featuredCount],
  );
  const featuredLodgeIdsKey = useMemo(
    () => featuredLodges.map((lodge) => lodge.id).join('|'),
    [featuredLodges],
  );
  const startingPrice = useMemo(() => {
    const prices = lodges
      .filter((lodge) => lodge.hydrated !== false && lodge.price > 0)
      .map((lodge) => lodge.price);
    return prices.length > 0 ? Math.min(...prices) : null;
  }, [lodges]);

  useEffect(() => {
    if (!featuredLodgeIdsKey) return;
    ensureLodgesHydrated(featuredLodgeIdsKey.split('|'));
  }, [ensureLodgesHydrated, featuredLodgeIdsKey]);

  const openLodges = (quick?: string) =>
    router.push(
      quick ? { pathname: '/(app)/lodges', params: { quick } } : { pathname: '/(app)/lodges' },
    );

  return (
    <AppScreen className="gap-5 pb-8" edges={[]} padded={false}>
      {/* Brand header */}
      <Gradient
        colors={home.sunrise}
        style={{ paddingBottom: 64, paddingHorizontal: 20, paddingTop: insets.top + 14 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="min-w-0 flex-1 pr-3">
            <Text className="text-[13px] font-semibold text-white/85">
              {t('Namaskar', 'नमस्कार')}
              {firstName ? `, ${firstName}` : ''} 🙏
            </Text>
            <Text className="mt-0.5 text-[26px] font-extrabold tracking-tight text-white">
              {t('Find your stay', 'तुमचा निवास शोधा')}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Open notifications"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center rounded-full bg-white/20 active:opacity-70"
            onPress={() => router.push('/(app)/notifications')}
          >
            <MaterialCommunityIcons color="#FFFFFF" name="bell-outline" size={22} />
            {unreadCount > 0 ? (
              <View className="absolute -right-0.5 -top-0.5 h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1">
                <Text className="text-[10px] font-extrabold" style={{ color: home.primary }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        <View className="mt-3 flex-row items-center gap-1.5 self-start rounded-full bg-white/20 px-3 py-1.5">
          <MaterialCommunityIcons color="#FFFFFF" name="map-marker" size={13} />
          <Text className="text-[12px] font-bold text-white">
            {t('Tulja Bhavani Temple, Tuljapur', 'तुळजाभवानी मंदिर, तुळजापूर')}
          </Text>
        </View>
      </Gradient>

      {/* Floating search card */}
      <View className="-mt-12 gap-3 px-5">
        <View
          className="gap-3 rounded-2xl bg-white p-4"
          style={{ elevation: 4, shadowColor: '#111827', shadowOpacity: 0.12, shadowRadius: 12 }}
        >
          <Pressable
            accessibilityLabel={t('Search lodges', 'लॉज शोधा')}
            accessibilityRole="button"
            className="h-[52px] flex-row items-center gap-3 rounded-xl border border-warm-200 bg-warm-50 px-3.5 active:opacity-80"
            onPress={() => openLodges()}
          >
            <MaterialCommunityIcons color={home.primary} name="magnify" size={22} />
            <Text className="flex-1 text-[14px] font-medium text-warm-500" numberOfLines={1}>
              {t('Search lodges, Bhakt Niwas or area', 'लॉज, भक्त निवास किंवा परिसर शोधा')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            className="h-[52px] items-center justify-center rounded-xl active:opacity-90"
            onPress={() => openLodges()}
            style={{ backgroundColor: home.primary }}
          >
            <Text className="text-[15px] font-extrabold uppercase tracking-wide text-white">
              {t(content.heroCtaEn || 'Search stays', content.heroCtaMr || 'निवास शोधा')}
            </Text>
          </Pressable>
          {startingPrice ? (
            <Text className="text-center text-[12px] font-semibold text-warm-500">
              {t(
                `Verified stays from ${formatRupees(startingPrice)} per night`,
                `${formatRupees(startingPrice)} प्रति रात्रीपासून सत्यापित निवास`,
              )}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="gap-6 px-5">
        {/* Live sync status */}
        {syncError ? (
          <View className="flex-row items-center gap-3 rounded-2xl bg-danger-50 px-4 py-3">
            <MaterialCommunityIcons color="#C0392B" name="cloud-alert-outline" size={18} />
            <Text className="flex-1 text-[13px] font-semibold text-danger-700">
              {t('Live updates are paused', 'लाइव्ह अपडेट थांबले आहेत')}
            </Text>
            <Pressable
              accessibilityRole="button"
              className="py-1 active:opacity-60"
              hitSlop={8}
              onPress={() => void refresh()}
            >
              <Text className="text-[13px] font-extrabold text-danger-700">
                {t('Retry', 'पुन्हा')}
              </Text>
            </Pressable>
          </View>
        ) : isSyncing ? (
          <View className="flex-row items-center gap-2 self-start rounded-full bg-white px-3 py-1.5">
            <MaterialCommunityIcons color={home.primary} name="cloud-sync-outline" size={16} />
            <Text className="text-[12px] font-semibold text-warm-600">
              {t('Updating live availability…', 'लाइव्ह उपलब्धता अपडेट होत आहे…')}
            </Text>
          </View>
        ) : null}

        {/* Categories */}
        {content.showCategories ? (
          <View className="flex-row justify-between">
            {categories.map((category) => (
              <Pressable
                accessibilityRole="button"
                className="w-[22%] items-center gap-2 active:opacity-70"
                key={category.quick}
                onPress={() => openLodges(category.quick)}
              >
                <View
                  className="h-14 w-14 items-center justify-center rounded-2xl bg-white"
                  style={{ borderColor: home.line, borderWidth: 1 }}
                >
                  <MaterialCommunityIcons color={home.primary} name={category.icon} size={26} />
                </View>
                <Text className="text-center text-[12px] font-bold text-warm-700" numberOfLines={1}>
                  {t(category.label, category.labelMr)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Promotions */}
        {publicSettings.promotionalBanners.length > 0 ? (
          <BannerCarousel banners={publicSettings.promotionalBanners} lodges={lodges} />
        ) : null}

        {/* Upcoming stay */}
        {upcoming ? (
          <View className="gap-3">
            <HomeSectionHeader
              actionLabel={t('Details', 'तपशील')}
              onAction={() =>
                router.push({ pathname: '/(app)/bookings/[id]', params: { id: upcoming.id } })
              }
              title={t('Your upcoming yatra', 'तुमची आगामी यात्रा')}
            />
            <Pressable
              accessibilityRole="button"
              className="gap-3 rounded-2xl border border-warm-200 bg-white p-4 active:opacity-90"
              onPress={() =>
                router.push({ pathname: '/(app)/bookings/[id]', params: { id: upcoming.id } })
              }
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <Text className="text-[17px] font-bold text-warm-900" numberOfLines={1}>
                    {upcoming.lodgeName}
                  </Text>
                  <Text className="mt-0.5 text-[13px] text-warm-500" numberOfLines={1}>
                    {upcoming.roomName}
                  </Text>
                </View>
                <StatusBadge status={upcoming.status} />
              </View>
              <View className="flex-row items-center gap-2.5 rounded-xl bg-warm-50 px-3 py-2.5">
                <MaterialCommunityIcons color={home.primary} name="calendar-check" size={16} />
                <Text className="text-[13px] font-bold text-warm-800">
                  {upcoming.checkIn} — {upcoming.checkOut}
                </Text>
              </View>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Featured stays */}
      {content.showFeatured ? (
        <View className="gap-3">
          <View className="px-5">
            <HomeSectionHeader
              actionLabel={t('View all', 'सर्व पहा')}
              onAction={() => openLodges()}
              subtitle={t(content.featuredSubtitleEn, content.featuredSubtitleMr)}
              title={t(content.featuredTitleEn, content.featuredTitleMr)}
            />
          </View>
          <ScrollView
            decelerationRate="fast"
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToAlignment="start"
            snapToInterval={STAY_CARD_WIDTH + STAY_CARD_GAP}
            contentContainerStyle={{ paddingHorizontal: 20 }}
          >
            {featuredLodges.map((lodge) =>
              lodge.hydrated === false ? (
                <StayCardSkeleton key={lodge.id} />
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
      ) : null}

      {/* Trust */}
      {content.showTrust ? (
        <View className="mx-5 flex-row rounded-2xl border border-warm-200 bg-white py-4">
          {[
            { icon: 'check-decagram' as const, label: t('Verified lodges', 'सत्यापित लॉज') },
            { icon: 'currency-inr' as const, label: t('Clear pricing', 'स्पष्ट किंमत') },
            { icon: 'headset' as const, label: t('Local support', 'स्थानिक मदत') },
          ].map((item, index) => (
            <View
              className="flex-1 items-center gap-2 px-1"
              key={item.label}
              style={index > 0 ? { borderLeftColor: home.line, borderLeftWidth: 1 } : undefined}
            >
              <MaterialCommunityIcons color={home.primary} name={item.icon} size={24} />
              <Text className="text-center text-[12px] font-bold text-warm-700">{item.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </AppScreen>
  );
}

function StayCardSkeleton() {
  return (
    <View className="mr-3 w-[290px] overflow-hidden rounded-2xl border border-warm-200 bg-white">
      <View className="h-40 bg-warm-100" />
      <View className="gap-2 px-3.5 pb-3.5 pt-3">
        <View className="h-4 w-3/4 rounded-full bg-warm-100" />
        <View className="h-3 w-1/2 rounded-full bg-warm-100" />
      </View>
    </View>
  );
}

function BannerCarousel({
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
              className="overflow-hidden rounded-2xl bg-warm-800"
              disabled={!clickable}
              key={banner.id}
              style={{ height: 170, width: cardWidth }}
              onPress={() => void openBanner(banner)}
            >
              <Image
                resizeMode="cover"
                source={{ uri: banner.imageUrl }}
                style={{ height: '100%', position: 'absolute', width: '100%' }}
              />
              <Gradient
                colors={[
                  ['#000000', 0.05],
                  ['#000000', 0.7],
                ]}
                direction="down"
                style={{ bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }}
              />
              <View className="flex-1 justify-end p-5">
                <View className="self-start rounded-full bg-white/90 px-2.5 py-1">
                  <Text className="text-[11px] font-extrabold" style={{ color: home.primary }}>
                    {banner.category.replace('_', ' ')}
                  </Text>
                </View>
                <Text className="mt-2 text-[21px] font-extrabold leading-7 text-white">
                  {banner.title}
                </Text>
                {banner.subtitle ? (
                  <Text
                    className="mt-0.5 text-[13px] leading-[18px] text-white/90"
                    numberOfLines={2}
                  >
                    {banner.subtitle}
                  </Text>
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
              key={banner.id}
              style={{
                backgroundColor: index === activeIndex ? home.primary : '#E8DED2',
                borderRadius: 4,
                height: 6,
                width: index === activeIndex ? 20 : 6,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
