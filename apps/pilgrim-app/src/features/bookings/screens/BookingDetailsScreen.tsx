import { EmptyState, radius, spacing } from '@tuljai/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Text, useTheme } from 'react-native-paper';

import { BookingStatusChip, getBookingNextStep } from '../components/BookingStatusChip';
import { useBookingDetail } from '../hooks/useBookings';

export function BookingDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const bookingId = typeof params.id === 'string' ? params.id : null;
  const bookingDetail = useBookingDetail(bookingId);
  const router = useRouter();
  const theme = useTheme();
  const data = bookingDetail.data;

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
