import { MaterialCommunityIcons } from '@expo/vector-icons';
import { EmptyState, radius, spacing } from '@tuljai/ui';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Text, useTheme } from 'react-native-paper';

import { useAuth } from '../../../auth/auth-context';
import { useConnectivity } from '../../../connectivity/connectivity-context';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';

const placeholderStats = [
  { label: 'Pending Bookings', value: '0' },
  { label: "Today's Arrivals", value: '0' },
  { label: "Today's Departures", value: '0' },
  { label: 'Available Rooms', value: '0' },
  { label: 'Occupied Rooms', value: '0' },
  { label: 'Scan QR', value: 'Ready' },
];

export function DashboardScreen() {
  const auth = useAuth();
  const assignedLodges = useAssignedLodges();
  const { isOffline } = useConnectivity();
  const router = useRouter();
  const theme = useTheme();
  const displayName = auth.user?.displayName ?? auth.user?.phoneNumber ?? 'Owner';
  const selectedLodge = assignedLodges.selectedLodge;

  if (assignedLodges.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating size="large" />
        <Text variant="bodyMedium">Loading assigned lodge</Text>
      </View>
    );
  }

  if (!selectedLodge) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="No lodge assigned yet"
          description="No lodge assigned yet. Please contact Tuljai Stays admin."
          actionLabel="Retry"
          onActionPress={() => {
            void assignedLodges.refresh();
          }}
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void assignedLodges.refresh();
          }}
          refreshing={assignedLodges.isRefreshing}
          tintColor={theme.colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.greeting}>
          <Text style={{ color: theme.colors.primary }} variant="headlineSmall">
            Namaste
          </Text>
          <Text numberOfLines={1} variant="titleMedium">
            {displayName}
          </Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
            {selectedLodge.name}
          </Text>
        </View>
        <View style={styles.notificationIcon}>
          <MaterialCommunityIcons color={theme.colors.primary} name="bell-outline" size={28} />
        </View>
      </View>

      {assignedLodges.lodges.length > 1 ? (
        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Multiple lodges assigned</Text>
            <Text variant="bodyMedium">
              Lodge selection is prepared and will be expanded in a later owner sequence.
            </Text>
          </Card.Content>
        </Card>
      ) : null}

      {assignedLodges.errorMessage ? (
        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Lodge status</Text>
            <Text variant="bodyMedium">{assignedLodges.errorMessage}</Text>
            <Button
              disabled={isOffline}
              mode="contained-tonal"
              onPress={() => {
                void assignedLodges.refresh();
              }}
            >
              Retry
            </Button>
          </Card.Content>
        </Card>
      ) : null}

      <Card mode="contained" style={styles.statusCard}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">Operational Dashboard</Text>
          <Text variant="bodyMedium">
            Live booking, room, and QR scan metrics will appear after the next owner modules.
          </Text>
          <Text style={{ color: theme.colors.primary }} variant="labelLarge">
            {isOffline ? 'Offline shell available' : 'Online'}
          </Text>
        </Card.Content>
      </Card>

      <View style={styles.statGrid}>
        {placeholderStats.map((item) => (
          <Card key={item.label} mode="outlined" style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <Text style={{ color: theme.colors.primary }} variant="headlineSmall">
                {item.value}
              </Text>
              <Text variant="bodySmall">{item.label}</Text>
            </Card.Content>
          </Card>
        ))}
      </View>

      <View style={styles.actions}>
        <Button
          icon="clipboard-list-outline"
          mode="contained"
          onPress={() => router.push('/(app)/bookings')}
        >
          View Bookings
        </Button>
        <Button
          icon="qrcode-scan"
          mode="contained-tonal"
          onPress={() => router.push('/(app)/scan')}
        >
          Scan QR
        </Button>
        <Button
          icon="bed-outline"
          mode="contained-tonal"
          onPress={() => router.push('/(app)/rooms')}
        >
          Manage Rooms
        </Button>
        <Button disabled icon="chart-box-outline" mode="outlined">
          View Reports
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.md,
  },
  card: {
    borderRadius: radius.sm,
  },
  cardContent: {
    gap: spacing.sm,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  greeting: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  notificationIcon: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  screen: {
    flexGrow: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  statCard: {
    borderRadius: radius.sm,
    flexBasis: '47%',
    flexGrow: 1,
  },
  statContent: {
    gap: spacing.xs,
    minHeight: 96,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statusCard: {
    borderRadius: radius.sm,
  },
});
