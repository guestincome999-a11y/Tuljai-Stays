import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { canViewBookingQr } from '../booking-pass-policy';
import {
  AppScreen,
  EmptyState,
  LoadingList,
  PrimaryButton,
  PaymentStatusBadge,
  SecondaryButton,
  StatusBadge,
  StayImage,
  ui,
} from '../components';
import { formatRupees } from '../mock-data';
import { usePilgrimApp } from '../PilgrimAppProvider';

export function PilgrimBookingsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { bookings, isSyncing, refresh, syncError, t } = usePilgrimApp();
  const [tab, setTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const tabs = [
    { id: 'upcoming' as const, label: t('Upcoming', 'आगामी') },
    { id: 'completed' as const, label: t('Completed', 'पूर्ण') },
    { id: 'cancelled' as const, label: t('Cancelled', 'रद्द') },
  ];
  const visible = bookings
    .filter((booking) =>
      tab === 'upcoming'
        ? ['confirmed', 'checked-in', 'pending'].includes(booking.status)
        : booking.status === tab,
    )
    .sort((left, right) =>
      tab === 'upcoming'
        ? left.checkInDate.localeCompare(right.checkInDate)
        : right.checkInDate.localeCompare(left.checkInDate),
    );
  return (
    <AppScreen className="gap-5 pt-3" refreshing={isSyncing} onRefresh={() => void refresh()}>
      <View className="gap-2">
        <Text className="text-xs font-bold uppercase tracking-widest text-maroon-700">
          {t('Your yatra, organised', 'तुमच्या यात्रेचे नियोजन')}
        </Text>
        <Text className="text-3xl font-bold tracking-tight text-warm-900">
          {t('My Bookings', 'माझी बुकिंग')}
        </Text>
        <Text className="text-sm text-warm-600">
          {t(
            'Your stays, confirmations and check-in QR, together.',
            'निवास, पुष्टीकरण आणि चेक-इन QR एकाच ठिकाणी.',
          )}
        </Text>
      </View>
      <View accessibilityRole="tablist" className="flex-row rounded-2xl bg-warm-100 p-1">
        {tabs.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item.id }}
            className={`min-h-12 flex-1 items-center justify-center rounded-xl px-1 ${tab === item.id ? 'bg-maroon-700' : ''}`}
            onPress={() => setTab(item.id)}
          >
            <Text
              className={`text-sm font-bold ${tab === item.id ? 'text-white' : 'text-warm-600'}`}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {syncError ? (
        <View className="gap-3 rounded-2xl bg-danger-50 p-4">
          <Text accessibilityRole="alert" className="text-sm text-danger-700">
            {t(
              'Bookings could not be refreshed. Saved records may have changed.',
              'बुकिंग अपडेट करता आली नाहीत. जतन केलेली स्थिती बदललेली असू शकते.',
            )}
          </Text>
          <SecondaryButton icon="refresh" onPress={() => void refresh()}>
            {t('Retry', 'पुन्हा प्रयत्न करा')}
          </SecondaryButton>
        </View>
      ) : null}
      {visible.map((booking) => (
        <View
          key={booking.id}
          className="overflow-hidden rounded-3xl border border-warm-200 bg-white shadow-sm shadow-warm-900/5"
        >
          <View className="flex-row gap-3 p-4">
            <StayImage
              className="h-24 w-24 rounded-2xl"
              uri={booking.image}
              label={booking.lodgeName}
            />
            <View className="min-w-0 flex-1 gap-1.5">
              <Text className="text-lg font-bold text-warm-900" numberOfLines={2}>
                {booking.lodgeName}
              </Text>
              <Text className="text-sm text-warm-600" numberOfLines={2}>
                {booking.roomName}
              </Text>
              <StatusBadge status={booking.status} />
            </View>
          </View>
          <View className="gap-3 px-4 pb-4">
            <View className="flex-row rounded-2xl bg-warm-50 p-3">
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-xs text-warm-600">{t('CHECK-IN', 'चेक-इन')}</Text>
                <Text className="text-sm font-bold text-warm-900">{booking.checkIn}</Text>
              </View>
              <MaterialCommunityIcons color={ui.bell} name="arrow-right" size={20} />
              <View className="min-w-0 flex-1 gap-1 pl-3">
                <Text className="text-xs text-warm-600">{t('CHECK-OUT', 'चेक-आउट')}</Text>
                <Text className="text-sm font-bold text-warm-900">
                  {booking.checkoutDateFlexible ? t('Not fixed', 'निश्चित नाही') : booking.checkOut}
                </Text>
              </View>
            </View>
            <View className="flex-row flex-wrap justify-between gap-2">
              <Text selectable className="text-xs font-bold text-warm-600">
                {booking.bookingCode}
              </Text>
              <PaymentStatusBadge status={booking.paymentStatus} />
            </View>
            <View className="flex-row flex-wrap items-center justify-between gap-2 border-t border-warm-100 pt-3">
              <Text className="text-xs text-warm-600">{t('Booking total', 'बुकिंग एकूण')}</Text>
              <Text className="text-xl font-bold text-maroon-700">
                {formatRupees(booking.amount)}
              </Text>
            </View>
            {booking.paidAmount !== undefined ? (
              <Text className="text-sm text-templeGreen-700">
                {t('Amount paid', 'भरलेली रक्कम')}: {formatRupees(booking.paidAmount)}
              </Text>
            ) : null}
            <View className={`${width < 380 ? 'flex-col' : 'flex-row'} gap-2`}>
              <SecondaryButton
                className={width < 380 ? '' : 'flex-1'}
                icon="book-open-outline"
                onPress={() =>
                  router.push({ pathname: '/(app)/bookings/[id]', params: { id: booking.id } })
                }
              >
                {t('View Details', 'तपशील पहा')}
              </SecondaryButton>
              {canViewBookingQr(booking) ? (
                <PrimaryButton
                  className={width < 380 ? '' : 'flex-1'}
                  icon="qrcode"
                  onPress={() =>
                    router.push({ pathname: '/(app)/pass', params: { bookingId: booking.id } })
                  }
                >
                  {t('View Booking QR', 'बुकिंग QR पहा')}
                </PrimaryButton>
              ) : null}
            </View>
          </View>
        </View>
      ))}
      {visible.length === 0 ? (
        isSyncing ? (
          <LoadingList label={t('Loading bookings', 'बुकिंग लोड होत आहेत')} />
        ) : (
          <EmptyState
            action={t('Find a stay', 'निवास शोधा')}
            title={t('No bookings here yet', 'येथे अद्याप बुकिंग नाही')}
            body={t(
              'Your stays will appear in the right tab as their status changes.',
              'स्थिती बदलल्यावर तुमचे निवास योग्य विभागात दिसतील.',
            )}
            icon="calendar-blank-outline"
            onAction={() => router.push('/(app)/lodges')}
          />
        )
      ) : null}
      {tab === 'upcoming' ? (
        <SecondaryButton icon="magnify" onPress={() => router.push('/(app)/lodges')}>
          {t('Book another stay', 'दुसरा निवास बुक करा')}
        </SecondaryButton>
      ) : null}
    </AppScreen>
  );
}
