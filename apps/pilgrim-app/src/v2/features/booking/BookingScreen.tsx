import type { BookingGuestIdProofUpload } from '@tuljai/types';
import { useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PaymentRecoveryStatus } from '../../../features/bookings/api/bookings-api';
import {
  readPendingPayment,
  rememberPendingPayment,
  clearPendingPayment,
} from '../../../features/bookings/payment-recovery-store';
import { useStayPrice } from '../../../features/bookings/useStayPrice';
import type { GuestBookingDetails, StayRequest } from '../../core/booking';
import {
  bookPayAtLodge,
  fetchAvailability,
  confirmPrepaidBooking,
  preparePrepaidIntent,
} from '../../core/booking';
import { getPrepaidPaymentStatus, confirmRecoveredPayment } from '../../core/booking';
import { fetchLodge } from '../../core/catalog';
import { useRemoteConfig } from '../../core/config';
import { addDays, daysBetween, formatShortDate, startOfToday, toDateOnly } from '../../core/dates';
import { PaymentDismissedError, openRazorpay } from '../../core/razorpay';
import { useAvailability } from '../../core/useAvailability';
import { useCachedFetch } from '../../core/useCachedFetch';
import { usePrepaidHold } from '../../core/usePrepaidHold';
import { useSession } from '../../core/useSession';
import { useColors } from '../../design/theme';
import { elevation, gutter, radius, space } from '../../design/tokens';
import { useLang } from '../../i18n/language';
import { bookingStrings, detailStrings, formatRupees, strings } from '../../i18n/strings';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { PressableScale } from '../../ui/PressableScale';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';

import { DatesModal } from './DatesModal';
import { FormField } from './FormField';
import { GuestStepper } from './GuestStepper';
import { IdProofPicker } from './IdProofPicker';
import { PaymentOption } from './PaymentOption';

export type PaymentMethod = 'ONLINE' | 'PAY_AT_LODGE';

export interface BookingScreenProps {
  initialRoomTypeId?: string;
  lodgeId: string;
  onBack: () => void;
  onBooked: (bookingId: string, method: PaymentMethod) => void;
}

type FieldKey = 'email' | 'id' | 'name' | 'phone' | 'terms';

