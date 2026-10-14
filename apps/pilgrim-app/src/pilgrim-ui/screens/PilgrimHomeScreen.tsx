import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { PromotionalBanner } from '@tuljai/types';
import { useRouter } from 'expo-router';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
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
import { AppScreen, StatusBadge, type PilgrimIconName } from '../components';
import { Gradient, GradientButton, home, HomeSectionHeader, IconChip } from '../home/HomeKit';
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
const STAY_CARD_WIDTH = 248;
const STAY_CARD_GAP = 14;

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
    <AppScreen className="gap-6 pt-3">
      {/* Header */}
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-1 pr-3">
          <Text className="text-[13px] font-semibold text-warm-500">
            {t('Namaskar', 'नमस्कार')}
            {firstName ? `, ${firstName}` : ''} 🙏
          </Text>
          <Text className="mt-0.5 text-[24px] font-extrabold tracking-tight text-warm-900">
            {t('Find your stay', 'तुमचा निवास शोधा')}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Open notifications"
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center rounded-full bg-white active:opacity-70"
          onPress={() => router.push('/(app)/notifications')}
          style={{ borderColor: home.line, borderWidth: 1 }}
        >
          <MaterialCommunityIcons color={home.ink} name="bell-outline" size={20} />
          {unreadCount > 0 ? (
            <View
              className="absolute -right-0.5 -top-0.5 h-[18px] min-w-[18px] items-center justify-center rounded-full px-1"
              style={{ backgroundColor: home.primary, borderColor: '#FAF7F2', borderWidth: 2 }}
            >
              <Text className="text-[10px] font-extrabold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Search */}
      <Pressable
        accessibilityLabel={t('Search lodges', 'लॉज शोधा')}
        accessibilityRole="button"
        className="h-[52px] flex-row items-center gap-3 rounded-full bg-white pl-4 pr-2 active:opacity-90"
        onPress={() => openLodges()}
        style={{ borderColor: home.line, borderWidth: 1 }}
      >
        <MaterialCommunityIcons color={home.primary} name="magnify" size={20} />
        <Text className="flex-1 text-[14px] font-medium text-warm-500" numberOfLines={1}>
          {t('Search lodges, Bhakt Niwas or area', 'लॉज, भक्त निवास किंवा परिसर शोधा')}
        </Text>
        <Gradient
          colors={home.sunriseSoft}
          style={{
            alignItems: 'center',
            borderRadius: 18,
            height: 36,
            justifyContent: 'center',
            width: 36,
          }}
        >
          <MaterialCommunityIcons color="#FFFFFF" name="tune-variant" size={16} />
        </Gradient>
      </Pressable>

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

      {/* Hero / promotions */}
      {publicSettings.promotionalBanners.length > 0 ? (
        <BannerCarousel banners={publicSettings.promotionalBanners} lodges={lodges} />
      ) : (
        <Gradient
          colors={content.heroColors}
          style={{ borderRadius: 28, elevation: 4, padding: 22 }}
        >
          <View
            pointerEvents="none"
            style={{
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderRadius: 90,
              height: 180,
              position: 'absolute',
              right: -50,
              top: -60,
              width: 180,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderRadius: 60,
              bottom: -40,
              height: 120,
              position: 'absolute',
              right: 60,
              width: 120,
            }}
          />
          <View className="flex-row items-center gap-1.5 self-start rounded-full bg-white/20 px-3 py-1.5">
            <MaterialCommunityIcons color="#FFFFFF" name="map-marker" size={13} />
            <Text className="text-[12px] font-bold text-white">
              {t('Tulja Bhavani Temple, Tuljapur', 'तुळजाभवानी मंदिर, तुळजापूर')}
            </Text>
          </View>
          <Text className="mt-4 text-[24px] font-extrabold leading-[30px] text-white">
            {t(content.heroTitleEn, content.heroTitleMr)}
          </Text>
          <Text className="mb-5 mt-2 text-[14px] leading-5 text-white/90">
            {t(content.heroSubtitleEn, content.heroSubtitleMr) ||
              (startingPrice
                ? t(
                    `Verified stays from ${formatRupees(startingPrice)} per night.`,
                    `${formatRupees(startingPrice)} प्रति रात्रीपासून सत्यापित निवास.`,
                  )
                : t('Verified stays close to the temple.', 'मंदिराजवळ सत्यापित निवास.'))}
          </Text>
          <GradientButton
            icon="arrow-right"
            label={t(content.heroCtaEn, content.heroCtaMr)}
            onPress={() => openLodges()}
            tone="light"
          />
        </Gradient>
      )}

      {/* Categories */}
      {content.showCategories ? (
        <View className="gap-3">
          <HomeSectionHeader title={t('Browse by need', 'गरजेनुसार निवडा')} />
          <View className="flex-row gap-3">
            {categories.map((category) => (
              <Pressable
                accessibilityRole="button"
                className="flex-1 items-center gap-2 rounded-[20px] bg-white py-3.5 active:opacity-80"
                key={category.quick}
                onPress={() => openLodges(category.quick)}
                style={{ borderColor: home.line, borderWidth: 1 }}
              >
                <IconChip icon={category.icon} />
                <Text className="text-[12px] font-bold text-warm-700" numberOfLines={1}>
                  {t(category.label, category.labelMr)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
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
            className="flex-row overflow-hidden rounded-[22px] bg-white active:opacity-90"
            onPress={() =>
              router.push({ pathname: '/(app)/bookings/[id]', params: { id: upcoming.id } })
            }
            style={{ borderColor: home.line, borderWidth: 1 }}
          >
            <Gradient colors={home.sunrise} direction="down" style={{ width: 5 }} />
            <View className="flex-1 gap-3 p-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <Text className="text-[17px] font-extrabold text-warm-900" numberOfLines={1}>
                    {upcoming.lodgeName}
                  </Text>
                  <Text className="mt-0.5 text-[13px] text-warm-500" numberOfLines={1}>
                    {upcoming.roomName}
                  </Text>
                </View>
                <StatusBadge status={upcoming.status} />
              </View>
              <View className="flex-row items-center gap-2.5 rounded-2xl bg-warm-50 px-3 py-2.5">
                <MaterialCommunityIcons color={home.primary} name="calendar-check" size={16} />
                <Text className="text-[13px] font-bold text-warm-800">
                  {upcoming.checkIn} — {upcoming.checkOut}
                </Text>
              </View>
            </View>
          </Pressable>
        </View>
      ) : null}

      {/* Featured stays */}
      {content.showFeatured ? (
        <View className="gap-3">
          <HomeSectionHeader
            actionLabel={t('View all', 'सर्व पहा')}
            onAction={() => openLodges()}
            subtitle={t(content.featuredSubtitleEn, content.featuredSubtitleMr)}
            title={t(content.featuredTitleEn, content.featuredTitleMr)}
          />
          <ScrollView
            decelerationRate="fast"
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToAlignment="start"
            snapToInterval={STAY_CARD_WIDTH + STAY_CARD_GAP}
            style={{ marginHorizontal: -20 }}
            contentContainerStyle={{ paddingHorizontal: 20 }}
          >
            {featuredLodges.map((lodge) =>
              lodge.hydrated === false ? (
                <StayCardSkeleton key={lodge.id} />
              ) : (
                <StayCard
                  favorite={favoriteIds.includes(lodge.id)}
                  key={lodge.id}
                  lodge={lodge}
                  nightLabel={t('/ night', '/ रात्र')}
                  newLabel={t('New', 'नवीन')}
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
        <View
          className="flex-row rounded-[22px] bg-white py-4"
          style={{ borderColor: home.line, borderWidth: 1 }}
        >
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
              <IconChip icon={item.icon} />
              <Text className="text-center text-[12px] font-bold text-warm-700">{item.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </AppScreen>
  );
}

const StayCard = memo(function StayCard({
  favorite,
  lodge,
  newLabel,
  nightLabel,
  onFavorite,
  onPress,
}: {
  favorite: boolean;
  lodge: PilgrimLodge;
  newLabel: string;
  nightLabel: string;
  onFavorite: () => void;
  onPress: () => void;
}) {
  return (
    <View
      className="overflow-hidden rounded-[24px] bg-white"
      style={{
        borderColor: home.line,
        borderWidth: 1,
        marginRight: STAY_CARD_GAP,
        width: STAY_CARD_WIDTH,
      }}
    >
      <Pressable accessibilityRole="button" className="active:opacity-90" onPress={onPress}>
        <View className="h-36 bg-warm-100">
          <Image
            fadeDuration={150}
            resizeMode="cover"
            source={{ uri: lodge.hero }}
            style={{ height: '100%', width: '100%' }}
          />
          <Gradient
            colors={[
              ['#000000', 0],
              ['#000000', 0.35],
            ]}
            direction="down"
            style={{ bottom: 0, height: 56, left: 0, position: 'absolute', right: 0 }}
          />
          <Gradient
            colors={home.sunriseSoft}
            direction="right"
            style={{ borderRadius: 999, bottom: 10, left: 10, position: 'absolute' }}
          >
            <View className="flex-row items-end px-3 py-1.5">
              <Text className="text-[14px] font-extrabold text-white">
                {formatRupees(lodge.price)}
              </Text>
              <Text className="mb-px ml-1 text-[11px] font-semibold text-white/90">
                {nightLabel}
              </Text>
            </View>
          </Gradient>
        </View>
        <View className="gap-1 px-3.5 pb-3.5 pt-3">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-[15px] font-extrabold text-warm-900" numberOfLines={1}>
              {lodge.name}
            </Text>
            <View className="flex-row items-center gap-1">
              <MaterialCommunityIcons color="#F5A623" name="star" size={13} />
              <Text className="text-[12px] font-bold text-warm-700">
                {lodge.rating > 0 ? lodge.rating.toFixed(1) : newLabel}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-1">
            <MaterialCommunityIcons color={home.muted} name="map-marker-outline" size={14} />
            <Text className="flex-1 text-[12px] text-warm-500" numberOfLines={1}>
              {lodge.distance}
            </Text>
          </View>
        </View>
      </Pressable>
      <Pressable
        accessibilityLabel={favorite ? 'Remove from favourites' : 'Add to favourites'}
        accessibilityRole="button"
        className="absolute right-2.5 top-2.5 h-8 w-8 items-center justify-center rounded-full bg-white/95 active:opacity-70"
        hitSlop={6}
        onPress={onFavorite}
      >
        <MaterialCommunityIcons
          color={favorite ? '#E5383B' : home.ink}
          name={favorite ? 'heart' : 'heart-outline'}
          size={17}
        />
      </Pressable>
    </View>
  );
});

function StayCardSkeleton() {
  return (
    <View
      className="overflow-hidden rounded-[24px] bg-white"
      style={{
        borderColor: home.line,
        borderWidth: 1,
        marginRight: STAY_CARD_GAP,
        width: STAY_CARD_WIDTH,
      }}
    >
      <View className="h-36 bg-warm-100" />
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
              className="overflow-hidden rounded-[28px] bg-warm-800"
              disabled={!clickable}
              key={banner.id}
              style={{ height: 200, width: cardWidth }}
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
