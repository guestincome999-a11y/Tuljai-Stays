import type { OwnerBookingSummary } from '@tuljai/types';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

import { StatusBadge } from '../../../owner-ui/components';
import { radius, spacing } from '../../../owner-ui/theme';
import { ownerColors } from '../../../owner-ui/theme';
import {
  formatCheckOut,
  formatDateKey,
  getPaymentLabel,
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
          <StatusBadge
            label={getStatusLabel(booking)}
            tone={
              ['CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'].includes(booking.status)
                ? 'danger'
                : booking.status === 'PENDING_OWNER_APPROVAL'
                  ? 'warning'
                  : 'success'
            }
          />
        </View>
        <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
          {booking.bookingCode} · {booking.totalGuests} guests · {getRoomRequirement(booking)}
          {booking.roomNumber ? ` · Room ${booking.roomNumber}` : ''}
        </Text>
        <View style={styles.dates}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: ownerColors.muted }} variant="labelSmall">
              CHECK-IN
            </Text>
            <Text variant="bodySmall">{formatDateKey(booking.checkInDate)}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: ownerColors.muted }} variant="labelSmall">
              CHECK-OUT
            </Text>
            <Text variant="bodySmall">{formatCheckOut(booking)}</Text>
          </View>
        </View>
        <View style={styles.header}>
          <Text style={{ flex: 1, fontWeight: '700' }} variant="titleMedium">
            {booking.totalAmount === null
              ? 'Amount not recorded'
              : `₹${formatMoney(booking.totalAmount)}`}
          </Text>
          <Text
            style={{
              color: ['FULLY_PAID', 'ADVANCE_PAID'].includes(booking.paymentStatus)
                ? ownerColors.success
                : theme.colors.primary,
              flexShrink: 1,
              textAlign: 'right',
            }}
            variant="bodySmall"
          >
            {getPaymentLabel(booking.paymentStatus)}
          </Text>
        </View>
        {Number(booking.commissionOutstandingAmount ?? 0) > 0 ? (
          <Text style={[styles.commission, { color: theme.colors.primary }]} variant="labelMedium">
            Commission due - Rs. {formatMoney(booking.commissionOutstandingAmount ?? null)}
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surface,
  },
  dates: {
    flexDirection: 'row',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ownerColors.border,
    paddingVertical: 8,
    marginBottom: 4,
  },
  content: {
    gap: spacing.xs,
  },
  commission: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  name: {
    flex: 1,
    minWidth: 0,
  },
});

function formatMoney(value: string | null): string {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString('en-IN', { maximumFractionDigits: 2 })
    : '0';
}
