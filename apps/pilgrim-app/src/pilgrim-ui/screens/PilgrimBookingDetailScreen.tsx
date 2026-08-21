import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Image, Linking, Pressable, Text, View } from 'react-native';

import { usePublicSettings } from '../../settings/usePublicSettings';
import {
  AppScreen,
  EmptyState,
  InfoRow,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  TopBar,
  ui,
} from '../components';
import { formatRupees } from '../mock-data';
import { usePilgrimApp } from '../PilgrimAppProvider';

export function PilgrimBookingDetailScreen() {
  const params = useLocalSearchParams<{ id?: string; justBooked?: string }>();
  const router = useRouter();
  const { bookings, cancelBooking, isSyncing, lodges, t } = usePilgrimApp();
  const { supportEmail, supportPhone } = usePublicSettings();
  const booking = bookings.find((item) => item.id === params.id);
  const lodge = booking ? lodges.find((item) => item.id === booking.lodgeId) : undefined;

  if (!booking) {
    return (
      <AppScreen className="gap-6 pt-1">
        <TopBar onBack={() => router.back()} title={t('Booking details', 'बुकिंग तपशील')} />
        {isSyncing ? (
          <View className="items-center rounded-3xl border border-warm-100 bg-white py-16">
            <ActivityIndicator color={ui.saffronDeep} size="large" />
            <Text className="mt-4 text-sm font-bold text-warm-500">
              {t('Loading your booking…', 'तुमचे बुकिंग लोड होत आहे…')}
            </Text>
          </View>
        ) : (
          <EmptyState
            action={t('Back to my bookings', 'माझ्या बुकिंगवर परत जा')}
            body={t(
              'This booking is unavailable or belongs to another account.',
              'हे बुकिंग उपलब्ध नाही किंवा दुसऱ्या खात्याचे आहे.',
            )}
            icon="calendar-remove-outline"
            onAction={() => router.replace('/(app)/bookings')}
            title={t('Booking not found', 'बुकिंग सापडले नाही')}
          />
        )}
      </AppScreen>
    );
  }

  const bookingId = booking.id;

  function askToCancel() {
    Alert.alert(
      t('Cancel this booking?', 'हे बुकिंग रद्द करायचे?'),
      t(
        'Your room will be released. Refund eligibility depends on the stay policy.',
        'तुमची खोली सोडली जाईल. परतावा निवास धोरणानुसार असेल.',
      ),
      [
        { style: 'cancel', text: t('Keep booking', 'बुकिंग ठेवा') },
        {
          style: 'destructive',
          text: t('Yes, cancel', 'हो, रद्द करा'),
          onPress: () => {
            void cancelBooking(bookingId, 'Cancelled by pilgrim from mobile app').catch(() => {
              Alert.alert(
                t('Could not cancel booking', 'बुकिंग रद्द करता आली नाही'),
                t(
                  'Please try again or contact Tuljai support.',
                  'कृपया पुन्हा प्रयत्न करा किंवा तुळजाई सहाय्याशी संपर्क साधा.',
                ),
              );
            });
          },
        },
      ],
    );
  }

  return (
    <AppScreen className="gap-6 pt-1">
      <TopBar
        onBack={() => router.back()}
        right={
          <Pressable
            className="h-12 w-12 items-center justify-center rounded-2xl bg-warm-100"
            onPress={() =>
              void openExternalLink(
                `https://wa.me/?text=${encodeURIComponent(`Tuljai Stays booking ${booking.bookingCode}`)}`,
                t,
              )
            }
          >
            <MaterialCommunityIcons color={ui.ink} name="share-variant-outline" size={22} />
          </Pressable>
        }
        subtitle={booking.bookingCode}
        title={t('Booking details', 'बुकिंग तपशील')}
      />

      {params.justBooked === '1' ? (
        <View className="items-center rounded-3xl bg-templeGreen-50 px-5 py-6">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-templeGreen-500">
            <MaterialCommunityIcons color="#FFFFFF" name="check" size={35} />
          </View>
          <Text className="mt-4 text-center text-2xl font-extrabold text-templeGreen-700">
            {t('Your stay is booked!', 'तुमचा निवास बुक झाला!')}
          </Text>
          <Text className="mt-2 text-center text-sm leading-5 text-warm-600">
            {t(
              'A confirmation has been sent to your mobile number.',
              'तुमच्या मोबाइल क्रमांकावर पुष्टीकरण पाठवले आहे.',
            )}
          </Text>
        </View>
      ) : null}

      <View className="overflow-hidden rounded-3xl border border-warm-100 bg-white">
        <Image className="h-44 w-full" resizeMode="cover" source={{ uri: booking.image }} />
        <View className="gap-4 p-4">
          <StatusBadge status={booking.status} />
          <View>
            <Text className="text-xl font-extrabold text-warm-900">{booking.lodgeName}</Text>
            <Text className="mt-1 text-sm text-warm-500">
              {lodge?.location ?? t('Tuljapur', 'तुळजापूर')}
            </Text>
          </View>
          {lodge ? (
            <Pressable
              className="min-h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-warm-100"
              onPress={() =>
                router.push({ pathname: '/(app)/lodges/[id]', params: { id: lodge.id } })
              }
            >
              <MaterialCommunityIcons color={ui.maroon} name="home-search-outline" size={20} />
              <Text className="text-sm font-extrabold text-maroon-700">
                {t('View lodge', 'लॉज पहा')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {booking.status === 'pending' ? (
        <View className="flex-row items-start gap-3 rounded-2xl bg-bell-50 p-4">
          <MaterialCommunityIcons color="#884E13" name="clock-outline" size={22} />
          <Text className="flex-1 text-sm leading-5 text-warm-600">
            {t(
              'The lodge is reviewing your request. We will notify you as soon as it is accepted.',
              'लॉज तुमच्या विनंतीचे पुनरावलोकन करत आहे. स्वीकारल्यावर आम्ही लगेच कळवू.',
            )}
          </Text>
        </View>
      ) : null}

      {booking.status === 'checked-in' ? (
        <View className="flex-row items-start gap-3 rounded-2xl bg-templeGreen-50 p-4">
          <MaterialCommunityIcons color={ui.green} name="account-check" size={22} />
          <Text className="flex-1 text-sm leading-5 text-warm-600">
            {t(
              'Check-in is completed. No further check-in action is required.',
              'चेक-इन पूर्ण झाले आहे. आता पुढील चेक-इन कृतीची गरज नाही.',
            )}
          </Text>
        </View>
      ) : null}

      <View>
        <Text className="mb-3 text-xl font-extrabold text-warm-900">
          {t('Stay information', 'निवास माहिती')}
        </Text>
        <View className="rounded-3xl border border-warm-100 bg-white px-4">
          <InfoRow
            icon="calendar-arrow-right"
            label={t('Check-in', 'चेक-इन')}
            value={`${booking.checkIn} · after 12:00 PM`}
          />
          <InfoRow
            icon="calendar-arrow-left"
            label={t('Check-out', 'चेक-आउट')}
            value={
              booking.checkoutDateFlexible
                ? t('Not fixed · confirm with lodge', 'निश्चित नाही · लॉजसोबत ठरवा')
                : `${booking.checkOut} · before 10:00 AM`
            }
          />
          <InfoRow icon="bed-king-outline" label={t('Room', 'खोली')} value={booking.roomName} />
          <InfoRow
            icon="account-group-outline"
            label={t('Guests', 'पाहुणे')}
            value={booking.guests}
            last
          />
        </View>
      </View>

      <View>
        <Text className="mb-3 text-xl font-extrabold text-warm-900">
          {t('Booking journey', 'बुकिंग प्रवास')}
        </Text>
        <View className="rounded-3xl border border-warm-100 bg-white p-5">
          <TimelineItem
            active
            icon="check"
            label={t('Booking created', 'बुकिंग तयार')}
            subtitle={formatBookingTimestamp(booking.createdAt)}
          />
          <TimelineItem
            active={booking.status !== 'pending'}
            icon="home-heart"
            label={t('Confirmed by lodge', 'लॉजने पुष्टी केली')}
            subtitle={
              booking.status === 'pending'
                ? t('Waiting for response', 'प्रतिसादाची प्रतीक्षा')
                : formatBookingTimestamp(booking.updatedAt)
            }
          />
          <TimelineItem
            active={booking.status === 'checked-in'}
            icon="qrcode-scan"
            label={
              booking.status === 'checked-in'
                ? t('Checked in at lodge', 'लॉजवर चेक-इन पूर्ण')
                : t('Check-in at lodge', 'लॉजवर चेक-इन')
            }
            subtitle={booking.status === 'checked-in' ? t('Completed', 'पूर्ण') : booking.checkIn}
            last
          />
        </View>
      </View>

      <View className="rounded-3xl border border-warm-100 bg-white p-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-extrabold text-warm-900">
            {t('Payment summary', 'पेमेंट सारांश')}
          </Text>
          <Text className="text-sm font-extrabold text-templeGreen-700">
            {booking.paymentStatus}
          </Text>
        </View>
        <View className="mt-4 flex-row items-end justify-between border-t border-warm-100 pt-4">
          <Text className="text-sm text-warm-500">{t('Total paid', 'एकूण भरले')}</Text>
          <Text className="text-2xl font-extrabold text-maroon-700">
            {formatRupees(booking.amount)}
          </Text>
        </View>
      </View>

      <View className="gap-3">
        <View className="flex-row gap-3">
          {lodge?.primaryPhone ? (
            <SecondaryButton
              className="flex-1"
              icon="phone-outline"
              onPress={() => void openExternalLink(`tel:${lodge.primaryPhone}`, t)}
            >
              {t('Call lodge', 'लॉजला कॉल')}
            </SecondaryButton>
          ) : null}
          <SecondaryButton
            className="flex-1"
            icon="map-marker-outline"
            onPress={() => void openDirections(lodge?.name ?? booking.lodgeName, t)}
          >
            {t('Directions', 'दिशा')}
          </SecondaryButton>
        </View>
        {supportPhone || supportEmail ? (
          <SecondaryButton
            icon="headset"
            onPress={() =>
              void openExternalLink(
                supportPhone ? `tel:${supportPhone}` : `mailto:${supportEmail}`,
                t,
              )
            }
          >
            {t('Get Tuljai support', 'तुळजाई सहाय्य मिळवा')}
          </SecondaryButton>
        ) : null}
        {booking.status === 'confirmed' || booking.status === 'pending' ? (
          <SecondaryButton destructive icon="calendar-remove-outline" onPress={askToCancel}>
            {t('Cancel booking', 'बुकिंग रद्द करा')}
          </SecondaryButton>
        ) : null}
      </View>
      <PrimaryButton onPress={() => router.push('/(app)/lodges')}>
        {t('Explore more stays', 'आणखी निवास पहा')}
      </PrimaryButton>
    </AppScreen>
  );
}

function TimelineItem({
  active,
  icon,
  label,
  subtitle,
  last = false,
}: {
  active: boolean;
  icon: 'check' | 'home-heart' | 'qrcode-scan';
  label: string;
  last?: boolean;
  subtitle: string;
}) {
  return (
    <View className="flex-row gap-3">
      <View className="items-center">
        <View
          className={`h-10 w-10 items-center justify-center rounded-full ${active ? 'bg-templeGreen-500' : 'bg-warm-200'}`}
        >
          <MaterialCommunityIcons color={active ? '#FFFFFF' : ui.muted} name={icon} size={19} />
        </View>
        {!last ? (
          <View
            className={`min-h-9 w-0.5 flex-1 ${active ? 'bg-templeGreen-100' : 'bg-warm-200'}`}
          />
        ) : null}
      </View>
      <View className={`${last ? 'pb-0' : 'pb-6'} pt-1`}>
        <Text className={`text-sm font-extrabold ${active ? 'text-warm-900' : 'text-warm-500'}`}>
          {label}
        </Text>
        <Text className="mt-1 text-xs text-warm-500">{subtitle}</Text>
      </View>
    </View>
  );
}

async function openDirections(
  name: string,
  t: (english: string, marathi: string) => string,
): Promise<void> {
  await openExternalLink(
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, Tuljapur`)}`,
    t,
  );
}

function formatBookingTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

async function openExternalLink(
  url: string,
  t: (english: string, marathi: string) => string,
): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(
      t('Could not open this action', 'ही क्रिया उघडता आली नाही'),
      t('Please try again from your phone.', 'कृपया तुमच्या फोनवरून पुन्हा प्रयत्न करा.'),
    );
  }
}
