import type { OwnerBookingSummary } from '@tuljai/types';
import { radius, spacing } from '@tuljai/ui';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, Text, useTheme } from 'react-native-paper';

import {
  formatStayRange,
  getPaymentLabel,
  getRoomRequirement,
  getStatusLabel,
} from '../utils/booking-display';

interface OwnerBookingCardProps {
  booking: OwnerBookingSummary;
  onOpen: (booking: OwnerBookingSummary) => void;
}

export const OwnerBookingCard = memo(function OwnerBookingCard({
  booking,
  onOpen,
}: OwnerBookingCardProps) {
  const theme = useTheme();

  return (
    <Card
      accessibilityHint="Opens the full booking details."
      accessibilityLabel={`Booking for ${booking.guestName}, ${formatStayRange(booking)}`}
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
        <Text variant="bodyMedium">{formatStayRange(booking)}</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
          {getRoomRequirement(booking)}
        </Text>
        <Text style={{ color: theme.colors.primary }} variant="labelLarge">
          {getPaymentLabel(booking.paymentStatus)}
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
