import type { GuestIdType } from '@tuljai/types';
import { EmptyState, radius, spacing } from '@tuljai/ui';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
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

import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { useConnectivity } from '../../../connectivity/connectivity-context';
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
  const { isOffline } = useConnectivity();
  const theme = useTheme();
  const [governmentIdType, setGovernmentIdType] = useState<GuestIdType>('AADHAAR');
  const [governmentIdNumber, setGovernmentIdNumber] = useState('');
  const [documentHolderName, setDocumentHolderName] = useState('');
  const [ownerNotes, setOwnerNotes] = useState('');

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
  const notesValue = ownerNotes || data.ownerNotes || '';

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
              <Chip>{formatStatus(data.status)}</Chip>
            </View>
            <Text variant="titleMedium">{data.primaryGuestName}</Text>
            <Text variant="bodyMedium">Phone: {data.primaryGuestPhone}</Text>
            <Text variant="bodyMedium">Alternate: {data.alternatePhone ?? 'Not provided'}</Text>
            <Text variant="bodyMedium">Address: {data.guestAddress ?? 'Not provided'}</Text>
            <Text variant="bodyMedium">
              Guests: {data.numberOfAdults} adults, {data.numberOfChildren} children
            </Text>
            <Text variant="bodyMedium">Room: {data.roomNumber ?? 'Assigned'}</Text>
            <Text variant="bodyMedium">Room Type: {data.roomTypeName ?? 'Room'}</Text>
            <Text variant="bodyMedium">Check-in: {formatDateTime(data.checkInAt)}</Text>
            <Text variant="bodyMedium">
              Expected Checkout:{' '}
              {data.expectedCheckoutAt ? formatDateTime(data.expectedCheckoutAt) : 'Not set'}
            </Text>
          </Card.Content>
        </Card>

        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.header}>
              <Text variant="titleMedium">Guest ID Verification</Text>
              <Chip icon={data.idVerified ? 'check' : 'alert-circle-outline'}>
                {data.idVerified ? 'Verified' : 'Pending'}
              </Chip>
            </View>
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

function formatStatus(status: string): string {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-IN');
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
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
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
