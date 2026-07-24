import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { OwnerDashboardSummary } from '@tuljai/types';
import { EmptyState, radius, spacing } from '@tuljai/ui';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Text, useTheme } from 'react-native-paper';

import { useAuth } from '../../../auth/auth-context';
import { useConnectivity } from '../../../connectivity/connectivity-context';
import { useRealtime } from '../../../realtime/realtime-provider';
import { useOwnerAnnouncements } from '../../announcements/hooks/useOwnerAnnouncements';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
import { useUnreadNotificationCount } from '../../notifications/hooks/useOwnerNotifications';
import { useOwnerDashboardSummary } from '../hooks/useOwnerDashboardSummary';
import { useReceptionSnapshot } from '../hooks/useReceptionSnapshot';

export function DashboardScreen() {
  const auth = useAuth();
  const assignedLodges = useAssignedLodges();
  const dashboard = useOwnerDashboardSummary();
  const reception = useReceptionSnapshot();
  const announcements = useOwnerAnnouncements();
  const notifications = useUnreadNotificationCount();
  const { isOffline } = useConnectivity();
  const realtime = useRealtime();
  const router = useRouter();
  const theme = useTheme();
  const displayName = auth.user?.displayName ?? auth.user?.phoneNumber ?? 'Owner';
  const selectedLodge = assignedLodges.selectedLodge;
  const stats = getDashboardStats(dashboard.data);

  if (assignedLodges.isLoading || dashboard.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating size="large" />
        <Text variant="bodyMedium">Loading owner dashboard</Text>
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
            void dashboard.refresh();
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
            void dashboard.refresh();
            void reception.refresh();
          }}
          refreshing={assignedLodges.isRefreshing || dashboard.isRefreshing || reception.isLoading}
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
          <Text style={{ color: theme.colors.primary }} variant="labelLarge">
            {realtime.connected ? 'Realtime connected' : 'Realtime reconnecting'}
          </Text>
        </View>
        <View style={styles.notificationIcon}>
          <MaterialCommunityIcons color={theme.colors.primary} name="bell-outline" size={28} />
          {notifications.unreadCount ? (
            <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
              <Text style={{ color: theme.colors.onPrimary }} variant="labelSmall">
                {Math.min(notifications.unreadCount, 9)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {announcements.emergencyAnnouncement ? (
        <Card mode="contained" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text style={{ color: theme.colors.primary }} variant="titleMedium">
              Emergency Announcement
            </Text>
            <Text variant="bodyLarge">{announcements.emergencyAnnouncement.title}</Text>
            <Text variant="bodyMedium">{announcements.emergencyAnnouncement.body}</Text>
            <Button mode="contained-tonal" onPress={() => router.push('/(app)/announcements')}>
              View Announcements
            </Button>
          </Card.Content>
        </Card>
      ) : null}

      <Card mode="outlined" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">Owner Status</Text>
          <View style={styles.statusRow}>
            {(['AVAILABLE', 'BUSY', 'OFFLINE'] as const).map((status) => (
              <Button
                accessibilityHint={`Sets owner status to ${formatOwnerStatus(status)} for live presence.`}
                accessibilityLabel={`Set owner status ${formatOwnerStatus(status)}`}
                key={status}
                mode={realtime.ownerStatus === status ? 'contained' : 'outlined'}
                onPress={() => realtime.setOwnerStatus(status)}
              >
                {formatOwnerStatus(status)}
              </Button>
            ))}
          </View>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
            Status is shared through realtime presence. Server-side persistence will be added later.
          </Text>
        </Card.Content>
      </Card>

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

      {assignedLodges.errorMessage || dashboard.errorMessage ? (
        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Dashboard status</Text>
            <Text variant="bodyMedium">
              {assignedLodges.errorMessage ?? dashboard.errorMessage}
            </Text>
            <Button
              disabled={isOffline}
              mode="contained-tonal"
              onPress={() => {
                void assignedLodges.refresh();
                void dashboard.refresh();
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
            Live booking, room, revenue, and commission summary for assigned lodges.
          </Text>
          <Text style={{ color: theme.colors.primary }} variant="labelLarge">
            {isOffline ? 'Offline shell available' : 'Online'}
          </Text>
          {isOffline ? (
            <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
              Server actions such as booking responses, QR scan, checkout, room updates, photo
              upload, and notification read actions are paused until online.
            </Text>
          ) : null}
        </Card.Content>
      </Card>

      <View style={styles.statGrid}>
        {stats.map((item) => (
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

      <Card mode="outlined" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">Reception Snapshot</Text>
          <ReceptionRows title="Today's Check-ins" registers={reception.todayCheckIns} />
          <ReceptionRows title="Today's Check-outs" registers={reception.todayCheckOuts} />
          <ReceptionRows title="Upcoming Check-outs" registers={reception.upcomingCheckOuts} />
        </Card.Content>
      </Card>

    </ScrollView>
  );
}

function ReceptionRows({
  registers,
  title,
}: {
  registers: Array<{
    expectedCheckoutAt: string | null;
    primaryGuestName: string;
    roomNumber: string | null;
  }>;
  title: string;
}) {
  return (
    <View style={styles.receptionBlock}>
      <Text variant="titleSmall">{title}</Text>
      {registers.length === 0 ? <Text variant="bodySmall">No guests yet.</Text> : null}
      {registers.map((register) => (
        <Text
          key={`${title}-${register.primaryGuestName}-${register.roomNumber}`}
          variant="bodySmall"
        >
          {register.primaryGuestName} - Room {register.roomNumber ?? 'Assigned'} -{' '}
          {register.expectedCheckoutAt
            ? new Date(register.expectedCheckoutAt).toLocaleString('en-IN')
            : 'Time not set'}
        </Text>
      ))}
    </View>
  );
}

function getDashboardStats(summary: OwnerDashboardSummary | null): Array<{
  label: string;
  value: string;
}> {
  if (!summary) {
    return [
      { label: 'Pending Bookings', value: '0' },
      { label: "Today's Bookings", value: '0' },
      { label: "Today's Check-ins", value: '0' },
      { label: "Today's Check-outs", value: '0' },
      { label: 'Available Rooms', value: '0' },
      { label: 'Occupied Rooms', value: '0' },
      { label: 'Maintenance', value: '0' },
      { label: 'Estimated Revenue', value: 'Rs. 0' },
      { label: 'Estimated Commission', value: 'Rs. 0' },
      { label: 'Average Rating', value: '-' },
      { label: 'Unread Notifications', value: '0' },
    ];
  }

  return [
    { label: 'Pending Bookings', value: String(summary.pendingBookings) },
    { label: "Today's Bookings", value: String(summary.todayBookings) },
    { label: "Today's Check-ins", value: String(summary.checkedInGuests) },
    { label: "Today's Check-outs", value: String(summary.todayCheckOuts) },
    { label: 'Available Rooms', value: String(summary.availableRooms) },
    { label: 'Occupied Rooms', value: String(summary.occupiedRooms) },
    { label: 'Maintenance', value: String(summary.roomsUnderMaintenance) },
    { label: 'Estimated Revenue', value: `Rs. ${formatMoney(summary.estimatedRevenue)}` },
    { label: 'Estimated Commission', value: `Rs. ${formatMoney(summary.estimatedCommission)}` },
    { label: 'Average Rating', value: summary.averageRating?.toFixed(1) ?? '-' },
    { label: 'Unread Notifications', value: String(summary.recentNotifications.length) },
  ];
}

function formatMoney(value: string): string {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return value;
  }

  return parsed.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatOwnerStatus(status: 'AVAILABLE' | 'BUSY' | 'OFFLINE'): string {
  if (status === 'AVAILABLE') {
    return 'Available';
  }

  if (status === 'BUSY') {
    return 'Busy';
  }

  return 'Offline';
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 20,
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
    position: 'relative',
    width: 48,
  },
  receptionBlock: {
    gap: spacing.xs,
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
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
