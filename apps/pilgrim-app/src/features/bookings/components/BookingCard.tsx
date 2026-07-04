import { radius, spacing } from '@tuljai/ui';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text, useTheme } from 'react-native-paper';

import type { EnrichedBooking } from '../api/bookings-api';

import { BookingStatusChip } from './BookingStatusChip';

interface BookingCardProps {
  booking: EnrichedBooking;
  onPress: () => void;
}

export function BookingCard({ booking, onPress }: BookingCardProps) {
  const theme = useTheme();

  return (
    <Card mode="outlined" onPress={onPress} style={styles.card}>
      <Card.Content style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text variant="titleMedium">{booking.booking.bookingCode}</Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
              {booking.lodgeName}
            </Text>
          </View>
          <BookingStatusChip status={booking.booking.status} />
        </View>
        <Text variant="bodyMedium">{booking.roomTypeName}</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
          {booking.booking.checkInDate} to {booking.booking.checkOutDate} ·{' '}
          {booking.booking.totalGuests} guests
        </Text>
        <Button mode="contained-tonal" onPress={onPress}>
          View Details
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
  },
  content: {
    gap: spacing.sm,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
});
