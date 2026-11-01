import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { OwnerBookingSummary } from '@tuljai/types';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Modal, ScrollView, StyleSheet, Vibration, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ownerColors, radius, spacing } from '../../../owner-ui/theme';
import { formatCheckOut, formatDateKey, getRoomRequirement } from '../utils/booking-display';

interface IncomingBookingAlertProps {
  booking: OwnerBookingSummary | null;
  errorMessage?: string | null;
  isOffline: boolean;
  isSubmitting: boolean;
  onAccept: (booking: OwnerBookingSummary) => void;
  onClose: () => void;
  onReject: (booking: OwnerBookingSummary) => void;
}

export function IncomingBookingAlert({
  booking,
  errorMessage,
  isOffline,
  isSubmitting,
  onAccept,
  onClose,
  onReject,
}: IncomingBookingAlertProps) {
  useEffect(() => {
    if (!booking) {
      Vibration.cancel();
      return;
    }
    Vibration.vibrate([0, 700, 600, 700, 600, 700], true);
    return () => Vibration.cancel();
  }, [booking]);
  if (!booking) return null;
  const details = [
    {
      icon: 'calendar-arrow-right' as const,
      label: 'Check-in',
      value: `${formatDateKey(booking.checkInDate)}${booking.expectedCheckInTime ? ` · ${booking.expectedCheckInTime}` : ''}`,
    },
    {
      icon: 'calendar-arrow-left' as const,
      label: 'Check-out',
      value: `${formatCheckOut(booking)}${!booking.checkoutDateFlexible && booking.expectedCheckOutTime ? ` · ${booking.expectedCheckOutTime}` : ''}`,
    },
    { icon: 'bed-outline' as const, label: 'Room type', value: getRoomRequirement(booking) },
    {
      icon: 'message-text-outline' as const,
      label: 'Special request',
      value: booking.specialRequest || 'No special request',
    },
  ];
  return (
    <Modal
      animationType="fade"
      visible
      onRequestClose={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heading}>
            <View style={styles.bell}>
              <MaterialCommunityIcons color="#F5D3B0" name="bell-ring-outline" size={44} />
            </View>
            <Text style={styles.headingText} variant="titleLarge">
              New Booking Request!
            </Text>
            <Text style={styles.subtitle}>A guest has booked a room at your lodge.</Text>
            <Text style={styles.subtitle}>Please review and respond.</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.guest}>
              <View style={styles.avatar}>
                <MaterialCommunityIcons color={ownerColors.primary} name="account" size={28} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="titleMedium">{booking.guestName}</Text>
                <Text style={styles.muted} variant="bodySmall">
                  {booking.totalGuests} guests · 1 room
                </Text>
                <Text style={styles.muted} variant="labelSmall">
                  {booking.bookingCode}
                </Text>
              </View>
            </View>
            {details.map((detail) => (
              <View style={styles.row} key={detail.label}>
                <MaterialCommunityIcons color={ownerColors.primary} name={detail.icon} size={20} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.muted} variant="labelSmall">
                    {detail.label}
                  </Text>
                  <Text variant="bodyMedium">{detail.value}</Text>
                </View>
              </View>
            ))}
            {booking.ownerResponseDeadline ? (
              <Text style={styles.muted} variant="bodySmall">
                Respond by {new Date(booking.ownerResponseDeadline).toLocaleString('en-IN')}
              </Text>
            ) : null}
            {isOffline || errorMessage ? (
              <Text accessibilityRole="alert" style={{ color: ownerColors.error }}>
                {isOffline ? 'Connect to the internet to respond.' : errorMessage}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Button
                accessibilityLabel={`Accept booking ${booking.bookingCode}`}
                contentStyle={styles.button}
                disabled={isOffline || isSubmitting}
                loading={isSubmitting}
                mode="contained"
                onPress={() => onAccept(booking)}
                style={styles.buttonShape}
              >
                Accept
              </Button>
              <Button
                accessibilityLabel={`Reject booking ${booking.bookingCode}`}
                contentStyle={styles.button}
                disabled={isOffline || isSubmitting}
                mode="outlined"
                onPress={() => onReject(booking)}
                style={styles.buttonShape}
              >
                Reject
              </Button>
              <Text style={[styles.muted, { textAlign: 'center' }]} variant="bodySmall">
                Your response will be sent to the guest.
              </Text>
            </View>
          </View>
          <Button disabled={isSubmitting} textColor="#FFFFFF" onPress={onClose}>
            Review later
          </Button>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ownerColors.deep },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: 18 },
  heading: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  headingText: { color: '#FFFFFF', fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#F7E2E9', textAlign: 'center' },
  bell: { padding: 14, borderRadius: 40, backgroundColor: '#78182F', marginBottom: 8 },
  card: {
    borderRadius: radius.lg,
    padding: 20,
    gap: 20,
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  guest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ownerColors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ownerColors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  muted: { color: ownerColors.muted },
  actions: { gap: 12, marginTop: 8 },
  button: { minHeight: 48 },
  buttonShape: { borderRadius: 12, borderColor: ownerColors.primary },
});
