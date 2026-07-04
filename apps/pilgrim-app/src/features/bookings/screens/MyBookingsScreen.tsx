import { EmptyState, spacing } from '@tuljai/ui';
import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Text, useTheme } from 'react-native-paper';

import { BookingCard } from '../components/BookingCard';
import { useMyBookings } from '../hooks/useBookings';

export function MyBookingsScreen() {
  const bookings = useMyBookings();
  const router = useRouter();
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        contentContainerStyle={styles.content}
        data={bookings.data ?? []}
        keyExtractor={(item) => item.booking.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="headlineSmall">My Bookings</Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
              Pending, upcoming, completed, cancelled, and rejected stays appear here.
            </Text>
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
              description="Your booking requests will appear here after you send them."
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
  header: {
    gap: spacing.sm,
  },
});
