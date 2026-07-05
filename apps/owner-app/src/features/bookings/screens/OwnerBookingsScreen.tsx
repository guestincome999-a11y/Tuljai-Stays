import type { BookingStatus, OwnerBookingSummary } from '@tuljai/types';
import { EmptyState, spacing } from '@tuljai/ui';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Snackbar, Text, useTheme } from 'react-native-paper';

import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
import { OwnerBookingCard } from '../components/OwnerBookingCard';
import { RejectBookingModal } from '../components/RejectBookingModal';
import { useOwnerBookingActions, useOwnerBookings } from '../hooks/useOwnerBookings';

const filters: Array<{ label: string; status: BookingStatus }> = [
  { label: 'Pending', status: 'PENDING_OWNER_APPROVAL' },
  { label: 'Accepted', status: 'ACCEPTED' },
  { label: 'Checked In', status: 'CHECKED_IN' },
  { label: 'Checked Out', status: 'CHECKED_OUT' },
  { label: 'Rejected', status: 'REJECTED' },
  { label: 'Expired', status: 'EXPIRED' },
];

export function OwnerBookingsScreen() {
  const assignedLodges = useAssignedLodges();
  const router = useRouter();
  const theme = useTheme();
  const [activeStatus, setActiveStatus] = useState<BookingStatus>('PENDING_OWNER_APPROVAL');
  const [rejectBooking, setRejectBooking] = useState<OwnerBookingSummary | null>(null);
  const lodgeId = assignedLodges.selectedLodge?.id ?? null;
  const bookings = useOwnerBookings(lodgeId, activeStatus);
  const refresh = useCallback(() => {
    void bookings.refresh();
  }, [bookings]);
  const actions = useOwnerBookingActions(refresh);

  function openBooking(booking: OwnerBookingSummary) {
    router.push({ pathname: '/(app)/bookings/[id]', params: { id: booking.id } });
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.screen}
        refreshControl={
          <RefreshControl
            onRefresh={refresh}
            refreshing={bookings.isRefreshing}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text variant="headlineSmall">Owner Bookings</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
            {assignedLodges.selectedLodge?.name ?? 'No lodge selected'}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filters}>
            {filters.map((filter) => (
              <Button
                key={filter.status}
                mode={activeStatus === filter.status ? 'contained' : 'outlined'}
                onPress={() => setActiveStatus(filter.status)}
              >
                {filter.label}
              </Button>
            ))}
          </View>
        </ScrollView>

        <FormErrorBanner message={bookings.errorMessage ?? actions.errorMessage} />
        {actions.isOffline ? (
          <Text style={{ color: theme.colors.error }} variant="bodyMedium">
            Connect to the internet to complete this action.
          </Text>
        ) : null}

        {bookings.isLoading ? <ActivityIndicator animating size="large" /> : null}

        {!bookings.isLoading && bookings.data.length === 0 ? (
          <EmptyState
            title="No bookings found"
            description="Bookings matching this status will appear here."
            actionLabel="Refresh"
            onActionPress={refresh}
          />
        ) : null}

        <View style={styles.list}>
          {bookings.data.map((booking) => (
            <OwnerBookingCard
              booking={booking}
              isActionDisabled={actions.isOffline || Boolean(actions.submittingBookingId)}
              isSubmitting={actions.submittingBookingId === booking.id}
              key={booking.id}
              onAccept={(item) => {
                void actions.accept(item.id);
              }}
              onOpen={openBooking}
              onReject={setRejectBooking}
            />
          ))}
        </View>
      </ScrollView>

      <RejectBookingModal
        bookingCode={rejectBooking?.bookingCode ?? null}
        isSubmitting={Boolean(rejectBooking && actions.submittingBookingId === rejectBooking.id)}
        visible={Boolean(rejectBooking)}
        onCancel={() => setRejectBooking(null)}
        onConfirm={(reason) => {
          if (rejectBooking) {
            void actions.reject(rejectBooking.id, reason).then((completed) => {
              if (completed) {
                setRejectBooking(null);
              }
            });
          }
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  header: {
    gap: spacing.xs,
  },
  list: {
    gap: spacing.md,
  },
  screen: {
    flexGrow: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
});
