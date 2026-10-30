import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { QrDisplayPayload } from '@tuljai/types';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef, releaseCapture } from 'react-native-view-shot';

import { getBookingQrMetadata } from '../../features/bookings/api/booking-qr-api';
import { canViewBookingQr, isCurrentBookingQr } from '../booking-pass-policy';
import { selectPassBooking } from '../booking-selection';
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
import { usePilgrimApp } from '../PilgrimAppProvider';

export function PilgrimPassScreen() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const { width } = useWindowDimensions();
  const { bookings, isSyncing, refresh, t } = usePilgrimApp();
  // A specific booking link must never fall back to a different stay's QR.
  const booking = selectPassBooking(bookings, bookingId);
  const [payload, setPayload] = useState<QrDisplayPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now());
  const card = useRef<View>(null);
  const cardSize = useRef({ width: 1, height: 1 });
  const exportBusy = useRef(false);
  const screenActive = useRef(false);
  const renderedPayload = useRef(payload);
  renderedPayload.current = payload;
  const selection = useRef(booking);
  selection.current = booking;
  const eligible = booking ? canViewBookingQr(booking, now) : false;
  const ready = isCurrentBookingQr(payload, booking, now);
  const selectedId = booking?.id;
  const selectedVersion = booking?.updatedAt;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      screenActive.current = true;
      setPayload(null);
      if (!selectedId || !eligible)
        return () => {
          screenActive.current = false;
        };
      setLoading(true);
      void getBookingQrMetadata(selectedId)
        .then((result) => {
          if (!cancelled && isCurrentBookingQr(result, selection.current)) setPayload(result);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
        screenActive.current = false;
      };
    }, [selectedId, selectedVersion, eligible, revision]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !exportBusy.current) {
        setPayload(null);
        setNow(Date.now());
        setRevision((value) => value + 1);
        void refresh();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [refresh]);

  useEffect(() => {
    const boundaries = [
      Date.parse(payload?.expiresAt ?? ''),
      Date.parse(`${booking?.checkOutDate.slice(0, 10) ?? ''}T23:59:59+05:30`),
    ].filter(Number.isFinite);
    if (boundaries.length === 0) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(Math.max(1, Math.min(...boundaries) - Date.now() + 1), 2147483647),
    );
    return () => clearTimeout(timer);
  }, [payload?.expiresAt, booking?.checkOutDate]);

  async function exportQr(share: boolean) {
    if (!booking || !ready || !payload || exportBusy.current) return;
    exportBusy.current = true;
    setBusy(true);
    let uri: string | undefined;
    try {
      // Re-authorize before exporting, including remote cancellations.
      const fresh = await getBookingQrMetadata(booking.id);
      if (!screenActive.current) return;
      if (!isCurrentBookingQr(fresh, selection.current) || fresh.qrPayload !== payload.qrPayload) {
        throw new Error(
          t(
            'Your pass changed. Refresh it and try again.',
            'पास बदलला आहे. पुन्हा लोड करून प्रयत्न करा.',
          ),
        );
      }
      if (share && !(await Sharing.isAvailableAsync()))
        throw new Error(
          t('Sharing is unavailable on this device.', 'या डिव्हाइसवर शेअर करता येत नाही.'),
        );
      if (!share) {
        const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
        if (!permission.granted)
          throw new Error(
            t(
              'Allow photo access in Settings to save your QR.',
              'QR जतन करण्यासाठी सेटिंग्जमध्ये फोटो प्रवेश द्या.',
            ),
          );
      }
      if (!screenActive.current) return;
      // Permission/share sheets can change AppState. Capture only the QR that
      // is still mounted, not an unloaded frame from an intervening refresh.
      if (
        !isCurrentBookingQr(renderedPayload.current, selection.current) ||
        renderedPayload.current.qrPayload !== fresh.qrPayload
      )
        throw new Error(t('This pass is no longer available.', 'हा पास आता उपलब्ध नाही.'));
      uri = await captureRef(card, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: 1440,
        height: Math.round((1440 * cardSize.current.height) / cardSize.current.width),
      });
      if (share)
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          UTI: 'public.png',
          dialogTitle: t('Share booking QR', 'बुकिंग QR शेअर करा'),
        });
      else {
        await MediaLibrary.saveToLibraryAsync(uri);
        Alert.alert(
          t('QR saved', 'QR जतन झाला'),
          t(
            'Your booking QR is saved to Photos. The lodge verifies its current status when scanned.',
            'बुकिंग QR फोटोंमध्ये जतन झाला. स्कॅन करताना लॉज सध्याची स्थिती पडताळते.',
          ),
        );
      }
    } catch (cause) {
      setPayload(null);
      setRevision((value) => value + 1);
      Alert.alert(
        t('Could not export QR', 'QR जतन करता आला नाही'),
        cause instanceof Error ? cause.message : t('Please try again.', 'पुन्हा प्रयत्न करा.'),
      );
    } finally {
      if (uri) releaseCapture(uri);
      exportBusy.current = false;
      setBusy(false);
      setNow(Date.now());
      setRevision((value) => value + 1);
    }
  }

  return (
    <AppScreen
      className="gap-5 pt-2"
      refreshing={isSyncing}
      onRefresh={() => {
        void refresh();
        setRevision((value) => value + 1);
      }}
    >
      <TopBar
        title={t('Booking QR', 'बुकिंग QR')}
        subtitle={t('Your secure check-in pass', 'तुमचा सुरक्षित चेक-इन पास')}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(app)/bookings'))}
      />
      {!booking ? (
        isSyncing ? (
          <ActivityIndicator color={ui.maroon} />
        ) : (
          <EmptyState
            title={t('No booking pass', 'बुकिंग पास नाही')}
            body={t(
              'Choose a confirmed booking from My Bookings.',
              'माझ्या बुकिंगमधून पुष्टी झालेले बुकिंग निवडा.',
            )}
            icon="qrcode-remove"
            action={t('My Bookings', 'माझी बुकिंग')}
            onAction={() => router.replace('/(app)/bookings')}
          />
        )
      ) : (
        <>
          <View
            ref={card}
            collapsable={false}
            className="overflow-hidden rounded-3xl border border-warm-200 bg-white"
            onLayout={(event) => {
              cardSize.current = event.nativeEvent.layout;
            }}
          >
            <View className="items-center gap-2 bg-maroon-800 px-5 py-5">
              <MaterialCommunityIcons name="temple-hindu" size={28} color={ui.bell} />
              <Text className="text-xl font-bold text-white">Tuljai Stays</Text>
              <Text className="text-xs text-bell-100">
                {t('BOOKING CHECK-IN PASS', 'बुकिंग चेक-इन पास')}
              </Text>
            </View>
            <View className="items-center gap-4 px-4 py-6">
              {ready && payload ? (
                <View style={{ backgroundColor: '#FFFFFF', padding: 20 }}>
                  <QRCode
                    backgroundColor="#FFFFFF"
                    color="#000000"
                    ecl="M"
                    size={Math.min(260, Math.max(140, width - 122))}
                    value={payload.qrPayload}
                  />
                </View>
              ) : loading && eligible ? (
                <ActivityIndicator size="large" color={ui.maroon} />
              ) : (
                <View className="items-center gap-3 py-4">
                  <MaterialCommunityIcons name="qrcode-remove" size={64} color={ui.muted} />
                  <Text className="text-center text-sm leading-6 text-warm-600">
                    {booking.status === 'checked-in'
                      ? t(
                          'Check-in completed. This single-use QR has been consumed.',
                          'चेक-इन पूर्ण. हा QR वापरला गेला आहे.',
                        )
                      : eligible
                        ? t(
                            'QR unavailable. Refresh and try again.',
                            'QR उपलब्ध नाही. पुन्हा लोड करा.',
                          )
                        : t(
                            'A QR is available only for a confirmed, eligible stay. Pending and past stays cannot be used for check-in.',
                            'फक्त पात्र, पुष्टी झालेल्या निवासासाठी QR मिळतो. प्रलंबित व मागील निवासासाठी चेक-इन करता येत नाही.',
                          )}
                  </Text>
                </View>
              )}
              <Text
                selectable
                className="text-center text-xl font-bold tracking-widest text-maroon-700"
              >
                {booking.bookingCode}
              </Text>
              <StatusBadge status={booking.status} />
            </View>
            <View className="px-4">
              <InfoRow icon="home-heart" label={t('Lodge', 'लॉज')} value={booking.lodgeName} />
              <InfoRow icon="bed-outline" label={t('Room', 'खोली')} value={booking.roomName} />
              <InfoRow
                icon="calendar-check"
                label={t('Check-in', 'चेक-इन')}
                value={booking.checkIn}
              />
              <InfoRow
                icon="calendar-arrow-left"
                label={t('Check-out', 'चेक-आउट')}
                value={
                  booking.checkoutDateFlexible
                    ? t('Confirm with lodge', 'लॉजसोबत ठरवा')
                    : booking.checkOut
                }
                last
              />
            </View>
          </View>
          {eligible && !ready ? (
            <SecondaryButton
              icon="refresh"
              onPress={() => {
                void refresh();
                setRevision((value) => value + 1);
              }}
            >
              {t('Refresh QR', 'QR पुन्हा लोड करा')}
            </SecondaryButton>
          ) : null}
          {Platform.OS !== 'web' ? (
            <>
              <PrimaryButton
                disabled={!ready || busy}
                loading={busy}
                icon="download"
                onPress={() => void exportQr(false)}
              >
                {t('Download QR', 'QR डाउनलोड करा')}
              </PrimaryButton>
              <SecondaryButton
                disabled={!ready || busy}
                icon="share-variant-outline"
                onPress={() => void exportQr(true)}
              >
                {t('Share QR', 'QR शेअर करा')}
              </SecondaryButton>
            </>
          ) : (
            <Text className="text-center text-sm text-warm-600">
              {t(
                'Open the mobile app to download or share your QR.',
                'QR डाउनलोड किंवा शेअर करण्यासाठी मोबाइल अ‍ॅप उघडा.',
              )}
            </Text>
          )}
          <Text className="text-center text-xs leading-5 text-warm-600">
            {t(
              'Keep this pass private. Carry your government photo ID. Saved passes remain subject to expiry and server verification.',
              'हा पास खाजगी ठेवा. सरकारी फोटो ओळखपत्र सोबत ठेवा. जतन केलेला पासही मुदत व सर्व्हर पडताळणीच्या अधीन आहे.',
            )}
          </Text>
        </>
      )}
    </AppScreen>
  );
}
