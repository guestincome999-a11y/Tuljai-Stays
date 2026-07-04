import type { BookingStatus } from '@tuljai/types';
import { EmptyState, spacing } from '@tuljai/ui';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Chip, Text, useTheme } from 'react-native-paper';

import { BookingCard } from '../components/BookingCard';
import { useMyBookings } from '../hooks/useBookings';

export function MyBookingsScreen() {
  const bookings = useMyBookings();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<BookingFilterKey>('UPCOMING');
  const theme = useTheme();
  const filteredBookings = useMemo(
    () =>
      (bookings.data ?? []).filter((item) =>
        bookingFilterGroups[activeFilter].statuses.includes(item.booking.status),
      ),
    [activeFilter, bookings.data],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        contentContainerStyle={styles.content}
        data={filteredBookings}
        keyExtractor={(item) => item.booking.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="headlineSmall">My Bookings</Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
              Pending, upcoming, completed, cancelled, and rejected stays appear here.
            </Text>
            <View style={styles.filterRow}>
              {bookingFilterOptions.map((filter) => (
                <Chip
                  key={filter.key}
                  mode={activeFilter === filter.key ? 'flat' : 'outlined'}
                  onPress={() => setActiveFilter(filter.key)}
                >
                  {filter.label}
                </Chip>
              ))}
            </View>
            {bookings.errorMessage ? (
              <Card mode="outlined" style={styles.card}>
                <Card.Content style={styles.cardContent}>
                  <Text variant="titleMedium">Unable to load bookings</Text>
                  <Text variant="bodyMedium">{bookings.errorMessage}</Text>
                </Card.Content>
              </Card>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          bookings.isLoading ? (
            <ActivityIndicator animating size="large" />
          ) : (
            <EmptyState
              title="No bookings yet"
              description={bookingFilterGroups[activeFilter].emptyDescription}
              actionLabel="Browse Lodges"
              onActionPress={() => router.push('/(app)/lodges')}
            />
          )
        }
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void bookings.refresh();
            }}
            refreshing={bookings.isRefreshing}
            tintColor={theme.colors.primary}
          />
        }
        renderItem={({ item }) => (
          <BookingCard
            booking={item}
            onPress={() =>
              router.push({ pathname: '/(app)/bookings/[id]', params: { id: item.booking.id } })
            }
          />
        )}
      />
    </View>
  );
}

type BookingFilterKey =
  'UPCOMING' | 'PENDING' | 'ACCEPTED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED';

const bookingFilterGroups: Record<
  BookingFilterKey,
  { emptyDescription: string; statuses: BookingStatus[] }
> = {
  ACCEPTED: {
    emptyDescription: 'Accepted stays and QR-ready bookings will appear here.',
    statuses: ['ACCEPTED', 'QR_GENERATED'],
  },
  CANCELLED: {
    emptyDescription: 'Cancelled, rejected, expired, and no-show bookings will appear here.',
    statuses: ['CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'],
  },
  CHECKED_IN: {
    emptyDescription: 'Checked-in stays will appear here.',
    statuses: ['CHECKED_IN'],
  },
  COMPLETED: {
    emptyDescription: 'Completed stays will appear here.',
    statuses: ['CHECKED_OUT', 'COMPLETED'],
  },
  PENDING: {
    emptyDescription: 'Bookings waiting for lodge approval will appear here.',
    statuses: ['PENDING_OWNER_APPROVAL'],
  },
  UPCOMING: {
    emptyDescription: 'Upcoming accepted or QR-ready stays will appear here.',
    statuses: ['ACCEPTED', 'QR_GENERATED', 'PENDING_OWNER_APPROVAL'],
  },
};

const bookingFilterOptions: Array<{ key: BookingFilterKey; label: string }> = [
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'CHECKED_IN', label: 'Checked In' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled / Rejected' },
];

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
  },
  cardContent: {
    gap: spacing.sm,
  },
  container: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  header: {
    gap: spacing.sm,
  },
});
