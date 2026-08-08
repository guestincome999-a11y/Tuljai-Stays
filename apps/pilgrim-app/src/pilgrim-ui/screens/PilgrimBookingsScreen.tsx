import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { AppScreen, EmptyState, LoadingList, PrimaryButton, StatusBadge, ui } from '../components';
import { formatRupees, type PilgrimBooking } from '../mock-data';
import { usePilgrimApp } from '../PilgrimAppProvider';

export function PilgrimBookingsScreen() {
  const router = useRouter();
  const { bookings, isSyncing, refresh, syncError, t } = usePilgrimApp();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const visible = bookings
    .filter((booking) =>
      tab === 'upcoming'
        ? ['confirmed', 'checked-in', 'pending'].includes(booking.status)
        : booking.status === 'completed' || booking.status === 'cancelled',
    )
    .sort((left, right) => {
      const difference = left.checkInDate.localeCompare(right.checkInDate);
      return tab === 'upcoming' ? difference : -difference;
    });

  return (
    <AppScreen className="gap-5 pt-2">
      <View>
        <Text className="text-2xl font-extrabold tracking-tight text-warm-900">
          {t('My bookings', 'माझी बुकिंग')}
        </Text>
        <Text className="mt-1 text-sm text-warm-500">
          {t('Everything for your Tuljapur yatra', 'तुमच्या तुळजापूर यात्रेची सर्व माहिती')}
        </Text>
      </View>

      <View className="flex-row rounded-2xl bg-warm-100 p-1">
        {(['upcoming', 'past'] as const).map((item) => (
          <Pressable
            className={`min-h-12 flex-1 items-center justify-center rounded-xl ${tab === item ? 'bg-white shadow-sm shadow-warm-900/10' : ''}`}
            key={item}
            onPress={() => setTab(item)}
          >
            <Text
              className={`text-sm font-extrabold ${tab === item ? 'text-maroon-700' : 'text-warm-500'}`}
            >
              {item === 'upcoming' ? t('Upcoming', 'आगामी') : t('Past stays', 'मागील निवास')}
            </Text>
          </Pressable>
        ))}
      </View>

      {syncError ? (
        <View className="flex-row items-center gap-3 rounded-2xl bg-danger-50 p-4">
          <MaterialCommunityIcons color={ui.danger} name="cloud-alert-outline" size={22} />
          <Text className="flex-1 text-sm font-semibold text-danger-700">
            {t('Bookings could not be refreshed.', 'बुकिंग अपडेट करता आली नाहीत.')}
          </Text>
          <Pressable className="min-h-11 justify-center" onPress={() => void refresh()}>
            <Text className="text-sm font-extrabold text-danger-700">{t('Retry', 'पुन्हा')}</Text>
          </Pressable>
        </View>
      ) : null}

      <View className="gap-3">
        {visible.map((booking) => (
          <BookingCard
            booking={booking}
            checkoutFlexibleLabel={t('Checkout not fixed', 'चेक-आउट निश्चित नाही')}
            key={booking.id}
            onPress={() =>
              router.push({ pathname: '/(app)/bookings/[id]', params: { id: booking.id } })
            }
          />
        ))}
      </View>

      {visible.length === 0 && isSyncing ? (
        <LoadingList label={t('Loading bookings', 'बुकिंग लोड होत आहेत')} />
      ) : visible.length === 0 ? (
        <EmptyState
          action={t('Find a stay', 'निवास शोधा')}
          body={
            tab === 'upcoming'
              ? t(
                  'Your next Tuljapur stay will appear here.',
                  'तुमचा पुढील तुळजापूर निवास येथे दिसेल.',
                )
              : t('You have no past stays yet.', 'अद्याप मागील निवास नाहीत.')
          }
          icon="calendar-blank-outline"
          onAction={() => router.push('/(app)/lodges')}
          title={
            tab === 'upcoming'
              ? t('No upcoming bookings', 'आगामी बुकिंग नाही')
              : t('No past stays', 'मागील निवास नाही')
          }
        />
      ) : null}

      {tab === 'upcoming' ? (
        <PrimaryButton icon="magnify" onPress={() => router.push('/(app)/lodges')}>
          {t('Book another stay', 'दुसरा निवास बुक करा')}
        </PrimaryButton>
      ) : null}
    </AppScreen>
  );
}

function BookingCard({
  booking,
  checkoutFlexibleLabel,
  onPress,
}: {
  booking: PilgrimBooking;
  checkoutFlexibleLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="min-h-[132px] flex-row overflow-hidden rounded-2xl border border-warm-100 bg-white shadow-sm shadow-warm-900/10"
      onPress={onPress}
    >
      <Image
        className="w-[112px] self-stretch"
        resizeMode="cover"
        source={{ uri: booking.image }}
      />
      <View className="min-w-0 flex-1 justify-between p-3.5">
        <View className="flex-row items-start justify-between gap-2">
          <Text className="min-w-0 flex-1 text-base font-extrabold text-warm-900" numberOfLines={2}>
            {booking.lodgeName}
          </Text>
          <MaterialCommunityIcons color={ui.muted} name="chevron-right" size={22} />
        </View>
        <Text className="mt-1 text-xs font-semibold text-warm-500" numberOfLines={1}>
          {booking.roomName}
        </Text>
        <View className="mt-2 flex-row items-center gap-1.5">
          <MaterialCommunityIcons color={ui.maroon} name="calendar-range" size={17} />
          <Text className="flex-1 text-xs font-bold text-warm-700" numberOfLines={1}>
            {booking.checkIn} —{' '}
            {booking.checkoutDateFlexible ? checkoutFlexibleLabel : booking.checkOut}
          </Text>
        </View>
        <View className="mt-3 flex-row items-center justify-between gap-2">
          <StatusBadge status={booking.status} />
          <Text className="text-base font-extrabold text-maroon-700">
            {formatRupees(booking.amount)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
