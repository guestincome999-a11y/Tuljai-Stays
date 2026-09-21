import type { BookingStatus, OwnerBookingSummary } from '@tuljai/types';
import { EmptyState, spacing } from '@tuljai/ui';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Chip, Text, useTheme } from 'react-native-paper';

import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
import { DateRangeModal } from '../components/DateRangeModal';
import { OwnerBookingCard } from '../components/OwnerBookingCard';
import { useOwnerBookings } from '../hooks/useOwnerBookings';
import type { OwnerBookingsFilters } from '../hooks/useOwnerBookings';
import { addDays, formatDateKey, toDateKey } from '../utils/booking-display';

type WhenKey = 'ALL' | 'TODAY' | 'UPCOMING' | 'PAST' | 'CUSTOM';

interface DateRange {
  from: string;
  to: string;
}

const whenFilters: Array<{ key: Exclude<WhenKey, 'CUSTOM'>; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'TODAY', label: 'Today' },
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'PAST', label: 'Past' },
];

const statusFilters: Array<{ label: string; status: BookingStatus | null }> = [
  { label: 'All', status: null },
  { label: 'Pending', status: 'PENDING_OWNER_APPROVAL' },
  { label: 'Accepted / Assigned', status: 'ACCEPTED' },
  { label: 'QR Ready', status: 'QR_GENERATED' },
  { label: 'Checked In', status: 'CHECKED_IN' },
  { label: 'Checked Out', status: 'CHECKED_OUT' },
  { label: 'Completed', status: 'COMPLETED' },
  { label: 'Cancelled', status: 'CANCELLED' },
  { label: 'Rejected', status: 'REJECTED' },
  { label: 'Expired', status: 'EXPIRED' },
  { label: 'No-show', status: 'NO_SHOW' },
];

// The date filter applies to the guest's check-in date.
function resolveFilters(when: WhenKey, customRange: DateRange | null): OwnerBookingsFilters {
  const today = new Date();

  switch (when) {
    case 'TODAY':
      return { checkInFrom: toDateKey(today), checkInTo: toDateKey(today), order: 'asc' };
    case 'UPCOMING':
      return { checkInFrom: toDateKey(addDays(today, 1)), order: 'asc' };
    case 'PAST':
      return { checkInTo: toDateKey(addDays(today, -1)), order: 'desc' };
    case 'CUSTOM':
      return customRange
        ? { checkInFrom: customRange.from, checkInTo: customRange.to, order: 'asc' }
        : {};
    default:
      return {};
  }
}

function formatRange(range: DateRange): string {
  return range.from === range.to
    ? formatDateKey(range.from)
    : `${formatDateKey(range.from)} – ${formatDateKey(range.to)}`;
}

export function OwnerBookingsScreen() {
  const assignedLodges = useAssignedLodges();
  const router = useRouter();
  const theme = useTheme();
  const [when, setWhen] = useState<WhenKey>('ALL');
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [activeStatus, setActiveStatus] = useState<BookingStatus | null>(null);
  const lodgeId = assignedLodges.selectedLodge?.id ?? null;
  const bookings = useOwnerBookings(lodgeId, activeStatus, resolveFilters(when, customRange));
  const refresh = useCallback(() => {
    void bookings.refresh();
  }, [bookings]);

  function openBooking(booking: OwnerBookingSummary) {
    router.push({ pathname: '/(app)/bookings/[id]', params: { id: booking.id } });
  }

  const hasMore = bookings.page < bookings.totalPages;

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
          <Text variant="headlineSmall">Bookings</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
            {assignedLodges.selectedLodge?.name ?? 'No lodge selected'}
          </Text>
        </View>

        <View style={styles.filterGroup}>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="labelMedium">
            Check-in date
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filters}>
              {whenFilters.map((filter) => (
                <Chip
                  key={filter.key}
                  onPress={() => setWhen(filter.key)}
                  selected={when === filter.key}
                >
                  {filter.label}
                </Chip>
              ))}
              <Chip
                icon="calendar-range"
                onPress={() => setPickerVisible(true)}
                selected={when === 'CUSTOM'}
              >
                {when === 'CUSTOM' && customRange ? formatRange(customRange) : 'Pick dates'}
              </Chip>
            </View>
          </ScrollView>
        </View>

        <View style={styles.filterGroup}>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="labelMedium">
            Status
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filters}>
              {statusFilters.map((filter) => (
                <Chip
                  key={filter.label}
                  onPress={() => setActiveStatus(filter.status)}
                  selected={activeStatus === filter.status}
                >
                  {filter.label}
                </Chip>
              ))}
            </View>
          </ScrollView>
        </View>

        <FormErrorBanner message={bookings.errorMessage} />

        {bookings.isLoading ? <ActivityIndicator animating size="large" /> : null}

        {!bookings.isLoading && bookings.data.length > 0 ? (
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
            {bookings.totalItems} {bookings.totalItems === 1 ? 'booking' : 'bookings'}
          </Text>
        ) : null}

        {!bookings.isLoading && bookings.data.length === 0 ? (
          <EmptyState
            title="No bookings found"
            description="Try another date range or status. Bookings matching your filters appear here."
            actionLabel="Refresh"
            onActionPress={refresh}
          />
        ) : null}

        <View style={styles.list}>
          {bookings.data.map((booking) => (
            <OwnerBookingCard booking={booking} key={booking.id} onOpen={openBooking} />
          ))}
        </View>

        {hasMore ? (
          <Button
            disabled={bookings.isLoadingMore}
            loading={bookings.isLoadingMore}
            mode="outlined"
            onPress={() => {
              void bookings.loadMore();
            }}
          >
            Load more
          </Button>
        ) : null}
      </ScrollView>

      <DateRangeModal
        initialFrom={customRange?.from ?? null}
        initialTo={customRange?.to ?? null}
        onApply={(from, to) => {
          setCustomRange({ from, to });
          setWhen('CUSTOM');
          setPickerVisible(false);
        }}
        onCancel={() => setPickerVisible(false)}
        visible={pickerVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterGroup: {
    gap: spacing.xs,
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
