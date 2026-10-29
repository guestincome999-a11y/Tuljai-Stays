import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookingActionButton } from '../../../features/bookings/components/BookingActionButton';
import { cancelBooking, fetchBooking, fetchMyBookings } from '../../core/bookings';
import type { MyBookingCard } from '../../core/bookings';
import { fetchLodge } from '../../core/catalog';
import { daysBetween, formatShortDate } from '../../core/dates';
import { refreshAllCached, useCachedFetch } from '../../core/useCachedFetch';
import { useColors } from '../../design/theme';
import { gutter, radius, space } from '../../design/tokens';
import { useLang } from '../../i18n/language';
import {
  CANCELLABLE_STATUSES,
  CONTACT_STATUSES,
  PASS_STATUSES,
  bookingStatusText,
  bookingStrings,
  detailStrings,
  formatRupees,
  myBookingsStrings,
  paymentStatusText,
} from '../../i18n/strings';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Photo } from '../../ui/Photo';
import { PressableScale } from '../../ui/PressableScale';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';

import { statusTone } from './BookingStatusBadge';
import { LodgeContactActions } from './LodgeContactActions';
import { QrPass } from './QrPass';
import { ReviewCard } from './ReviewCard';

function DirectionsButton({ lodgeId, lodgeName }: { lodgeId: string; lodgeName: string }) {
  const { t } = useLang();
  const { data } = useCachedFetch(`lodge:${lodgeId}`, () => fetchLodge(lodgeId));
  const link =
    data?.lodge.googleMapsLink ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lodgeName}, Tuljapur`)}`;

  return (
    <BookingActionButton
      compact
      icon="map-marker-outline"
      label={t(detailStrings.directions)}
      onPress={() => void Linking.openURL(link)}
    />
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text color="inkMuted" variant="label">
        {label}
      </Text>
      <Text style={styles.summaryValue} variant="label">
        {value}
      </Text>
    </View>
  );
}

