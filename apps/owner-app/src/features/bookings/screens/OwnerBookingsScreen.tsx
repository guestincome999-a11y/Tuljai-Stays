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
type PaymentFilter = 'PAY_AT_LODGE' | 'PREPAID' | null;

interface DateRange {
  from: string;
  to: string;
}

const whenFilters: Array<{ key: Exclude<WhenKey, 'CUSTOM'>; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'TODAY', label: 'Today' },
  { key: 'UPCOMING', label: 'Upcoming / Active' },
  { key: 'PAST', label: 'Past' },
];

const paymentFilters: Array<{ label: string; value: PaymentFilter }> = [
  { label: 'All', value: null },
  { label: 'Pay at Lodge', value: 'PAY_AT_LODGE' },
  { label: 'Prepaid', value: 'PREPAID' },
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

// Today = guests arriving or staying today. Upcoming / Active = stays that have not
// ended yet (includes guests currently staying). Past = stays that have ended.
// A picked range filters on the guest's check-in date.
function resolveFilters(
  when: WhenKey,
  customRange: DateRange | null,
  payment: PaymentFilter,
): OwnerBookingsFilters {
  const today = new Date();
  const paymentFilter = payment ? { payment } : {};

  switch (when) {
    case 'TODAY':
      return { ...paymentFilter, date: toDateKey(today) };
    case 'UPCOMING':
      return { ...paymentFilter, checkOutFrom: toDateKey(today), order: 'asc' };
    case 'PAST':
      return { ...paymentFilter, checkOutTo: toDateKey(addDays(today, -1)), order: 'desc' };
    case 'CUSTOM':
      return customRange
        ? {
            ...paymentFilter,
            checkInFrom: customRange.from,
            checkInTo: customRange.to,
            order: 'asc',
          }
        : paymentFilter;
    default:
      return paymentFilter;
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
  const [payment, setPayment] = useState<PaymentFilter>(null);
  const [activeStatus, setActiveStatus] = useState<BookingStatus | null>(null);
  const lodgeId = assignedLodges.selectedLodge?.id ?? null;
  const bookings = useOwnerBookings(
    lodgeId,
    activeStatus,
    resolveFilters(when, customRange, payment),
  );
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
            Dates
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
            Payment
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filters}>
              {paymentFilters.map((filter) => (
                <Chip
                  key={filter.label}
                  onPress={() => setPayment(filter.value)}
                  selected={payment === filter.value}
                >
                  {filter.label}
                </Chip>
              ))}
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
            description="Try other dates, payment or status filters."
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
        title="Choose check-in dates"
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
