import { EmptyState, radius, spacing } from '@tuljai/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Snackbar,
  Text,
  useTheme,
} from 'react-native-paper';

import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { listGuestRegisters } from '../../checkin/api/checkin-api';
import { RejectBookingModal } from '../components/RejectBookingModal';
import { useOwnerBookingDetail } from '../hooks/useOwnerBookingDetail';
import { useOwnerBookingActions } from '../hooks/useOwnerBookings';

export function OwnerBookingDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const bookingId = typeof params.id === 'string' ? params.id : null;
  const detail = useOwnerBookingDetail(bookingId);
  const router = useRouter();
  const theme = useTheme();
  const [rejectVisible, setRejectVisible] = useState(false);
  const [registerId, setRegisterId] = useState<string | null>(null);
  const actions = useOwnerBookingActions(() => {
    void detail.refresh();
    setRejectVisible(false);
  });
  const booking = detail.data;

  useEffect(() => {
    if (!booking || !['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'].includes(booking.status)) {
      setRegisterId(null);
      return;
    }

    let mounted = true;
    const bookingCode = booking.bookingCode;

    async function loadRegisterId() {
      const response = await listGuestRegisters({
        bookingCode,
        limit: 1,
        page: 1,
      }).catch(() => null);

      if (mounted) {
        setRegisterId(response?.items[0]?.id ?? null);
      }
    }

    void loadRegisterId();

    return () => {
      mounted = false;
    };
  }, [booking]);

  if (detail.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating size="large" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="Booking unavailable"
          description={detail.errorMessage ?? 'This booking could not be opened.'}
          actionLabel="Retry"
          onActionPress={() => {
            void detail.refresh();
          }}
        />
      </View>
    );
  }

  const isPending = booking.status === 'PENDING_OWNER_APPROVAL';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.screen}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void detail.refresh();
            }}
            refreshing={detail.isRefreshing}
            tintColor={theme.colors.primary}
          />
        }
      >
        <Card mode="contained" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.header}>
              <View style={styles.titleBlock}>
                <Text variant="headlineSmall">{booking.bookingCode}</Text>
                <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
                  {booking.guestName}
                </Text>
              </View>
              <Chip>{formatStatus(booking.status)}</Chip>
            </View>
            <Text variant="bodyMedium">Guests: {booking.totalGuests}</Text>
            <Text variant="bodyMedium">Adults: {booking.numberOfAdults}</Text>
            <Text variant="bodyMedium">Children: {booking.numberOfChildren}</Text>
            <Text variant="bodyMedium">
              Stay: {booking.checkInDate} to {booking.checkOutDate}
            </Text>
            <Text variant="bodyMedium">
              Special Request: {booking.specialRequest ?? 'No special request'}
            </Text>
            {booking.ownerResponseDeadline ? (
              <Text style={{ color: theme.colors.primary }} variant="bodySmall">
                Respond by {new Date(booking.ownerResponseDeadline).toLocaleString('en-IN')}
              </Text>
            ) : null}
          </Card.Content>
        </Card>

        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Privacy</Text>
            {['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'].includes(booking.status) ? (
              <>
                <Text variant="bodyMedium">Phone: {booking.guestPhone ?? 'Not provided'}</Text>
                <Text variant="bodyMedium">
                  Alternate: {booking.alternatePhone ?? 'Not provided'}
                </Text>
                <Text variant="bodyMedium">Address: {booking.guestAddress ?? 'Not provided'}</Text>
                <Text variant="bodyMedium">Guest ID details are available in Guest Register.</Text>
                {registerId ? (
                  <Button
                    accessibilityHint="Opens the verified guest register for this booking."
                    accessibilityLabel={`Open guest register for booking ${booking.bookingCode}`}
                    mode="contained-tonal"
                    onPress={() =>
                      router.push({ pathname: '/(app)/register/[id]', params: { id: registerId } })
                    }
                  >
                    Open Guest Register
                  </Button>
                ) : null}
              </>
            ) : (
              <Text variant="bodyMedium">
                Contact details and ID details remain hidden until QR check-in is completed.
              </Text>
            )}
          </Card.Content>
        </Card>

        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Timeline</Text>
            <Text variant="bodyMedium">Created: {formatDateTime(booking.createdAt)}</Text>
            <Text variant="bodyMedium">Updated: {formatDateTime(booking.updatedAt)}</Text>
            {booking.checkedInAt ? (
              <Text variant="bodyMedium">Checked in: {formatDateTime(booking.checkedInAt)}</Text>
            ) : null}
            {booking.checkedOutAt ? (
              <Text variant="bodyMedium">Checked out: {formatDateTime(booking.checkedOutAt)}</Text>
            ) : null}
          </Card.Content>
        </Card>

        <FormErrorBanner message={detail.errorMessage ?? actions.errorMessage} />

        {isPending ? (
          <View style={styles.actions}>
            <Button
              accessibilityHint="Accepts this pending booking request."
              accessibilityLabel={`Accept booking ${booking.bookingCode}`}
              disabled={actions.isOffline || Boolean(actions.submittingBookingId)}
              loading={actions.submittingBookingId === booking.id}
              mode="contained"
              onPress={() => {
                void actions.accept(booking.id);
              }}
            >
              Accept Booking
            </Button>
            <Button
              accessibilityHint="Opens the rejection reason form."
              accessibilityLabel={`Reject booking ${booking.bookingCode}`}
              disabled={actions.isOffline || Boolean(actions.submittingBookingId)}
              loading={actions.submittingBookingId === booking.id}
              mode="outlined"
              onPress={() => setRejectVisible(true)}
            >
              Reject Booking
            </Button>
          </View>
        ) : null}
      </ScrollView>

      <RejectBookingModal
        bookingCode={booking.bookingCode}
        isSubmitting={actions.submittingBookingId === booking.id}
        visible={rejectVisible}
        onCancel={() => setRejectVisible(false)}
        onConfirm={(reason) => {
          void actions.reject(booking.id, reason);
        }}
      />
      <Snackbar
        onDismiss={() => actions.setSuccessMessage(null)}
        visible={Boolean(actions.successMessage)}
      >
        {actions.successMessage}
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
  actions: {
    gap: spacing.md,
  },
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
