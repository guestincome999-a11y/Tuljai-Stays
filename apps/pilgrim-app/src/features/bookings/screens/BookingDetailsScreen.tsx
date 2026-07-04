import { EmptyState, radius, spacing } from '@tuljai/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Text, useTheme } from 'react-native-paper';

import { useConnectivity } from '../../../connectivity/connectivity-context';
import { BookingStatusChip, getBookingNextStep } from '../components/BookingStatusChip';
import { BookingTimeline } from '../components/BookingTimeline';
import { QrPassCard } from '../components/QrPassCard';
import { useBookingDetail, useBookingQr } from '../hooks/useBookings';

export function BookingDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const bookingId = typeof params.id === 'string' ? params.id : null;
  const bookingDetail = useBookingDetail(bookingId);
  const connectivity = useConnectivity();
  const router = useRouter();
  const theme = useTheme();
  const data = bookingDetail.data;
  const directionsQuery = data?.directionsQuery ?? null;
  const qrPass = useBookingQr(
    bookingId,
    data?.booking.status === 'ACCEPTED' || data?.booking.status === 'QR_GENERATED',
  );
  const refreshBookingAndQr = useCallback(() => {
    void Promise.all([bookingDetail.refresh(), qrPass.refresh()]);
  }, [bookingDetail, qrPass]);

  if (bookingDetail.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating size="large" />
      </View>
    );
  }

  if (!data || bookingDetail.errorMessage) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="Booking unavailable"
          description={bookingDetail.errorMessage ?? 'This booking could not be opened.'}
          actionLabel="Retry"
          onActionPress={() => {
            void bookingDetail.refresh();
          }}
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void bookingDetail.refresh();
          }}
          refreshing={bookingDetail.isRefreshing}
          tintColor={theme.colors.primary}
        />
      }
    >
      <Card mode="contained" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.headerRow}>
            <View style={styles.titleBlock}>
              <Text variant="headlineSmall">{data.booking.bookingCode}</Text>
              <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
                {data.lodgeName}
              </Text>
            </View>
            <BookingStatusChip status={data.booking.status} />
          </View>
          <Text variant="bodyMedium">
            Your booking request has been sent to the lodge owner. You will be notified once it is
            accepted or rejected.
          </Text>
        </Card.Content>
      </Card>

      <Card mode="outlined" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">Lifecycle</Text>
          <BookingTimeline booking={data.booking} />
        </Card.Content>
      </Card>

      <QrPassCard
        booking={data.booking}
        errorMessage={qrPass.errorMessage}
        isLoading={qrPass.isLoading || qrPass.isRefreshing}
        isOffline={connectivity.isOffline}
        lodgeName={data.lodgeName}
        metadata={qrPass.data}
        onRefresh={refreshBookingAndQr}
        roomTypeName={data.roomTypeName}
      />

      <CheckInReadinessCard status={data.booking.status} />

      {shouldShowCheckInReminder(data.booking.checkInDate, data.booking.status) ? (
        <Card mode="contained" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Check-in coming soon</Text>
            <Text variant="bodyMedium">
              Your check-in is coming soon. Keep your QR pass and ID ready.
            </Text>
          </Card.Content>
        </Card>
      ) : null}

      <InfoCard
        rows={[
          ['Next step', getBookingNextStep(data.booking.status, data.booking.rejectedReason)],
          ['Room type', data.roomTypeName],
          ['Dates', `${data.booking.checkInDate} to ${data.booking.checkOutDate}`],
          [
            'Guests',
            `${data.booking.numberOfAdults} adults, ${data.booking.numberOfChildren} children`,
          ],
          ['Payment', data.booking.paymentStatus.replaceAll('_', ' ')],
          ['Special request', data.booking.specialRequest ?? 'None'],
        ]}
        title="Booking Details"
      />

      {directionsQuery ? (
        <Button
          icon="directions"
          mode="contained-tonal"
          onPress={() => {
            void openDirections(directionsQuery);
          }}
        >
          Open in Google Maps
        </Button>
      ) : null}

      <InfoCard
        rows={[
          ['Guest', data.booking.guestName],
          ['Mobile', data.booking.guestPhone ?? 'Hidden'],
          ['Alternate mobile', data.booking.alternatePhone ?? 'Not provided'],
          ['Email', data.booking.guestEmail ?? 'Not provided'],
          ['Address', data.booking.guestAddress ?? 'Not provided'],
        ]}
        title="Guest Details"
      />

      {data.booking.ownerResponseDeadline ? (
        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Owner Response</Text>
            <Text variant="bodyMedium">
              Response expected by {new Date(data.booking.ownerResponseDeadline).toLocaleString()}.
            </Text>
          </Card.Content>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button mode="contained" onPress={() => router.push('/(app)/bookings')}>
          View My Bookings
        </Button>
        <Button mode="contained-tonal" onPress={() => router.push('/(app)/lodges')}>
          Browse More Lodges
        </Button>
      </View>
    </ScrollView>
  );
}

async function openDirections(query: string): Promise<void> {
  const encodedQuery = encodeURIComponent(`${query} Tuljapur`);
  await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedQuery}`);
}

function shouldShowCheckInReminder(checkInDate: string, status: string): boolean {
  if (status !== 'ACCEPTED' && status !== 'QR_GENERATED') {
    return false;
  }

  const checkInTime = new Date(`${checkInDate}T00:00:00`).getTime();
  const millisecondsUntilCheckIn = checkInTime - Date.now();

  return millisecondsUntilCheckIn <= 86_400_000 && millisecondsUntilCheckIn > -86_400_000;
}

function CheckInReadinessCard({ status }: { status: string }) {
  const ready = status === 'ACCEPTED' || status === 'QR_GENERATED';
  const pending = status === 'PENDING_OWNER_APPROVAL';
  const rejected = status === 'REJECTED';

  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Content style={styles.cardContent}>
        <Text variant="titleMedium">Check-in Readiness</Text>
        <Text variant="bodyMedium">
          {ready
            ? 'Your room is confirmed. Show this QR code at the lodge reception for faster check-in.'
            : pending
              ? 'Your booking request is waiting for lodge approval.'
              : rejected
                ? 'This booking was not accepted by the lodge. You may browse other available stays.'
                : 'Follow the current booking status before travelling.'}
        </Text>
        {[
          'Booking accepted',
          'QR pass ready',
          'Carry valid ID if required by lodge',
          'Reach lodge before check-in time',
          'Show QR at reception',
        ].map((item) => (
          <Text key={item} variant="bodySmall">
            {item}
          </Text>
        ))}
      </Card.Content>
    </Card>
  );
}

function InfoCard({ rows, title }: { rows: Array<[string, string]>; title: string }) {
  const theme = useTheme();

  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Content style={styles.cardContent}>
        <Text variant="titleMedium">{title}</Text>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.infoRow}>
            <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
              {label}
            </Text>
            <Text style={styles.infoValue} variant="bodyMedium">
              {value}
            </Text>
          </View>
        ))}
      </Card.Content>
    </Card>
  );
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
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  infoRow: {
    gap: spacing.xs,
  },
  infoValue: {
    textTransform: 'none',
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
