import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { QrDisplayPayload } from '@tuljai/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { useAuth } from '../../auth/auth-context';
import { getBookingQrMetadata } from '../../features/bookings/api/booking-qr-api';
import { selectCurrentPassBooking } from '../booking-selection';
import { AppScreen, EmptyState, InfoRow, ui } from '../components';
import { usePilgrimApp } from '../PilgrimAppProvider';

export function PilgrimPassScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { bookings, isSyncing, refresh, t } = usePilgrimApp();
  const booking = selectCurrentPassBooking(bookings);
  const [payload, setPayload] = useState<QrDisplayPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadPass = useCallback(async () => {
    setPayload(null);
    setError(false);

    if (!booking || booking.status !== 'confirmed' || !booking.qrReady) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setPayload(await getBookingQrMetadata(booking.id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [booking]);

  useEffect(() => {
    void loadPass();
  }, [loadPass]);

  async function refreshPass() {
    await refresh();
    await loadPass();
  }

  return (
    <AppScreen className="gap-5 pt-2">
      <View>
        <View className="flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-maroon-700">
            <MaterialCommunityIcons color="#FFFFFF" name="qrcode-scan" size={26} />
          </View>
          <View className="flex-1">
            <Text className="text-2xl font-extrabold tracking-tight text-warm-900">
              {t('My stay pass', 'माझा निवास पास')}
            </Text>
            <Text className="mt-0.5 text-sm text-warm-500">
              {t('Show this at check-in', 'चेक-इनच्या वेळी हा पास दाखवा')}
            </Text>
          </View>
        </View>
      </View>

      {!booking && isSyncing ? (
        <View className="items-center rounded-3xl border border-warm-100 bg-white py-16">
          <ActivityIndicator color={ui.saffronDeep} size="large" />
          <Text className="mt-4 text-sm font-bold text-warm-500">
            {t('Finding your current stay…', 'तुमचा सध्याचा निवास शोधत आहोत…')}
          </Text>
        </View>
      ) : !booking ? (
        <EmptyState
          action={t('Find a stay', 'निवास शोधा')}
          body={t(
            'Your confirmed stay and check-in QR will appear here.',
            'तुमचा पुष्टी झालेला निवास आणि चेक-इन QR येथे दिसेल.',
          )}
          icon="qrcode-remove"
          onAction={() => router.push('/(app)/lodges')}
          title={t('No active stay pass', 'सक्रिय निवास पास नाही')}
        />
      ) : booking.status === 'pending' ? (
        <View className="overflow-hidden rounded-3xl border border-bell-200 bg-white">
          <View className="items-center bg-bell-50 px-6 py-10">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-bell-100">
              <MaterialCommunityIcons color="#884E13" name="clock-outline" size={40} />
            </View>
            <Text className="mt-5 text-center text-xl font-extrabold text-warm-900">
              {t('Waiting for lodge confirmation', 'लॉजच्या पुष्टीची प्रतीक्षा आहे')}
            </Text>
            <Text className="mt-2 text-center text-sm leading-6 text-warm-600">
              {t(
                'Your QR will appear here automatically as soon as the lodge accepts this stay.',
                'लॉजने हा निवास स्वीकारताच तुमचा QR येथे आपोआप दिसेल.',
              )}
            </Text>
          </View>
          <View className="px-4">
            <InfoRow icon="home-heart" label={t('Lodge', 'लॉज')} value={booking.lodgeName} />
            <InfoRow
              icon="calendar-check"
              label={t('Check-in', 'चेक-इन')}
              value={booking.checkIn}
              last
            />
          </View>
          <Pressable
            className="mx-4 mb-4 min-h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-maroon-700"
            onPress={() => void refreshPass()}
          >
            <MaterialCommunityIcons color="#FFFFFF" name="refresh" size={21} />
            <Text className="text-sm font-extrabold text-white">
              {t('Check status again', 'स्थिती पुन्हा तपासा')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View className="items-center overflow-hidden rounded-3xl bg-maroon-700 px-5 py-7">
            <View className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-saffron-500/20" />
            <View className="absolute -bottom-16 -left-12 h-44 w-44 rounded-full bg-white/5" />
            <Text className="mb-4 text-sm font-extrabold uppercase tracking-widest text-orange-100">
              {booking.bookingCode}
            </Text>
            <View className="h-[270px] w-[270px] items-center justify-center rounded-3xl bg-white p-5 shadow-lg shadow-black/20">
              {payload ? (
                <QRCode
                  backgroundColor="#FFFFFF"
                  color={ui.ink}
                  size={230}
                  value={payload.qrPayload}
                />
              ) : loading ? (
                <ActivityIndicator color={ui.saffronDeep} size="large" />
              ) : (
                <MaterialCommunityIcons color={ui.maroon} name="qrcode-remove" size={72} />
              )}
            </View>
            <View className="mt-5 flex-row items-center gap-2 rounded-full bg-white/10 px-4 py-2">
              <View
                className={`h-2 w-2 rounded-full ${payload ? 'bg-green-300' : 'bg-orange-200'}`}
              />
              <Text className="text-sm font-extrabold text-white">
                {payload
                  ? t('Ready to scan at check-in', 'चेक-इनसाठी स्कॅन करण्यास तयार')
                  : loading
                    ? t('Preparing secure QR…', 'सुरक्षित QR तयार करत आहोत…')
                    : t('QR could not be loaded', 'QR लोड करता आला नाही')}
              </Text>
            </View>
            <Text className="mt-3 text-center text-sm leading-5 text-orange-100">
              {t(
                'Keep this screen open and let the lodge reception scan the code.',
                'ही स्क्रीन उघडी ठेवा आणि लॉज रिसेप्शनला कोड स्कॅन करू द्या.',
              )}
            </Text>
          </View>

          {error ? (
            <Pressable
              className="min-h-14 flex-row items-center justify-center gap-2 rounded-2xl border border-warm-200 bg-white"
              onPress={() => void refreshPass()}
            >
              <MaterialCommunityIcons color={ui.maroon} name="refresh" size={21} />
              <Text className="text-sm font-extrabold text-maroon-700">
                {t('Try loading QR again', 'QR पुन्हा लोड करा')}
              </Text>
            </Pressable>
          ) : null}

          <View className="rounded-3xl border border-warm-100 bg-white px-4">
            <InfoRow icon="home-heart" label={t('Lodge', 'लॉज')} value={booking.lodgeName} />
            <InfoRow
              icon="account-outline"
              label={t('Lead guest', 'मुख्य पाहुणे')}
              value={auth.user?.displayName ?? t('Pilgrim', 'भाविक')}
            />
            <InfoRow
              icon="calendar-check"
              label={t('Check-in', 'चेक-इन')}
              value={booking.checkIn}
            />
            <InfoRow icon="bed-outline" label={t('Room', 'खोली')} value={booking.roomName} last />
          </View>

          <View className="flex-row items-start gap-3 rounded-2xl bg-bell-50 p-4">
            <MaterialCommunityIcons color="#884E13" name="shield-check-outline" size={22} />
            <Text className="flex-1 text-sm leading-5 text-warm-600">
              {t(
                'This pass is private. Carry a government photo ID for verification.',
                'हा पास खाजगी आहे. पडताळणीसाठी सरकारी फोटो ओळखपत्र सोबत ठेवा.',
              )}
            </Text>
          </View>
        </>
      )}
    </AppScreen>
  );
}
