import type { OwnerDashboardSummary } from '@tuljai/types';
import { EmptyState, radius, spacing } from '@tuljai/ui';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, IconButton, Text, useTheme } from 'react-native-paper';

import { useAuth } from '../../../auth/auth-context';
import { useConnectivity } from '../../../connectivity/connectivity-context';
import { useOwnerApp } from '../../../owner-ui/OwnerAppProvider';
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
  const { tr } = useOwnerApp();
  const displayName = auth.user?.displayName ?? auth.user?.phoneNumber ?? 'Owner';
  const selectedLodge = assignedLodges.selectedLodge;
  const stats = getDashboardStats(dashboard.data, tr);
  const bellAlertCount = Math.max(notifications.unreadCount, dashboard.data?.pendingBookings ?? 0);

  if (assignedLodges.isLoading || dashboard.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating size="large" />
        <Text variant="bodyMedium">{tr('Loading owner dashboard')}</Text>
      </View>
    );
  }

  if (!selectedLodge) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          title={tr('No lodge assigned yet')}
          description={tr('No lodge assigned yet. Please contact Tuljai Stays admin.')}
          actionLabel={tr('Retry')}
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
            {tr('Namaste')}
          </Text>
          <Text numberOfLines={1} variant="titleMedium">
            {displayName}
          </Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
            {selectedLodge.name}
          </Text>
          <Text style={{ color: theme.colors.primary }} variant="labelLarge">
            {realtime.connected ? tr('Realtime connected') : tr('Realtime reconnecting')}
          </Text>
        </View>
        <View style={styles.notificationIcon}>
          <IconButton
            accessibilityHint="Opens booking alerts and owner notifications."
            accessibilityLabel={`Open notifications, ${bellAlertCount} alerts`}
            icon="bell-outline"
            iconColor={theme.colors.primary}
            size={28}
            onPress={() => router.push('/(app)/notifications')}
          />
          {bellAlertCount ? (
            <View
              pointerEvents="none"
              style={[styles.badge, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={{ color: theme.colors.onPrimary }} variant="labelSmall">
                {Math.min(bellAlertCount, 9)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {announcements.emergencyAnnouncement ? (
        <Card mode="contained" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text style={{ color: theme.colors.primary }} variant="titleMedium">
              {tr('Emergency Announcement')}
            </Text>
            <Text variant="bodyLarge">{announcements.emergencyAnnouncement.title}</Text>
            <Text variant="bodyMedium">{announcements.emergencyAnnouncement.body}</Text>
            <Button mode="contained-tonal" onPress={() => router.push('/(app)/announcements')}>
              {tr('View Announcements')}
            </Button>
          </Card.Content>
        </Card>
      ) : null}

      <Card mode="outlined" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">{tr('Owner Status')}</Text>
          <View style={styles.statusRow}>
            {(['AVAILABLE', 'BUSY', 'OFFLINE'] as const).map((status) => (
              <Button
                accessibilityHint={`Sets owner status to ${formatOwnerStatus(status, tr)} for live presence.`}
                accessibilityLabel={`Set owner status ${formatOwnerStatus(status, tr)}`}
                key={status}
                mode={realtime.ownerStatus === status ? 'contained' : 'outlined'}
                onPress={() => realtime.setOwnerStatus(status)}
              >
                {formatOwnerStatus(status, tr)}
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
            <Text variant="titleMedium">{tr('Dashboard status')}</Text>
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
              {tr('Retry')}
            </Button>
          </Card.Content>
        </Card>
      ) : null}

      <Card mode="contained" style={styles.statusCard}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">{tr('Operational Dashboard')}</Text>
          <Text variant="bodyMedium">
            {tr('Live booking, room, revenue, and commission summary for assigned lodges.')}
          </Text>
          <Text style={{ color: theme.colors.primary }} variant="labelLarge">
            {isOffline ? tr('Offline shell available') : tr('Online')}
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
          <Text variant="titleMedium">{tr('Reception Snapshot')}</Text>
          <ReceptionRows title={tr("Today's Check-ins")} registers={reception.todayCheckIns} />
          <ReceptionRows title={tr("Today's Check-outs")} registers={reception.todayCheckOuts} />
          <ReceptionRows
            title={tr('Upcoming Check-outs')}
            registers={reception.upcomingCheckOuts}
          />
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
  const { tr } = useOwnerApp();
  return (
    <View style={styles.receptionBlock}>
      <Text variant="titleSmall">{title}</Text>
      {registers.length === 0 ? <Text variant="bodySmall">{tr('No guests yet.')}</Text> : null}
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

function getDashboardStats(
  summary: OwnerDashboardSummary | null,
  tr: (english: string) => string,
): Array<{
  label: string;
  value: string;
}> {
  if (!summary) {
    return [
      { label: tr('Pending Bookings'), value: '0' },
      { label: tr("Today's Bookings"), value: '0' },
      { label: tr("Today's Check-ins"), value: '0' },
      { label: tr("Today's Check-outs"), value: '0' },
      { label: tr('Available Rooms'), value: '0' },
      { label: tr('Occupied Rooms'), value: '0' },
      { label: tr('Maintenance'), value: '0' },
      { label: tr('Estimated Revenue'), value: 'Rs. 0' },
      { label: tr('Estimated Commission'), value: 'Rs. 0' },
      { label: tr('Average Rating'), value: '-' },
      { label: tr('Unread Notifications'), value: '0' },
    ];
  }

  return [
    { label: tr('Pending Bookings'), value: String(summary.pendingBookings) },
    { label: tr("Today's Bookings"), value: String(summary.todayBookings) },
    { label: tr("Today's Check-ins"), value: String(summary.checkedInGuests) },
    { label: tr("Today's Check-outs"), value: String(summary.todayCheckOuts) },
    { label: tr('Available Rooms'), value: String(summary.availableRooms) },
    { label: tr('Occupied Rooms'), value: String(summary.occupiedRooms) },
    { label: tr('Maintenance'), value: String(summary.roomsUnderMaintenance) },
    { label: tr('Estimated Revenue'), value: `Rs. ${formatMoney(summary.estimatedRevenue)}` },
    { label: tr('Estimated Commission'), value: `Rs. ${formatMoney(summary.estimatedCommission)}` },
    { label: tr('Average Rating'), value: summary.averageRating?.toFixed(1) ?? '-' },
    { label: tr('Unread Notifications'), value: String(summary.recentNotifications.length) },
  ];
}

function formatMoney(value: string): string {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return value;
  }

  return parsed.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatOwnerStatus(
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE',
  tr: (english: string) => string,
): string {
  if (status === 'AVAILABLE') {
    return tr('Available');
  }

  if (status === 'BUSY') {
    return tr('Busy');
  }

  return tr('Offline');
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