export function BookingScreen({
  initialRoomTypeId,
  lodgeId,
  onBack,
  onBooked,
}: BookingScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { lang, t } = useLang();
  const session = useSession();
  const { config } = useRemoteConfig();
  const { data, loading, refresh } = useCachedFetch(`lodge:${lodgeId}`, () => fetchLodge(lodgeId));

  const onlineAllowed = config.settings['enable_online_payments'] !== false;
  const [checkIn, setCheckIn] = useState(() => toDateOnly(addDays(startOfToday(), 1)));
  const [checkOut, setCheckOut] = useState(() => toDateOnly(addDays(startOfToday(), 2)));
  const [datesOpen, setDatesOpen] = useState(false);
  const [roomTypeId, setRoomTypeId] = useState(initialRoomTypeId ?? '');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [name, setName] = useState(session.user?.displayName?.trim() ?? '');
  const [phone, setPhone] = useState(
    session.user?.phoneNumber?.replace(/\D/gu, '').slice(-10) ?? '',
  );
  const [email, setEmail] = useState('');
  const [request, setRequest] = useState('');
  const [idProof, setIdProof] = useState<BookingGuestIdProofUpload | null>(null);
  const [idUploading, setIdUploading] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>(onlineAllowed ? 'ONLINE' : 'PAY_AT_LODGE');
  const [agree, setAgree] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [roomTakenWhileBooking, setRoomTakenWhileBooking] = useState(false);

  const rooms = useMemo(() => data?.roomTypes ?? [], [data]);
  const room = rooms.find((item) => item.id === roomTypeId) ?? rooms[0];
  const nights = Math.max(daysBetween(checkIn, checkOut), 1);

  const stay = useMemo<StayRequest | null>(
    () =>
      room ? { checkInDate: checkIn, checkOutDate: checkOut, lodgeId, roomTypeId: room.id } : null,
    [checkIn, checkOut, lodgeId, room],
  );

  const hold = usePrepaidHold({ enabled: method === 'ONLINE' && stay !== null, stay });
  const holdActiveRef = useRef(false);
  holdActiveRef.current = method === 'ONLINE' && hold.status !== 'idle';
  const counts = useAvailability({
    checkInDate: checkIn,
    checkOutDate: checkOut,
    enabled: rooms.length > 0,
    lodgeId,
    roomTypeIds: rooms.map((item) => item.id),
    shouldDiscard: () => holdActiveRef.current,
  });

  const selectedCount = room ? counts[room.id] : undefined;
  const roomFull = hold.roomFull || selectedCount === 0 || roomTakenWhileBooking;
  const priceQuote = useStayPrice(stay, fetchAvailability);
  const estimate = priceQuote.amount ?? (room ? Number(room.basePrice) * nights : 0);
  // Once the hold exists, the order amount (in paise) is the exact figure Razorpay will charge.
  const total = hold.order && method === 'ONLINE' ? hold.order.amount / 100 : estimate;
  const maxAdults = Math.max(room?.capacityAdults ?? 1, 1);
  const maxChildren = Math.max(room?.capacityChildren ?? 0, 0);

  function chooseRoom(id: string) {
    setRoomTypeId(id);
    setRoomTakenWhileBooking(false);
    const next = rooms.find((item) => item.id === id);
    if (next) {
      setAdults((value) => Math.min(value, Math.max(next.capacityAdults, 1)));
      setChildren((value) => Math.min(value, Math.max(next.capacityChildren, 0)));
    }
  }

  function validate(): boolean {
    const next: Partial<Record<FieldKey, string>> = {};
    if (name.trim().length === 0) next.name = t(bookingStrings.nameInvalid);
    if (phone.replace(/\D/gu, '').length !== 10) next.phone = t(bookingStrings.phoneInvalid);
    if (email.trim().length > 0 && !/^\S+@\S+\.\S+$/u.test(email.trim())) {
      next.email = t(bookingStrings.emailInvalid);
    }
    if (idUploading) next.id = t(bookingStrings.idWait);
    else if (!idProof) next.id = t(bookingStrings.idMissing);
    if (!agree) next.terms = t(bookingStrings.termsRequired);
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function resumePayment(previous: NonNullable<PaymentRecoveryStatus['retryCheckout']>) {
    if (!session.user?.id) return;
    setSubmitting(true);
    try {
      const payment = await openRazorpay(previous.order, {
        description: `${previous.lodgeName}: ${previous.checkInDate} to ${previous.checkOutDate}`,
        name: previous.guestDetails.guestName,
        phone: previous.guestDetails.guestPhone,
        themeColor: colors.primary,
      });
      const booking = await confirmRecoveredPayment({ ...previous.guestDetails, ...payment });
      await clearPendingPayment(session.user.id);
      onBooked(booking.id, 'ONLINE');
    } catch {
      setFailure(
        'Payment status is uncertain. Retry to check your existing payment; do not start another payment.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submit() {
    if (session.user?.id) {
      setSubmitting(true);
      try {
        const pending = await readPendingPayment(session.user.id);
        if (pending) {
          const status = await getPrepaidPaymentStatus(pending);
          if (status.status === 'CONFIRMED' && status.bookingId) {
            await clearPendingPayment(session.user.id);
            onBooked(status.bookingId, 'ONLINE');
          } else if (status.retryCheckout) {
            const previous = status.retryCheckout;
            Alert.alert(
              'Resume previous payment',
              `${previous.lodgeName}: ${previous.checkInDate} to ${previous.checkOutDate}. Total ${formatRupees(previous.order.amount / 100)}.`,
              [
                { text: 'Later', style: 'cancel' },
                {
                  text: 'Resume',
                  onPress: () => {
                    void resumePayment(previous);
                  },
                },
              ],
            );
          } else
            setFailure(
              status.recoveryRequired
                ? 'Payment needs operator review. Do not pay again; contact support.'
                : 'Payment is pending. Retry to check status; do not pay again.',
            );
          return;
        }
      } catch (cause) {
        setFailure(
          cause instanceof Error ? cause.message : 'Payment status unavailable. Please retry.',
        );
        return;
      } finally {
        setSubmitting(false);
      }
    }
    if (method === 'PAY_AT_LODGE' && priceQuote.amount === null) {
      priceQuote.retry();
      setFailure('Current price is unavailable. Please wait and retry.');
      return;
    }
    if (!stay || !room || !idProof) {
      validate();
      return;
    }
    if (!validate()) return;

    const details: GuestBookingDetails = {
      guestEmail: email.trim() || undefined,
      guestIdProof: idProof,
      guestName: name.trim(),
      guestPhone: `+91${phone.replace(/\D/gu, '')}`,
      numberOfAdults: adults,
      numberOfChildren: children,
      specialRequest: request.trim() || undefined,
    };

    setSubmitting(true);
    setFailure(null);
    setPaymentReference(null);
    setRoomTakenWhileBooking(false);
    let captured: string | null = null;

    try {
      if (method === 'ONLINE') {
        // Normally resolves instantly because the hold and order were prepared in the background.
        const prepared = await hold.ensureReady();
        await preparePrepaidIntent(prepared.lockCode, details);
        if (!session.user?.id) throw new Error('Please sign in again before payment.');
        await rememberPendingPayment(session.user.id, prepared.order.orderId);
        hold.beginPayment();
        const payment = await openRazorpay(prepared.order, {
          description: `${data?.lodge.name ?? ''} · ${room.name}`,
          email: details.guestEmail,
          name: details.guestName,
          phone: phone.replace(/\D/gu, ''),
          themeColor: colors.primary,
        });

        captured = payment.paymentId;
        const booking = await confirmPrepaidBooking(prepared.lockCode, details, payment);
        hold.consume();
        await clearPendingPayment(session.user.id);
        onBooked(booking.id, 'ONLINE');
      } else {
        await hold.settled();
        const booking = await bookPayAtLodge(stay, details);
        onBooked(booking.id, 'PAY_AT_LODGE');
      }
    } catch (cause) {
      if (cause instanceof PaymentDismissedError) return;
      if (captured === null && typeof cause === 'object' && cause !== null && 'details' in cause) {
        const status = (cause as { details?: { statusCode?: number } }).details?.statusCode;
        if (status === 409) {
          setRoomTakenWhileBooking(true);
          return;
        }
      }
      setFailure(cause instanceof Error ? cause.message : t(detailStrings.tryAgain));
      setPaymentReference(captured);
    } finally {
      setSubmitting(false);
    }
  }

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
      <PressableScale
        accessibilityLabel="Back"
        pressedScale={0.92}
        style={[styles.back, { backgroundColor: colors.surface }]}
        onPress={onBack}
      >
        <Icon name="arrow-left" size={20} />
      </PressableScale>
      <View style={styles.headerCopy}>
        <Text variant="title">{t(bookingStrings.title)}</Text>
        {data ? (
          <Text color="inkMuted" numberOfLines={1} variant="label">
            {data.lodge.name}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (!data) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {header}
        <View style={styles.padded}>
          {loading ? (
            <>
              <Skeleton height={96} />
              <Skeleton height={140} />
              <Skeleton height={200} />
            </>
          ) : (
            <>
              <Text align="center">{t(detailStrings.loadError)}</Text>
              <Button
                label={t(detailStrings.tryAgain)}
                variant="secondary"
                onPress={() => void refresh()}
              />
            </>
          )}
        </View>
      </View>
    );
  }

  if (rooms.length === 0 || !room) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {header}
        <View style={styles.padded}>
          <Text align="center" color="inkMuted">
            {t(bookingStrings.noRoom)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PressableScale
          accessibilityLabel={t(bookingStrings.checkInOut)}
          pressedScale={0.985}
          style={[styles.card, styles.datesCard, { backgroundColor: colors.surface }]}
          onPress={() => setDatesOpen(true)}
        >
          <View style={styles.dateColumn}>
            <Text color="inkMuted" variant="caption">
              {t(detailStrings.checkIn)}
            </Text>
            <Text variant="heading">{formatShortDate(checkIn, lang)}</Text>
          </View>
          <Icon color="inkFaint" name="arrow-right" size={18} />
          <View style={styles.dateColumn}>
            <Text color="inkMuted" variant="caption">
              {t(detailStrings.checkOut)}
            </Text>
            <Text variant="heading">{formatShortDate(checkOut, lang)}</Text>
          </View>
          <View style={[styles.nightsPill, { backgroundColor: colors.primarySoft }]}>
            <Text color="primary" variant="label">
              {nights} {t(nights === 1 ? bookingStrings.night : bookingStrings.nights)}
            </Text>
          </View>
        </PressableScale>

        <View style={styles.section}>
          <Text variant="heading">{t(bookingStrings.chooseRoom)}</Text>
          {rooms.map((item) => {
            const selected = item.id === room.id;
            const left = counts[item.id];
            return (
              <PressableScale
                accessibilityLabel={item.name}
                accessibilityState={{ selected }}
                key={item.id}
                pressedScale={0.985}
                style={[
                  styles.roomCard,
                  {
                    backgroundColor: selected ? colors.primarySoft : colors.surface,
                    borderColor: selected ? colors.primary : colors.line,
                  },
                ]}
                onPress={() => chooseRoom(item.id)}
              >
                <View style={styles.roomCopy}>
                  <Text variant="heading">{item.name}</Text>
                  <Text color="inkMuted" variant="caption">
                    {item.capacityAdults + item.capacityChildren} {t(detailStrings.guests)}
                  </Text>
                  {left === 0 ? (
                    <Text color="danger" variant="label">
                      {t(bookingStrings.soldOut)}
                    </Text>
                  ) : left !== undefined && left <= 3 ? (
                    <Text color="accent" variant="label">
                      {left} {t(bookingStrings.roomsLeft)}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.roomPrice}>
                  <Text color="primary" variant="price">
                    {formatRupees(item.basePrice)}
                  </Text>
                  <Text color="inkMuted" variant="caption">
                    {t(strings.perNight)}
                  </Text>
                </View>
              </PressableScale>
            );
          })}
          {roomFull ? (
            <View style={[styles.notice, { backgroundColor: colors.accentSoft }]}>
              <Icon color="accent" name="alert-circle" size={18} />
              <Text style={styles.noticeText} variant="label">
                {t(bookingStrings.roomFull)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.card, styles.stack, { backgroundColor: colors.surface }]}>
          <Text variant="heading">{t(bookingStrings.guests)}</Text>
          <GuestStepper
            label={t(bookingStrings.adults)}
            max={maxAdults}
            min={1}
            value={adults}
            onChange={setAdults}
          />
          {maxChildren > 0 ? (
            <GuestStepper
              label={t(bookingStrings.children)}
              max={maxChildren}
              min={0}
              value={children}
              onChange={setChildren}
            />
          ) : null}
        </View>

        <View style={styles.section}>
          <Text variant="heading">{t(bookingStrings.guestDetails)}</Text>
          <FormField
            autoCapitalize="words"
            error={errors.name}
            label={t(bookingStrings.name)}
            textContentType="name"
            value={name}
            onChangeText={setName}
          />
          <FormField
            error={errors.phone}
            keyboardType="phone-pad"
            label={t(bookingStrings.phone)}
            maxLength={10}
            textContentType="telephoneNumber"
            value={phone}
            onChangeText={(value) => setPhone(value.replace(/\D/gu, ''))}
          />
          <FormField
            autoCapitalize="none"
            error={errors.email}
            keyboardType="email-address"
            label={t(bookingStrings.email)}
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />
          <IdProofPicker
            error={errors.id}
            value={idProof}
            onChange={setIdProof}
            onUploadingChange={setIdUploading}
          />
          <FormField
            label={t(bookingStrings.request)}
            multiline
            value={request}
            onChangeText={setRequest}
          />
        </View>

        <View style={styles.section}>
          <Text variant="heading">{t(bookingStrings.payment)}</Text>
          {onlineAllowed ? (
            <PaymentOption
              hint={t(bookingStrings.payOnlineHint)}
              icon="zap"
              selected={method === 'ONLINE'}
              title={t(bookingStrings.payOnline)}
              onPress={() => setMethod('ONLINE')}
            />
          ) : null}
          <PaymentOption
            hint={t(bookingStrings.payAtLodgeHint)}
            icon="home"
            selected={method === 'PAY_AT_LODGE'}
            title={t(bookingStrings.payAtLodge)}
            onPress={() => setMethod('PAY_AT_LODGE')}
          />
        </View>

        <PressableScale
          accessibilityLabel={t(bookingStrings.termsLabel)}
          accessibilityState={{ checked: agree }}
          pressedScale={0.99}
          style={styles.terms}
          onPress={() => setAgree((value) => !value)}
        >
          <View
            style={[
              styles.checkbox,
              {
                backgroundColor: agree ? colors.primary : colors.surface,
                borderColor: errors.terms ? colors.danger : agree ? colors.primary : colors.line,
              },
            ]}
          >
            {agree ? <Icon color="onPrimary" name="check" size={14} /> : null}
          </View>
          <Text style={styles.termsText} variant="label">
            {t(bookingStrings.termsLabel)}
          </Text>
        </PressableScale>
        {errors.terms ? (
          <Text color="danger" variant="caption">
            {errors.terms}
          </Text>
        ) : null}

        {failure ? (
          <View style={[styles.notice, { backgroundColor: colors.accentSoft }]}>
            <Icon color="danger" name="alert-triangle" size={18} />
            <View style={styles.noticeText}>
              <Text variant="label">{failure}</Text>
              {paymentReference ? (
                <Text color="inkMuted" variant="caption">
                  {t(bookingStrings.paidFailedHint)} {paymentReference}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.bar,
          elevation.raised,
          { backgroundColor: colors.surface, paddingBottom: insets.bottom + space.md },
        ]}
      >
        <View>
          <Text color="inkMuted" variant="caption">
            {method === 'ONLINE' && hold.status === 'preparing'
              ? t(bookingStrings.preparing)
              : t(bookingStrings.total)}
          </Text>
          <Text color="primary" variant="price">
            {formatRupees(total)}
          </Text>
        </View>
        <Button
          disabled={roomFull || idUploading}
          label={
            method === 'ONLINE'
              ? `${t(bookingStrings.payNow)} ${formatRupees(total)}`
              : t(bookingStrings.sendRequest)
          }
          loading={submitting}
          style={styles.cta}
          onPress={() => void submit()}
        />
      </View>

      <DatesModal
        checkIn={checkIn}
        checkOut={checkOut}
        visible={datesOpen}
        onApply={(start, end) => {
          setCheckIn(start);
          setCheckOut(end);
          setDatesOpen(false);
          setRoomTakenWhileBooking(false);
        }}
        onClose={() => setDatesOpen(false)}
      />
    </KeyboardAvoidingView>
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
  bar: {
    alignItems: 'center',
    bottom: 0,
    flexDirection: 'row',
    gap: space.xl,
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: gutter,
    paddingTop: space.md,
    position: 'absolute',
    right: 0,
  },
  card: { borderRadius: radius.lg, padding: space.lg },
  checkbox: {
    alignItems: 'center',
    borderRadius: radius.sm / 2,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  content: { gap: space.xxl, paddingHorizontal: gutter, paddingTop: space.lg },
  cta: { flex: 1 },
  dateColumn: { flex: 1, gap: 2 },
  datesCard: { alignItems: 'center', flexDirection: 'row', gap: space.md },
  header: { alignItems: 'center', flexDirection: 'row', gap: space.lg, paddingHorizontal: gutter },
  headerCopy: { flex: 1 },
  nightsPill: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  notice: {
    alignItems: 'flex-start',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
  },
  noticeText: { flex: 1, gap: 2 },
  padded: { gap: space.lg, padding: gutter },
  roomCard: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: space.lg,
    padding: space.lg,
  },
  roomCopy: { flex: 1, gap: 2 },
  roomPrice: { alignItems: 'flex-end' },
  screen: { flex: 1 },
  section: { gap: space.md },
  stack: { gap: space.lg },
  terms: { alignItems: 'center', flexDirection: 'row', gap: space.md },
  termsText: { flex: 1 },
});
