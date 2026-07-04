import type { RoomType } from '@tuljai/types';
import { EmptyState, radius, spacing } from '@tuljai/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  HelperText,
  RadioButton,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { useAuth } from '../../../auth/auth-context';
import { useConnectivity } from '../../../connectivity/connectivity-context';
import { useLodgeDetails } from '../../lodges/hooks/useLodgeDiscovery';
import { useBookingRequestFlow } from '../hooks/useBookings';

export function NewBookingScreen() {
  const params = useLocalSearchParams<{ lodgeId?: string; roomTypeId?: string }>();
  const lodgeId = typeof params.lodgeId === 'string' ? params.lodgeId : null;
  const preferredRoomTypeId = typeof params.roomTypeId === 'string' ? params.roomTypeId : null;
  const lodgeDetails = useLodgeDetails(lodgeId);
  const bookingFlow = useBookingRequestFlow();
  const auth = useAuth();
  const connectivity = useConnectivity();
  const router = useRouter();
  const theme = useTheme();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const [checkInDate, setCheckInDate] = useState(today);
  const [checkOutDate, setCheckOutDate] = useState(tomorrow);
  const [adults, setAdults] = useState('1');
  const [children, setChildren] = useState('0');
  const [roomTypeId, setRoomTypeId] = useState(preferredRoomTypeId ?? '');
  const [guestName, setGuestName] = useState(auth.user?.displayName ?? '');
  const [guestPhone, setGuestPhone] = useState(auth.user?.phoneNumber ?? '');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestAddress, setGuestAddress] = useState('');
  const [specialRequest, setSpecialRequest] = useState('');

  const selectedRoomType = useMemo(
    () => lodgeDetails.data?.roomTypes.find((roomType) => roomType.id === roomTypeId) ?? null,
    [lodgeDetails.data?.roomTypes, roomTypeId],
  );
  const availabilityValidationMessage = validateAvailabilityFields({
    adults,
    checkInDate,
    checkOutDate,
    children,
    roomType: selectedRoomType,
    roomTypeId,
  });
  const finalValidationMessage = validateBookingForm({
    adults,
    checkInDate,
    checkOutDate,
    children,
    guestName,
    guestPhone,
    roomType: selectedRoomType,
    roomTypeId,
    specialRequest,
  });
  const canCheckAvailability = !availabilityValidationMessage && !connectivity.isOffline;
  const canSubmit =
    !finalValidationMessage &&
    !connectivity.isOffline &&
    bookingFlow.availability?.available === true &&
    bookingFlow.bookingLock &&
    new Date(bookingFlow.bookingLock.expiresAt).getTime() > Date.now();

  if (lodgeDetails.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating size="large" />
      </View>
    );
  }

  if (!lodgeDetails.data || !lodgeId) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="Booking cannot start"
          description="This lodge is unavailable right now."
          actionLabel="Retry"
          onActionPress={() => {
            void lodgeDetails.refresh();
          }}
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <Text variant="headlineSmall">Check Availability</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
          {lodgeDetails.data.details.name}
        </Text>
      </View>

      {connectivity.isOffline ? (
        <Card mode="outlined" style={styles.card}>
          <Card.Content>
            <Text variant="bodyMedium">You are offline. Booking actions need internet access.</Text>
          </Card.Content>
        </Card>
      ) : null}

      <Card mode="outlined" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">Dates and Guests</Text>
          <TextInput
            label="Check-in date"
            mode="outlined"
            onChangeText={setCheckInDate}
            placeholder="YYYY-MM-DD"
            value={checkInDate}
          />
          <TextInput
            label="Check-out date"
            mode="outlined"
            onChangeText={setCheckOutDate}
            placeholder="YYYY-MM-DD"
            value={checkOutDate}
          />
          <View style={styles.inputRow}>
            <TextInput
              keyboardType="number-pad"
              label="Adults"
              mode="outlined"
              onChangeText={setAdults}
              style={styles.inputHalf}
              value={adults}
            />
            <TextInput
              keyboardType="number-pad"
              label="Children"
              mode="outlined"
              onChangeText={setChildren}
              style={styles.inputHalf}
              value={children}
            />
          </View>
          <Text variant="titleSmall">Room type</Text>
          <RadioButton.Group onValueChange={setRoomTypeId} value={roomTypeId}>
            {lodgeDetails.data.roomTypes.map((roomType) => (
              <RadioButton.Item
                key={roomType.id}
                label={`${roomType.name} · Rs. ${formatPrice(roomType.basePrice)} · ${roomType.capacityAdults} adults`}
                value={roomType.id}
              />
            ))}
          </RadioButton.Group>
          {availabilityValidationMessage ? (
            <HelperText type="error">{availabilityValidationMessage}</HelperText>
          ) : null}
          <Button
            disabled={!canCheckAvailability || bookingFlow.isCheckingAvailability}
            loading={bookingFlow.isCheckingAvailability}
            mode="contained"
            onPress={() => {
              void bookingFlow.runAvailabilityCheck({
                checkInDate,
                checkOutDate,
                lodgeId,
                roomTypeId,
              });
            }}
          >
            Check Availability
          </Button>
          {bookingFlow.availability ? (
            <Text
              style={{
                color: bookingFlow.availability.available
                  ? theme.colors.secondary
                  : theme.colors.error,
              }}
              variant="bodyMedium"
            >
              {bookingFlow.availability.available
                ? `${bookingFlow.availability.availableRoomCount} room(s) available`
                : 'No rooms available for these dates'}
            </Text>
          ) : null}
          {bookingFlow.availability?.available ? (
            <Button
              disabled={bookingFlow.isCreatingLock}
              loading={bookingFlow.isCreatingLock}
              mode="contained-tonal"
              onPress={() => {
                void bookingFlow.runLockCreate({
                  checkInDate,
                  checkOutDate,
                  lodgeId,
                  roomTypeId,
                });
              }}
            >
              Continue Booking
            </Button>
          ) : null}
          {bookingFlow.bookingLock ? (
            <Text variant="bodySmall">
              Room held until {new Date(bookingFlow.bookingLock.expiresAt).toLocaleTimeString()}.
            </Text>
          ) : null}
        </Card.Content>
      </Card>

      {bookingFlow.bookingLock ? (
        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Guest Details</Text>
            <TextInput
              label="Guest full name"
              mode="outlined"
              onChangeText={setGuestName}
              value={guestName}
            />
            <TextInput
              label="Mobile number"
              mode="outlined"
              onChangeText={setGuestPhone}
              placeholder="+919876543210"
              value={guestPhone}
            />
            <TextInput
              label="Alternate mobile"
              mode="outlined"
              onChangeText={setAlternatePhone}
              placeholder="+919876543210"
              value={alternatePhone}
            />
            <TextInput
              label="Email"
              mode="outlined"
              onChangeText={setGuestEmail}
              value={guestEmail}
            />
            <TextInput
              label="Address"
              mode="outlined"
              multiline
              onChangeText={setGuestAddress}
              value={guestAddress}
            />
            <TextInput
              label="Special request"
              mode="outlined"
              multiline
              onChangeText={setSpecialRequest}
              value={specialRequest}
            />
            <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
              Your contact details are shared only according to booking/check-in rules.
            </Text>
            {finalValidationMessage || bookingFlow.errorMessage ? (
              <HelperText type="error">
                {finalValidationMessage ?? bookingFlow.errorMessage}
              </HelperText>
            ) : null}
            <Button
              disabled={!canSubmit || bookingFlow.isCreatingBooking}
              loading={bookingFlow.isCreatingBooking}
              mode="contained"
              onPress={() => {
                void submitBooking();
              }}
            >
              Send Booking Request
            </Button>
          </Card.Content>
        </Card>
      ) : null}
    </ScrollView>
  );

  async function submitBooking() {
    if (!bookingFlow.bookingLock) {
      return;
    }

    const booking = await bookingFlow.runBookingCreate({
      alternatePhone: alternatePhone.trim() ? normalizePhone(alternatePhone) : undefined,
      guestAddress: guestAddress.trim() || undefined,
      guestEmail: guestEmail.trim() || undefined,
      guestName: guestName.trim(),
      guestPhone: normalizePhone(guestPhone),
      lockCode: bookingFlow.bookingLock.lockCode,
      numberOfAdults: Number(adults),
      numberOfChildren: Number(children),
      specialRequest: specialRequest.trim() || undefined,
    });

    if (booking) {
      router.replace({ pathname: '/(app)/bookings/[id]', params: { id: booking.id } });
    }
  }
}

