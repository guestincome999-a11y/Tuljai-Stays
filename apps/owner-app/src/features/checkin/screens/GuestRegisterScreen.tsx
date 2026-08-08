import type { GuestIdType, GuestRegisterGuest } from '@tuljai/types';
import { EmptyState, radius, spacing } from '@tuljai/ui';
import { File, Paths } from 'expo-file-system';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { useAuth } from '../../../auth/auth-context';
import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { resolveOwnerApiUrl } from '../../../config/api-base-url';
import { useConnectivity } from '../../../connectivity/connectivity-context';
import { downloadGuestIdProof } from '../api/checkin-api';
import { useGuestRegister } from '../hooks/useGuestRegister';

const idTypes: GuestIdType[] = [
  'AADHAAR',
  'PAN',
  'VOTER_ID',
  'PASSPORT',
  'DRIVING_LICENSE',
  'OTHER',
];
const notePresets = ['Late arrival', 'Extra mattress', 'VIP guest', 'Cleaning request'];

export function GuestRegisterScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const registerId = typeof params.id === 'string' ? params.id : null;
  const register = useGuestRegister(registerId);
  const auth = useAuth();
  const { isOffline } = useConnectivity();
  const theme = useTheme();
  const [governmentIdType, setGovernmentIdType] = useState<GuestIdType>('AADHAAR');
  const [governmentIdNumber, setGovernmentIdNumber] = useState('');
  const [documentHolderName, setDocumentHolderName] = useState('');
  const [ownerNotes, setOwnerNotes] = useState('');
  const [proofImageFailed, setProofImageFailed] = useState(false);
  const [isOpeningProof, setIsOpeningProof] = useState(false);

  const guests = useMemo(
    () => (Array.isArray(register.data?.guests) ? register.data.guests : []),
    [register.data],
  );
  const primaryGuest = useMemo(
    () => guests.find((guest) => guest.isPrimaryGuest) ?? guests[0] ?? null,
    [guests],
  );

  useEffect(() => {
    const data = register.data;
    if (!data) {
      return;
    }

    setGovernmentIdType(data.governmentIdType ?? primaryGuest?.idType ?? 'AADHAAR');
    setGovernmentIdNumber(data.governmentIdNumber ?? primaryGuest?.idNumber ?? '');
    setDocumentHolderName(primaryGuest?.fullName ?? data.primaryGuestName);
    setProofImageFailed(false);
  }, [primaryGuest, register.data]);

  if (register.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating size="large" />
      </View>
    );
  }

  if (!register.data) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="Register unavailable"
          description={register.errorMessage ?? 'Guest register could not be opened.'}
          actionLabel="Retry"
          onActionPress={() => {
            void register.refresh();
          }}
        />
      </View>
    );
  }

  const data = register.data;
  const booking = register.booking;
  const notesValue = ownerNotes || data.ownerNotes || '';
  const proofIsImage = primaryGuest?.idProofMimeType?.startsWith('image/') ?? false;
  const proofSource =
    primaryGuest?.idProofAvailable && proofIsImage && auth.session.tokens?.accessToken
      ? {
          headers: { Authorization: `Bearer ${auth.session.tokens.accessToken}` },
          uri: resolveOwnerApiUrl(`/owner/bookings/${data.bookingId}/guest-id-proof`),
        }
      : null;

  async function openUploadedProof() {
    if (!primaryGuest?.idProofAvailable || isOpeningProof) return;

    setIsOpeningProof(true);
    let downloadedFile: File | null = null;
    try {
      const contents = await downloadGuestIdProof(data.bookingId);
      const file = new File(
        Paths.cache,
        safeProofFileName(primaryGuest.idProofOriginalName, primaryGuest.idProofMimeType),
      );
      file.create({ overwrite: true });
      file.write(new Uint8Array(contents));
      downloadedFile = file;

      if (Platform.OS === 'android') {
        try {
          const IntentLauncher = await import('expo-intent-launcher');
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: file.contentUri,
            flags: 1,
            type: primaryGuest.idProofMimeType ?? undefined,
          });
          return;
        } catch {
          // Fall back to the system share sheet when no Android viewer handles the file directly.
        }
      }

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('No document viewer is available');
      }
      await Sharing.shareAsync(file.uri, {
        dialogTitle: 'Open uploaded pilgrim ID',
        mimeType: primaryGuest.idProofMimeType ?? undefined,
      });
    } catch {
      Alert.alert(
        'Could not open document',
        'The uploaded pilgrim ID could not be opened. Please try again.',
      );
    } finally {
      if (downloadedFile?.exists) {
        downloadedFile.delete();
      }
      setIsOpeningProof(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.screen}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void register.refresh();
            }}
            refreshing={register.isRefreshing}
            tintColor={theme.colors.primary}
          />
        }
      >
        <Card mode="contained" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.header}>
              <View style={styles.titleBlock}>
                <Text variant="headlineSmall">{data.registerCode}</Text>
                <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
                  {data.bookingCode}
                </Text>
              </View>
              <Chip icon={data.status === 'CHECKED_IN' ? 'check-circle' : undefined}>
                {formatStatus(data.status)}
              </Chip>
            </View>
            <Text variant="titleMedium">{data.primaryGuestName}</Text>
            <Text variant="titleSmall">Contact: {data.primaryGuestPhone}</Text>
            <Text variant="bodyMedium">
              Guests: {data.numberOfAdults} adults, {data.numberOfChildren} children
            </Text>
            <Text variant="bodyMedium">Room: {data.roomNumber ?? 'Assigned'}</Text>
            <Text variant="bodyMedium">Room Type: {data.roomTypeName ?? 'Room'}</Text>
            <Text variant="bodyMedium">Checked in: {formatDateTime(data.checkInAt)}</Text>
            <Text variant="bodyMedium">
              Expected Checkout:{' '}
              {data.expectedCheckoutAt ? formatDateTime(data.expectedCheckoutAt) : 'Not set'}
            </Text>
          </Card.Content>
        </Card>

        {booking ? (
          <Card mode="outlined" style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.header}>
                <Text variant="titleMedium">Booking & Stay Details</Text>
                <Chip>{formatStatus(booking.status)}</Chip>
              </View>
              <Text variant="bodyMedium">
                Stay: {booking.checkInDate} to{' '}
                {booking.checkoutDateFlexible ? 'Flexible checkout' : booking.checkOutDate}
              </Text>
              <Text variant="bodyMedium">
                Expected arrival: {booking.expectedCheckInTime ?? 'Not provided'}
              </Text>
              <Text variant="bodyMedium">
                Expected departure: {booking.expectedCheckOutTime ?? 'Not provided'}
              </Text>
              <Text variant="bodyMedium">
                Party: {booking.totalGuests} total · {booking.numberOfAdults} adults ·{' '}
                {booking.numberOfChildren} children
              </Text>
              <Text variant="bodyMedium">Payment: {formatStatus(booking.paymentStatus)}</Text>
              <Text variant="bodyMedium">Total: {formatAmount(booking.totalAmount)}</Text>
              <Text variant="bodyMedium">Advance: {formatAmount(booking.advanceAmount)}</Text>
              <Text variant="bodyMedium">Balance: {formatAmount(booking.balanceAmount)}</Text>
              <Text variant="bodyMedium">
                Special request: {booking.specialRequest ?? 'None'}
              </Text>
              {booking.rejectedReason || booking.cancellationReason ? (
                <Text variant="bodyMedium">
                  Status reason: {booking.rejectedReason ?? booking.cancellationReason}
                </Text>
              ) : null}
              <Text variant="bodySmall">
                Booked: {formatDateTime(booking.createdAt)} · Last updated:{' '}
                {formatDateTime(booking.updatedAt)}
              </Text>
            </Card.Content>
          </Card>
        ) : null}

        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Contact & Pilgrim Details</Text>
            <Text variant="bodyMedium">Primary phone: {data.primaryGuestPhone}</Text>
            <Text variant="bodyMedium">
              Alternate phone: {data.alternatePhone ?? 'Not provided'}
            </Text>
            <Text variant="bodyMedium">Email: {data.guestEmail ?? 'Not provided'}</Text>
            <Text variant="bodyMedium">Address: {data.guestAddress ?? 'Not provided'}</Text>
            {guests.length ? (
              guests.map((guest, index) => (
                <GuestDetails key={guest.id} guest={guest} number={index + 1} />
              ))
            ) : (
              <Text variant="bodySmall">
                Detailed pilgrim records are not available for this older register.
              </Text>
            )}
          </Card.Content>
        </Card>

        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.header}>
              <Text variant="titleMedium">Uploaded Pilgrim ID</Text>
              <Chip icon={data.idVerified ? 'check' : 'alert-circle-outline'}>
                {data.idVerified ? 'Verified' : 'Verification pending'}
              </Chip>
            </View>

            {proofSource && !proofImageFailed ? (
              <Image
                accessibilityLabel={`Uploaded ID proof for ${data.primaryGuestName}`}
                resizeMode="contain"
                source={proofSource}
                style={[styles.proofImage, { backgroundColor: theme.colors.surfaceVariant }]}
                onError={() => setProofImageFailed(true)}
              />
            ) : primaryGuest?.idProofAvailable ? (
              <View
                style={[styles.proofFallback, { backgroundColor: theme.colors.surfaceVariant }]}
              >
                <Text variant="titleSmall">
                  {proofImageFailed ? 'ID preview could not be loaded' : 'ID document uploaded'}
                </Text>
                <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
                  {primaryGuest.idProofOriginalName ?? 'Government ID proof'}
                  {primaryGuest.idProofMimeType === 'application/pdf' ? ' (PDF)' : ''}
                </Text>
              </View>
            ) : (
              <Text variant="bodyMedium">No uploaded ID proof is attached to this booking.</Text>
            )}

            <Button
              accessibilityHint="Downloads and opens the pilgrim's uploaded ID document."
              accessibilityLabel={`Open uploaded ID proof for ${data.primaryGuestName}`}
              disabled={!primaryGuest?.idProofAvailable || isOffline || isOpeningProof}
              icon="file-eye-outline"
              loading={isOpeningProof}
              mode="contained"
              onPress={() => {
                void openUploadedProof();
              }}
            >
              Open Uploaded Document
            </Button>

            <View style={styles.chips}>
              {idTypes.map((type) => (
                <Chip
                  key={type}
                  selected={governmentIdType === type}
                  onPress={() => setGovernmentIdType(type)}
                >
                  {formatStatus(type)}
                </Chip>
              ))}
            </View>
            <TextInput
              label="Document holder name"
              mode="outlined"
              value={documentHolderName}
              onChangeText={setDocumentHolderName}
            />
            <TextInput
              label="Government ID number"
              mode="outlined"
              value={governmentIdNumber}
              onChangeText={setGovernmentIdNumber}
            />
            <Button
              accessibilityHint="Marks the guest government ID as checked by reception."
              accessibilityLabel={`Mark ID verified for ${data.primaryGuestName}`}
              disabled={isOffline || register.isSubmitting}
              loading={register.isSubmitting}
              mode="contained-tonal"
              onPress={() => {
                void register.markIdVerified({
                  documentHolderName: documentHolderName || undefined,
                  governmentIdNumber: governmentIdNumber || undefined,
                  governmentIdType,
                });
              }}
            >
              Mark ID Verified
            </Button>
          </Card.Content>
        </Card>

        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Owner Notes</Text>
            <View style={styles.chips}>
              {notePresets.map((note) => (
                <Chip
                  key={note}
                  onPress={() =>
                    setOwnerNotes((current) => [current, note].filter(Boolean).join(', '))
                  }
                >
                  {note}
                </Chip>
              ))}
            </View>
            <TextInput
              label="Notes"
              mode="outlined"
              multiline
              numberOfLines={4}
              value={notesValue}
              onChangeText={setOwnerNotes}
            />
            <Button
              accessibilityHint="Saves private owner notes for this guest register."
              accessibilityLabel={`Save owner notes for ${data.primaryGuestName}`}
              disabled={isOffline || register.isSubmitting}
              loading={register.isSubmitting}
              mode="contained-tonal"
              onPress={() => {
                void register.saveNotes(notesValue);
              }}
            >
              Save Notes
            </Button>
          </Card.Content>
        </Card>

        <FormErrorBanner
          message={
            register.errorMessage ??
            (isOffline ? 'Connect to the internet to update register details.' : null)
          }
        />

        {data.status === 'CHECKED_IN' ? (
          <Button
            accessibilityHint="Marks this guest stay as checked out."
            accessibilityLabel={`Checkout guest ${data.primaryGuestName}`}
            disabled={isOffline || register.isSubmitting}
            loading={register.isSubmitting}
            mode="contained"
            onPress={() => {
              Alert.alert('Confirm Checkout?', 'This will mark the guest as checked out.', [
                { style: 'cancel', text: 'Cancel' },
                {
                  onPress: () => {
                    void register.checkout();
                  },
                  text: 'Confirm Checkout',
                },
              ]);
            }}
          >
            Checkout Guest
          </Button>
        ) : null}
      </ScrollView>

      <Snackbar
        onDismiss={() => register.setSuccessMessage(null)}
        visible={Boolean(register.successMessage)}
      >
        {register.successMessage}
      </Snackbar>
    </View>
  );
}

