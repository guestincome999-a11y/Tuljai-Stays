import type { BookingStatus, OwnerBookingSummary } from '@tuljai/types';
import { EmptyState, spacing } from '@tuljai/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';

import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
import { OwnerBookingCard } from '../components/OwnerBookingCard';
import { useOwnerBookings } from '../hooks/useOwnerBookings';

const historyFilters: Array<{ label: string; status: BookingStatus }> = [
  { label: 'Completed', status: 'COMPLETED' },
  { label: 'Checked out', status: 'CHECKED_OUT' },
  { label: 'Cancelled', status: 'CANCELLED' },
  { label: 'Rejected', status: 'REJECTED' },
  { label: 'Expired', status: 'EXPIRED' },
  { label: 'No-show', status: 'NO_SHOW' },
];

export function PreviousBookingsScreen() {
  const assignedLodges = useAssignedLodges();
  const [activeStatus, setActiveStatus] = useState<BookingStatus>('COMPLETED');
  const router = useRouter();
  const theme = useTheme();
  const lodgeId = assignedLodges.selectedLodge?.id ?? null;
  const bookings = useOwnerBookings(lodgeId, activeStatus);

  function openBooking(booking: OwnerBookingSummary) {
    router.push({ pathname: '/(app)/bookings/[id]', params: { id: booking.id } });
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void bookings.refresh();
          }}
          refreshing={bookings.isRefreshing}
          tintColor={theme.colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Button compact icon="arrow-left" mode="text" onPress={() => router.back()}>
          Profile
        </Button>
        <Text variant="headlineSmall">Previous Bookings</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
          {assignedLodges.selectedLodge?.name ?? 'No lodge selected'}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filters}>
          {historyFilters.map((filter) => (
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

      <FormErrorBanner message={bookings.errorMessage} />
      {bookings.isLoading ? <ActivityIndicator animating size="large" /> : null}

      {!bookings.isLoading && bookings.data.length === 0 ? (
        <EmptyState
          title={`No ${formatStatus(activeStatus)} bookings`}
          description="Past bookings with this status will appear here."
          actionLabel="Refresh"
          onActionPress={() => {
            void bookings.refresh();
          }}
        />
      ) : null}

      <View style={styles.list}>
        {bookings.data.map((booking) => (
          <OwnerBookingCard
            booking={booking}
            isActionDisabled
            isSubmitting={false}
            key={booking.id}
            onAccept={() => undefined}
            onOpen={openBooking}
            onReject={() => undefined}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function formatStatus(status: string): string {
  return status
    .split('_')
    .map((part) => part.toLowerCase())
    .join(' ');
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  header: {
    alignItems: 'flex-start',
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