export function BookingDetailScreen({
  bookingId,
  onBack,
}: {
  bookingId: string;
  onBack: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { lang, t } = useLang();
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const { data: booking } = useCachedFetch(`booking:${bookingId}`, () => fetchBooking(bookingId));
  const { data: list } = useCachedFetch('my-bookings', fetchMyBookings);
  const card: MyBookingCard | undefined = list?.find((item) => item.id === bookingId);

  const status = booking?.status ?? card?.status ?? null;
  const text = status ? bookingStatusText[status] : undefined;
  const nights = card ? Math.max(daysBetween(card.checkInDate, card.checkOutDate), 1) : null;

  function confirmCancel() {
    Alert.alert(t(myBookingsStrings.cancelTitle), t(myBookingsStrings.cancelBody), [
      { style: 'cancel', text: t(myBookingsStrings.cancelKeep) },
      {
        onPress: () => {
          setCancelling(true);
          setCancelError(null);
          cancelBooking(bookingId)
            .then(() => refreshAllCached())
            .catch((cause: unknown) =>
              setCancelError(cause instanceof Error ? cause.message : t(detailStrings.tryAgain)),
            )
            .finally(() => setCancelling(false));
        },
        style: 'destructive',
        text: t(myBookingsStrings.cancelConfirm),
      },
    ]);
  }

  const reason = booking?.rejectedReason ?? booking?.cancellationReason ?? null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <PressableScale
          accessibilityLabel="Back"
          pressedScale={0.92}
          style={[styles.back, { backgroundColor: colors.surface }]}
          onPress={onBack}
        >
          <Icon name="arrow-left" size={20} />
        </PressableScale>
        <Text variant="title">{card?.bookingCode ?? booking?.bookingCode ?? ''}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.huge }]}
        showsVerticalScrollIndicator={false}
      >
        {status ? (
          <View style={[styles.banner, { backgroundColor: colors.surfaceMuted }]}>
            <View style={[styles.bannerDot, { backgroundColor: colors[statusTone(status)] }]} />
            <View style={styles.bannerCopy}>
              <Text variant="heading">{text ? t(text.label) : status}</Text>
              {text ? (
                <Text color="inkMuted" variant="label">
                  {t(text.hint)}
                </Text>
              ) : null}
              {reason ? (
                <Text color="inkMuted" variant="caption">
                  {reason}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <Skeleton height={80} />
        )}

        {status && PASS_STATUSES.includes(status) ? <QrPass bookingId={bookingId} /> : null}

        {card ? (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.lodgeRow}>
              <Photo style={styles.thumb} uri={card.coverUrl} />
              <View style={styles.lodgeCopy}>
                <Text variant="heading">{card.lodgeName}</Text>
                <Text color="inkMuted" variant="label">
                  {card.roomTypeName}
                </Text>
              </View>
              <DirectionsButton lodgeId={card.lodgeId} lodgeName={card.lodgeName} />
            </View>
            <SummaryRow
              label={t(detailStrings.checkIn)}
              value={formatShortDate(card.checkInDate, lang)}
            />
            <SummaryRow
              label={t(detailStrings.checkOut)}
              value={formatShortDate(card.checkOutDate, lang)}
            />
            {nights !== null ? (
              <SummaryRow
                label={t(myBookingsStrings.stayTitle)}
                value={`${nights} ${t(nights === 1 ? bookingStrings.night : bookingStrings.nights)} · ${card.totalGuests} ${t(myBookingsStrings.guests)}`}
              />
            ) : null}
          </View>
        ) : (
          <Skeleton height={150} />
        )}

        {status && CONTACT_STATUSES.includes(status) ? (
          <LodgeContactActions bookingId={bookingId} />
        ) : null}

        {booking ? (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text variant="heading">{t(myBookingsStrings.paymentTitle)}</Text>
            {booking.totalAmount ? (
              <SummaryRow
                label={t(myBookingsStrings.amountPaid)}
                value={formatRupees(booking.totalAmount)}
              />
            ) : null}
            <SummaryRow
              label={t(myBookingsStrings.paymentTitle)}
              value={
                paymentStatusText[booking.paymentStatus]
                  ? t(paymentStatusText[booking.paymentStatus] ?? { en: '', mr: '' })
                  : booking.paymentStatus
              }
            />
            {booking.balanceAmount && Number(booking.balanceAmount) > 0 ? (
              <SummaryRow
                label={t(myBookingsStrings.balance)}
                value={formatRupees(booking.balanceAmount)}
              />
            ) : null}
          </View>
        ) : null}

        {status === 'CHECKED_OUT' || status === 'COMPLETED' ? (
          <ReviewCard bookingId={bookingId} />
        ) : null}

        {status && CANCELLABLE_STATUSES.includes(status) ? (
          <Button
            label={t(myBookingsStrings.cancel)}
            loading={cancelling}
            variant="ghost"
            onPress={confirmCancel}
          />
        ) : null}
        {cancelError ? (
          <Text align="center" color="danger" variant="label">
            {cancelError}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  banner: {
    alignItems: 'flex-start',
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
  },
  bannerCopy: { flex: 1, gap: 2 },
  bannerDot: { borderRadius: radius.pill, height: 10, marginTop: 7, width: 10 },
  card: { borderRadius: radius.lg, gap: space.md, padding: space.lg },
  content: { gap: space.lg, paddingHorizontal: gutter, paddingTop: space.lg },
  header: { alignItems: 'center', flexDirection: 'row', gap: space.lg, paddingHorizontal: gutter },
  lodgeCopy: { flex: 1, gap: 2 },
  lodgeRow: { alignItems: 'center', flexDirection: 'row', gap: space.md },
  screen: { flex: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryValue: { flexShrink: 1, textAlign: 'right' },
  thumb: { borderRadius: radius.md, height: 64, width: 64 },
});
