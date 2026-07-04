import { radius, spacing } from '@tuljai/ui';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Text, useTheme } from 'react-native-paper';

import { ResilientImage } from '../../../components/ResilientImage';
import type { EnrichedBooking } from '../api/bookings-api';

import { BookingStatusChip, getBookingNextStep } from './BookingStatusChip';

interface BookingCardProps {
  booking: EnrichedBooking;
  onPress: () => void;
}

export function BookingCard({ booking, onPress }: BookingCardProps) {
  const theme = useTheme();

  return (
    <Card mode="outlined" onPress={onPress} style={styles.card}>
      {booking.coverPhotoUrl ? (
        <ResilientImage
          accessibilityLabel={`${booking.lodgeName} booking lodge image`}
          sourceUrl={booking.coverPhotoUrl}
          style={styles.image}
        />
      ) : null}
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
        <View style={styles.badgeRow}>
          {booking.booking.status === 'QR_GENERATED' ? <Chip compact>QR Ready</Chip> : null}
          <Chip compact>{formatDaysRemaining(booking.booking.checkInDate)}</Chip>
        </View>
        <Text variant="bodySmall">
          {getBookingNextStep(booking.booking.status, booking.booking.rejectedReason)}
        </Text>
        <Button
          accessibilityLabel={`Open booking ${booking.booking.bookingCode}`}
          accessibilityHint="Opens booking status, lifecycle, QR pass, and guest details"
          mode="contained-tonal"
          onPress={onPress}
        >
          {booking.booking.status === 'QR_GENERATED' ? 'View QR' : 'View Details'}
        </Button>
      </Card.Content>
    </Card>
  );
}

function formatDaysRemaining(checkInDate: string): string {
  const today = new Date();
  const checkIn = new Date(`${checkInDate}T00:00:00`);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.ceil((checkIn.getTime() - todayStart.getTime()) / 86_400_000);

  if (diffDays <= 0) {
    return 'Today';
  }

  if (diffDays === 1) {
    return 'Tomorrow';
  }

  return `${diffDays} days`;
}

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  content: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  image: {
    aspectRatio: 16 / 8,
    width: '100%',
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
});