function GuestDetails({ guest, number }: { guest: GuestRegisterGuest; number: number }) {
  return (
    <View style={styles.guestRow}>
      <Text variant="titleSmall">
        {guest.isPrimaryGuest ? 'Primary pilgrim' : `Pilgrim ${number}`}: {guest.fullName}
      </Text>
      <Text variant="bodySmall">Phone: {guest.phone ?? 'Not provided'}</Text>
      <Text variant="bodySmall">
        {guest.age !== null ? `Age: ${guest.age}` : 'Age not provided'}
        {guest.gender ? ` · ${guest.gender}` : ''}
      </Text>
      <Text variant="bodySmall">
        ID: {guest.idType ? formatStatus(guest.idType) : 'Type not provided'}
        {guest.idNumber ? ` · ${guest.idNumber}` : ''}
      </Text>
      <Text variant="bodySmall">
        ID proof:{' '}
        {guest.idProofOriginalName ?? (guest.idProofAvailable ? 'Uploaded' : 'Not uploaded')}
      </Text>
    </View>
  );
}

function formatStatus(status: string): string {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-IN');
}

function formatAmount(value: string | null): string {
  if (value === null) {
    return 'Not recorded';
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? `₹${amount.toLocaleString('en-IN')}` : value;
}

function safeProofFileName(originalName: string | null, mimeType: string | null): string {
  const fallbackExtension =
    mimeType === 'application/pdf' ? '.pdf' : mimeType === 'image/png' ? '.png' : '.jpg';
  const sanitized = originalName?.replace(/[^a-zA-Z0-9._-]/gu, '_').slice(-120);

  return sanitized && sanitized.includes('.') ? sanitized : `pilgrim-id-proof${fallbackExtension}`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
  },
  cardContent: {
    gap: spacing.md,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  container: {
    flex: 1,
  },
  guestRow: {
    borderTopColor: 'rgba(120, 98, 80, 0.2)',
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  proofFallback: {
    alignItems: 'center',
    borderRadius: radius.sm,
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 150,
    padding: spacing.lg,
  },
  proofImage: {
    borderRadius: radius.sm,
    height: 260,
    width: '100%',
  },
  screen: {
    flexGrow: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
});
