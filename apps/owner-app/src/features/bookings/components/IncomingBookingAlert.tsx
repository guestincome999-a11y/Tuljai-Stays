import type { OwnerBookingSummary } from '@tuljai/types';
import { radius, spacing } from '@tuljai/ui';
import { useEffect } from 'react';
import { Modal, StyleSheet, Vibration, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';

interface IncomingBookingAlertProps {
  booking: OwnerBookingSummary | null;
  isOffline: boolean;
  isSubmitting: boolean;
  onAccept: (booking: OwnerBookingSummary) => void;
  onClose: () => void;
  onReject: (booking: OwnerBookingSummary) => void;
}

export function IncomingBookingAlert({
  booking,
  isOffline,
  isSubmitting,
  onAccept,
  onClose,
  onReject,
}: IncomingBookingAlertProps) {
  const theme = useTheme();

  useEffect(() => {
    if (!booking) {
      Vibration.cancel();
      return undefined;
    }

    Vibration.vibrate([0, 700, 600, 700, 600, 700], false);

    return () => Vibration.cancel();
  }, [booking]);

  if (!booking) {
    return null;
  }

  return (
    <Modal animationType="fade" visible>
      <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
          <Text style={{ color: theme.colors.onPrimary }} variant="labelLarge">
            NEW BOOKING
          </Text>
        </View>

        <View style={styles.details}>
          <Text style={styles.centerText} variant="headlineMedium">
            {booking.bookingCode}
          </Text>
          <Text style={styles.centerText} variant="titleLarge">
            Guest: {booking.guestName}
          </Text>
          <Text style={styles.centerText} variant="titleMedium">
            Guests: {booking.totalGuests}
          </Text>
          <Text style={styles.centerText} variant="titleMedium">
            Room: {booking.roomTypeName}
          </Text>
          <Text style={styles.centerText} variant="bodyLarge">
            Check-in: {booking.checkInDate}
          </Text>
          <Text style={styles.centerText} variant="bodyLarge">
            Check-out:{' '}
            {booking.checkoutDateFlexible
              ? 'Not fixed — confirm with pilgrim'
              : booking.checkOutDate}
          </Text>
          <Text style={styles.centerText} variant="bodyMedium">
            Special Request: {booking.specialRequest ?? 'No special request'}
          </Text>
          {isOffline ? (
            <Text style={{ color: theme.colors.error }} variant="bodyMedium">
              Connect to the internet to complete this action.
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Button
            accessibilityHint="Accepts this pending booking request."
            accessibilityLabel={`Accept booking ${booking.bookingCode}`}
            disabled={isOffline || isSubmitting}
            loading={isSubmitting}
            mode="contained"
            onPress={() => onAccept(booking)}
          >
            Accept
          </Button>
          <Button
            accessibilityHint="Opens the rejection reason flow for this booking."
            accessibilityLabel={`Reject booking ${booking.bookingCode}`}
            disabled={isOffline || isSubmitting}
            loading={isSubmitting}
            mode="outlined"
            onPress={() => onReject(booking)}
          >
            Reject
          </Button>
          <Button
            accessibilityHint="Closes this booking alert without responding."
            accessibilityLabel={`Close booking alert ${booking.bookingCode}`}
            disabled={isSubmitting}
            mode="text"
            onPress={onClose}
          >
            Close
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.md,
    width: '100%',
  },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  centerText: {
    textAlign: 'center',
  },
  details: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  screen: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xl,
    justifyContent: 'center',
    padding: spacing.lg,
  },
});
