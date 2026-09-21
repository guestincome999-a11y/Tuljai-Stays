import type { OwnerBookingSummary } from '@tuljai/types';
import { radius, spacing } from '@tuljai/ui';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, Text, useTheme } from 'react-native-paper';

import {
  formatCheckOut,
  formatDateKey,
  getPaymentMethodLabel,
  getRoomRequirement,
  getStatusLabel,
} from '../utils/booking-display';

interface OwnerBookingCardProps {
  booking: OwnerBookingSummary;
  onOpen: (booking: OwnerBookingSummary) => void;
}

// Intentionally minimal: no phone, email, WhatsApp, ID documents or address.
export const OwnerBookingCard = memo(function OwnerBookingCard({
  booking,
  onOpen,
}: OwnerBookingCardProps) {
  const theme = useTheme();

  return (
    <Card
      accessibilityHint="Opens the full booking details."
      accessibilityLabel={`Booking for ${booking.guestName}`}
      mode="outlined"
      onPress={() => onOpen(booking)}
      style={styles.card}
    >
      <Card.Content style={styles.content}>
        <View style={styles.header}>
          <Text numberOfLines={1} style={styles.name} variant="titleMedium">
            {booking.guestName}
          </Text>
          <Chip compact>{getStatusLabel(booking)}</Chip>
        </View>
        <Text variant="bodyMedium">Check-in: {formatDateKey(booking.checkInDate)}</Text>
        <Text variant="bodyMedium">Check-out: {formatCheckOut(booking)}</Text>
        <Text style={{ color: theme.colors.primary }} variant="bodyMedium">
          Payment: {getPaymentMethodLabel(booking.paymentStatus)}
        </Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
          Requirement: {getRoomRequirement(booking)}
        </Text>
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
  },
  content: {
    gap: spacing.xs,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  name: {
    flex: 1,
    minWidth: 0,
  },
});
