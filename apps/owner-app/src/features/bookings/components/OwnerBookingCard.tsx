import type { OwnerBookingSummary } from '@tuljai/types';
import { radius, spacing } from '@tuljai/ui';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Text, useTheme } from 'react-native-paper';

interface OwnerBookingCardProps {
  booking: OwnerBookingSummary;
  isActionDisabled: boolean;
  isSubmitting: boolean;
  onAccept: (booking: OwnerBookingSummary) => void;
  onOpen: (booking: OwnerBookingSummary) => void;
  onReject: (booking: OwnerBookingSummary) => void;
}

export const OwnerBookingCard = memo(function OwnerBookingCard({
  booking,
  isActionDisabled,
  isSubmitting,
  onAccept,
  onOpen,
  onReject,
}: OwnerBookingCardProps) {
  const theme = useTheme();
  const isPending = booking.status === 'PENDING_OWNER_APPROVAL';

  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Content style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text variant="titleMedium">{booking.bookingCode}</Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
              {booking.guestName}
            </Text>
          </View>
          <Chip compact>{formatStatus(booking.status)}</Chip>
        </View>

        <View style={styles.rows}>
          <Text variant="bodyMedium">Guests: {booking.totalGuests}</Text>
          <Text variant="bodyMedium">Room: {booking.roomTypeName}</Text>
          <Text variant="bodyMedium">
            Stay: {booking.checkInDate} to {booking.checkOutDate}
          </Text>
          <Text variant="bodyMedium">
            Request: {booking.specialRequest ?? 'No special request'}
          </Text>
          {booking.ownerResponseDeadline ? (
            <Text style={{ color: theme.colors.primary }} variant="bodySmall">
              Respond by {formatDateTime(booking.ownerResponseDeadline)}
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Button
            accessibilityHint="Opens the booking detail screen."
            accessibilityLabel={`View details for booking ${booking.bookingCode}`}
            mode="contained-tonal"
            onPress={() => onOpen(booking)}
          >
            View Details
          </Button>
          {isPending ? (
            <>
              <Button
                accessibilityHint="Accepts this pending booking request."
                accessibilityLabel={`Accept booking ${booking.bookingCode}`}
                disabled={isActionDisabled}
                loading={isSubmitting}
                mode="contained"
                onPress={() => onAccept(booking)}
              >
                Accept
              </Button>
              <Button
                accessibilityHint="Rejects this booking after entering a reason."
                accessibilityLabel={`Reject booking ${booking.bookingCode}`}
                disabled={isActionDisabled}
                loading={isSubmitting}
                mode="outlined"
                onPress={() => onReject(booking)}
              >
                Reject
              </Button>
            </>
          ) : null}
        </View>
      </Card.Content>
    </Card>
  );
});

function formatStatus(status: string): string {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  });
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    borderRadius: radius.sm,
  },
  content: {
    gap: spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  rows: {
    gap: spacing.xs,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
});
