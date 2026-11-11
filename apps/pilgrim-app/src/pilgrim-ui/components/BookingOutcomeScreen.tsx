import type { Booking } from '@tuljai/types';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { paymentTiming } from '../../features/bookings/payment-outcome';
import { AnimatedResultBadge } from '../components';

export function BookingOutcomeScreen({
  success,
  title,
  message,
  busy = false,
  pending = false,
  booking,
  continueLabel,
  onContinue,
  onBack,
}: {
  success: boolean;
  title: string;
  message: string;
  busy?: boolean;
  pending?: boolean;
  booking?: Booking | null;
  continueLabel?: string;
  onContinue: () => void;
  onBack?: () => void;
}) {
  useEffect(() => {
    if (success) paymentTiming('ui_confirmation_rendered', undefined, undefined, booking?.id);
  }, [success, booking?.id]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFCF7', padding: 28 }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
        }}
      >
        {pending ? (
          <Text
            accessibilityLabel="Verification pending"
            style={{ fontSize: 54, color: '#A86A16' }}
          >
            ◷
          </Text>
        ) : (
          <AnimatedResultBadge
            key={success ? 'success' : 'failure'}
            tone={success ? 'success' : 'danger'}
          />
        )}
        <Text
          accessibilityRole="header"
          style={{ fontSize: 30, fontWeight: '800', textAlign: 'center', color: '#292018' }}
        >
          {booking?.status === 'CANCELLED' ? 'Booking cancelled' : title}
        </Text>
        {booking ? (
          <View
            style={{
              width: '100%',
              borderRadius: 18,
              padding: 18,
              backgroundColor: '#FFFFFF',
              borderColor: '#EDDFD1',
              borderWidth: 1,
              gap: 7,
            }}
          >
            <Text style={{ color: '#641C32', fontWeight: '800', fontSize: 17 }}>
              {booking.bookingCode}
            </Text>
            <Text>{booking.lodgeName}</Text>
            <Text>
              {booking.roomTypeName} · 1 room · {booking.totalGuests} guests
            </Text>
            <Text>
              Check-in: {booking.checkInDate}
              {booking.lodgeCheckInTime ? ` · ${booking.lodgeCheckInTime}` : ''}
            </Text>
            <Text>
              Check-out: {booking.checkOutDate}
              {booking.lodgeCheckOutTime ? ` · ${booking.lodgeCheckOutTime}` : ''}
            </Text>
            <Text style={{ fontWeight: '700' }}>
              {booking.paymentStatus === 'FULLY_PAID' ? 'Paid' : 'Total'}: ₹
              {booking.totalAmount ?? '—'}
            </Text>
          </View>
        ) : null}
        <Text
          accessibilityLiveRegion="polite"
          style={{ fontSize: 16, lineHeight: 26, textAlign: 'center', color: '#71665A' }}
        >
          {booking?.status === 'CANCELLED'
            ? 'Your payment is recorded. Open the booking for its current cancellation and refund status.'
            : message}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onContinue}
          style={{
            marginTop: 16,
            minHeight: 56,
            width: '100%',
            borderRadius: 20,
            backgroundColor: pending ? '#8A5C17' : success ? '#16804A' : '#A73535',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '800' }}>
              {continueLabel ??
                (success
                  ? 'View booking'
                  : pending
                    ? 'Check payment status'
                    : 'Retry / check payment')}
            </Text>
          )}
        </Pressable>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onBack}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <Text style={{ color: '#71665A', fontWeight: '700' }}>Back to payment details</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