function validateAvailabilityFields(input: {
  adults: string;
  checkInDate: string;
  checkOutDate: string;
  children: string;
  roomType: RoomType | null;
  roomTypeId: string;
}): string | null {
  const adults = Number(input.adults);
  const children = Number(input.children);

  if (!input.checkInDate || !input.checkOutDate) {
    return 'Check-in and check-out dates are required.';
  }

  if (input.checkOutDate <= input.checkInDate) {
    return 'Check-out must be after check-in.';
  }

  if (!input.roomTypeId || !input.roomType) {
    return 'Select a room type.';
  }

  if (!Number.isInteger(adults) || adults < 1) {
    return 'At least one adult is required.';
  }

  if (!Number.isInteger(children) || children < 0) {
    return 'Children count must be zero or more.';
  }

  if (adults > input.roomType.capacityAdults || children > input.roomType.capacityChildren) {
    return 'Guest count exceeds selected room capacity.';
  }

  return null;
}

function validateBookingForm(input: {
  adults: string;
  checkInDate: string;
  checkOutDate: string;
  children: string;
  guestName: string;
  guestPhone: string;
  roomType: RoomType | null;
  roomTypeId: string;
  specialRequest: string;
}): string | null {
  const availabilityMessage = validateAvailabilityFields(input);

  if (availabilityMessage) {
    return availabilityMessage;
  }

  if (!input.guestName.trim()) {
    return 'Guest full name is required.';
  }

  if (!/^\+91[6-9]\d{9}$/.test(normalizePhone(input.guestPhone))) {
    return 'Enter a valid Indian mobile number.';
  }

  if (input.specialRequest.length > 500) {
    return 'Special request must be under 500 characters.';
  }

  return null;
}

function normalizePhone(phone: string): string {
  const compact = phone.replace(/\s/g, '');

  if (/^[6-9]\d{9}$/.test(compact)) {
    return `+91${compact}`;
  }

  return compact;
}

function formatPrice(price: string): string {
  const parsed = Number(price);

  return Number.isFinite(parsed)
    ? parsed.toLocaleString('en-IN', { maximumFractionDigits: 0 })
    : price;
}

const styles = StyleSheet.create({
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
  header: {
    gap: spacing.xs,
  },
  inputHalf: {
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  screen: {
    flexGrow: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
});
