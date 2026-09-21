import { EmptyState, radius, spacing } from '@tuljai/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Snackbar,
  Text,
  useTheme,
} from 'react-native-paper';

import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { listGuestRegisters } from '../../checkin/api/checkin-api';
import { DateRangeModal } from '../components/DateRangeModal';
import { RejectBookingModal } from '../components/RejectBookingModal';
import { useOwnerBookingDetail } from '../hooks/useOwnerBookingDetail';
import { useOwnerBookingActions } from '../hooks/useOwnerBookings';
import {
  canOwnerModifyDates,
  canOwnerRespond,
  formatCheckOut,
  formatDateKey,
  getCheckInStatusLabel,
  getGuestSummary,
  getPaymentLabel,
  getPaymentMethodLabel,
  getRoomRequirement,
  getStatusLabel,
  isPrepaidBooking,
  toDateKey,
} from '../utils/booking-display';

export function OwnerBookingDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const bookingId = typeof params.id === 'string' ? params.id : null;
  const detail = useOwnerBookingDetail(bookingId);
  const router = useRouter();
  const theme = useTheme();
  const [rejectVisible, setRejectVisible] = useState(false);
  const [datesVisible, setDatesVisible] = useState(false);
  const [registerId, setRegisterId] = useState<string | null>(null);
  const actions = useOwnerBookingActions(() => {
    void detail.refresh();
    setRejectVisible(false);
  });
  const booking = detail.data;

  useEffect(() => {
    if (!booking || !['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'].includes(booking.status)) {
      setRegisterId(null);
      return;
    }

    let mounted = true;
    const bookingCode = booking.bookingCode;

    async function loadRegisterId() {
      const response = await listGuestRegisters({
        bookingCode,
        limit: 1,
        page: 1,
      }).catch(() => null);

      if (mounted) {
        setRegisterId(response?.items[0]?.id ?? null);
      }
    }

    void loadRegisterId();

    return () => {
      mounted = false;
    };
  }, [booking]);

  if (detail.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating size="large" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="Booking unavailable"
          description={detail.errorMessage ?? 'This booking could not be opened.'}
          actionLabel="Retry"
          onActionPress={() => {
            void detail.refresh();
          }}
        />
      </View>
    );
  }

  const canRespond = canOwnerRespond(booking);
  const canModifyDates = canOwnerModifyDates(booking);
  const isPrepaid = isPrepaidBooking(booking);
  const isAwaitingOnlinePayment =
    booking.status === 'PENDING_OWNER_APPROVAL' && !canRespond && !isPrepaid;
  const isBusy = actions.isOffline || Boolean(actions.submittingBookingId);
  const totalAmount = Number(booking.totalAmount);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.screen}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void detail.refresh();
            }}
            refreshing={detail.isRefreshing}
            tintColor={theme.colors.primary}
          />
        }
      >
        <Card mode="contained" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.header}>
              <View style={styles.titleBlock}>
                <Text variant="headlineSmall">{booking.guestName}</Text>
                <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
                  Booking ID: {booking.bookingCode}
                </Text>
              </View>
              <Chip>{getStatusLabel(booking)}</Chip>
            </View>
            <Text variant="bodyMedium">Check-in: {formatDateKey(booking.checkInDate)}</Text>
            <Text variant="bodyMedium">Check-out: {formatCheckOut(booking)}</Text>
            <Text variant="bodyMedium">
              Guests: {booking.totalGuests} ({getGuestSummary(booking)})
            </Text>
            <Text variant="bodyMedium">
              Room requirement: {getRoomRequirement(booking)}
              {booking.roomNumber ? ` (Room ${booking.roomNumber})` : ''}
            </Text>
            <Text variant="bodyMedium">Number of rooms: 1</Text>
            <Text variant="bodyMedium">
              Special requirements: {booking.specialRequest ?? 'None'}
            </Text>
            <Text variant="bodyMedium">Check-in status: {getCheckInStatusLabel(booking)}</Text>
            {canRespond && booking.ownerResponseDeadline ? (
              <Text style={{ color: theme.colors.primary }} variant="bodySmall">
                Respond by {new Date(booking.ownerResponseDeadline).toLocaleString('en-IN')}
              </Text>
            ) : null}
          </Card.Content>
        </Card>

        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Payment</Text>
            <Text style={{ color: theme.colors.primary }} variant="titleSmall">
              {getPaymentMethodLabel(booking.paymentStatus)}
            </Text>
            <Text variant="bodyMedium">Status: {getPaymentLabel(booking.paymentStatus)}</Text>
            {booking.totalAmount && Number.isFinite(totalAmount) ? (
              <Text variant="bodyMedium">
                Total: Rs. {totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </Text>
            ) : null}
            {isPrepaid ? (
              <Text variant="bodyMedium">
                Prepaid booking. A room is assigned automatically based on availability, so it
                needs no approval. It cannot be rejected or cancelled from here, and its dates
                can only be changed by Tuljai Stays support.
              </Text>
            ) : null}
            {canRespond ? (
              <Text variant="bodyMedium">
                Pay at lodge booking. Accept or reject this request, then collect payment at the
                lodge.
              </Text>
            ) : null}
            {isAwaitingOnlinePayment ? (
              <Text variant="bodyMedium">Waiting for the guest&apos;s online payment.</Text>
            ) : null}
          </Card.Content>
        </Card>

        {booking.guests.length > 0 ? (
          <Card mode="outlined" style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleMedium">Guests</Text>
              {booking.guests.map((guest) => (
                <Text key={guest.id} variant="bodyMedium">
                  {guest.fullName}
                  {guest.age ? `, ${guest.age}` : ''}
                  {guest.isPrimaryGuest ? ' (primary)' : ''}
                </Text>
              ))}
            </Card.Content>
          </Card>
        ) : null}

        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Privacy</Text>
            {['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'].includes(booking.status) ? (
              <>
                <Text variant="bodyMedium">Phone: {booking.guestPhone ?? 'Not provided'}</Text>
                <Text variant="bodyMedium">
                  Alternate: {booking.alternatePhone ?? 'Not provided'}
                </Text>
                <Text variant="bodyMedium">Address: {booking.guestAddress ?? 'Not provided'}</Text>
                <Text variant="bodyMedium">Guest ID details are available in Guest Register.</Text>
                {registerId ? (
                  <Button
                    accessibilityHint="Opens the verified guest register for this booking."
                    accessibilityLabel={`Open guest register for booking ${booking.bookingCode}`}
                    mode="contained-tonal"
                    onPress={() =>
                      router.push({ pathname: '/(app)/register/[id]', params: { id: registerId } })
                    }
                  >
                    Open Guest Register
                  </Button>
                ) : null}
              </>
            ) : (
              <Text variant="bodyMedium">
                Contact details and ID details remain hidden until QR check-in is completed.
              </Text>
            )}
          </Card.Content>
        </Card>

        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Timeline</Text>
            <Text variant="bodyMedium">Created: {formatDateTime(booking.createdAt)}</Text>
            <Text variant="bodyMedium">Updated: {formatDateTime(booking.updatedAt)}</Text>
            {booking.checkedInAt ? (
              <Text variant="bodyMedium">Checked in: {formatDateTime(booking.checkedInAt)}</Text>
            ) : null}
            {booking.checkedOutAt ? (
              <Text variant="bodyMedium">Checked out: {formatDateTime(booking.checkedOutAt)}</Text>
            ) : null}
          </Card.Content>
        </Card>

        <FormErrorBanner message={detail.errorMessage ?? actions.errorMessage} />

        {canRespond || canModifyDates ? (
          <View style={styles.actions}>
            {canRespond ? (
              <>
                <Button
                  accessibilityHint="Accepts this pending pay at lodge booking request."
                  accessibilityLabel={`Accept booking ${booking.bookingCode}`}
                  disabled={isBusy}
                  loading={actions.submittingBookingId === booking.id}
                  mode="contained"
                  onPress={() => {
                    void actions.accept(booking.id);
                  }}
                >
                  Accept Booking
                </Button>
                <Button
                  accessibilityHint="Opens the rejection reason form."
                  accessibilityLabel={`Reject booking ${booking.bookingCode}`}
                  disabled={isBusy}
                  mode="outlined"
                  onPress={() => setRejectVisible(true)}
                >
                  Reject Booking
                </Button>
              </>
            ) : null}
            {canModifyDates ? (
              <Button
                accessibilityHint="Opens a calendar to choose new dates. Availability is checked first."
                accessibilityLabel={`Modify dates for booking ${booking.bookingCode}`}
                disabled={isBusy}
                icon="calendar-edit"
                mode="contained-tonal"
                onPress={() => setDatesVisible(true)}
              >
                Modify Dates
              </Button>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <RejectBookingModal
        bookingCode={booking.bookingCode}
        isSubmitting={actions.submittingBookingId === booking.id}
        visible={rejectVisible}
        onCancel={() => setRejectVisible(false)}
        onConfirm={(reason) => {
          void actions.reject(booking.id, reason);
        }}
      />
      <DateRangeModal
        applyLabel="Change dates"
        hint="Tap the new check-in date, then the new check-out date. Availability is checked before the change is saved."
        initialFrom={booking.checkInDate}
        initialTo={booking.checkOutDate}
        isSubmitting={actions.submittingBookingId === booking.id}
        minDate={toDateKey(new Date())}
        onApply={(from, to) => {
          void actions
            .modifyDates(booking.id, { checkInDate: from, checkOutDate: to })
            .then(() => setDatesVisible(false));
        }}
        onCancel={() => setDatesVisible(false)}
        requireRange
        title="Modify dates"
        visible={datesVisible}
      />
      <Snackbar
        onDismiss={() => actions.setSuccessMessage(null)}
        visible={Boolean(actions.successMessage)}
      >
        {actions.successMessage}
      </Snackbar>
    </View>
  );
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-IN');
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.md,
  },
  card: {
    borderRadius: radius.sm,
  },
  cardContent: {
    gap: spacing.md,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  screen: {
    flexGrow: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
});
