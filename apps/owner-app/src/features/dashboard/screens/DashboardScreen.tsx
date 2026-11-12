import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { OwnerDashboardSummary } from '@tuljai/types';
import { EmptyState } from '@tuljai/ui';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, IconButton, Text, useTheme } from 'react-native-paper';

import { useConnectivity } from '../../../connectivity/connectivity-context';
import { useOwnerApp } from '../../../owner-ui/OwnerAppProvider';
import { ownerColors } from '../../../owner-ui/theme';
import { radius, spacing } from '../../../owner-ui/theme';
import { useRealtime } from '../../../realtime/realtime-provider';
import { useOwnerAnnouncements } from '../../announcements/hooks/useOwnerAnnouncements';
import { OwnerBookingCard } from '../../bookings/components/OwnerBookingCard';
import { useOwnerBookings } from '../../bookings/hooks/useOwnerBookings';
import { getOwnerLodgeDetails } from '../../lodge-management/api/owner-amenities-api';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
import { useUnreadNotificationCount } from '../../notifications/hooks/useOwnerNotifications';
import { useRoomOperations } from '../../rooms/hooks/useRoomOperations';
import { useOwnerDashboardSummary } from '../hooks/useOwnerDashboardSummary';
import { useReceptionSnapshot } from '../hooks/useReceptionSnapshot';

export function DashboardScreen() {
  const assignedLodges = useAssignedLodges();
  const dashboard = useOwnerDashboardSummary();
  const roomBoard = useRoomOperations();
  const recent = useOwnerBookings(assignedLodges.selectedLodge?.id ?? null, null);
  const reception = useReceptionSnapshot();
  const announcements = useOwnerAnnouncements();
  const notifications = useUnreadNotificationCount();
  const { isOffline } = useConnectivity();
  const realtime = useRealtime();
  const router = useRouter();
  const theme = useTheme();
  const { tr } = useOwnerApp();
  const selectedLodge = assignedLodges.selectedLodge;
  const lodgeId = selectedLodge?.id ?? null;
  const [lodgeLocation, setLodgeLocation] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    setLodgeLocation(null);
    if (!lodgeId || isOffline) return;
    void getOwnerLodgeDetails(lodgeId)
      .then((lodge) => {
        if (current && lodge.address) {
          setLodgeLocation([lodge.address.city, lodge.address.state].filter(Boolean).join(', '));
        }
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [isOffline, lodgeId]);
  const stats = getDashboardStats(dashboard.data, tr);
  const cover = roomBoard.photos.find(
    (photo) => photo.isCover && photo.approvalStatus === 'APPROVED',
  );
  const overview = [
    {
      label: tr("Today's Bookings"),
      value: dashboard.data ? String(dashboard.data.todayBookings) : '—',
      icon: 'calendar-check-outline' as const,
    },
    {
      label: tr('Total Rooms'),
      value: roomBoard.isLoading || roomBoard.errorMessage ? '—' : String(roomBoard.rooms.length),
      icon: 'bed-outline' as const,
    },
    {
      label: tr('Pending Requests'),
      value: dashboard.data ? String(dashboard.data.pendingBookings) : '—',
      icon: 'clock-outline' as const,
    },
    {
      label: tr('Estimated Revenue'),
      value: dashboard.data ? `₹${formatMoney(dashboard.data.estimatedRevenue)}` : '—',
      icon: 'cash-multiple' as const,
    },
  ];
  // Bell badge must reflect unread notifications only. Pending bookings is a
  // separate operational metric (shown in its own stat card below) and must
  // never be folded into this count — doing so kept the badge "stuck" at the
  // pending-bookings number even after the owner marked all notifications
  // read, since that number doesn't change on mark-all-read.
  const bellAlertCount = notifications.unreadCount;

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
            void recent.refresh();
            void roomBoard.refresh();
          }}
          refreshing={assignedLodges.isRefreshing || dashboard.isRefreshing || reception.isLoading}
          tintColor={theme.colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.lodgeAvatar}>
          {cover ? (
            <Image
              accessibilityLabel={selectedLodge.name}
              source={{ uri: cover.thumbnailUrl ?? cover.fileUrl }}
              style={{ width: 48, height: 48, borderRadius: 14 }}
            />
          ) : (
            <MaterialCommunityIcons
              color={ownerColors.primary}
              name="home-city-outline"
              size={28}
            />
          )}
        </View>
        <View style={styles.greeting}>
          <Text numberOfLines={1} variant="titleMedium">
            {selectedLodge.name}
          </Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
            {lodgeLocation ?? `${tr('Lodge owner')} · Tuljai Stays`}
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

      <View style={styles.welcomeCard}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ color: '#F2CCD6' }} variant="labelMedium">
            तुळजाई · TULJAI STAYS
          </Text>
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }} variant="titleLarge">
            {tr('Welcome, Owner')}
          </Text>
          <Text style={{ color: '#F9E5EB' }} variant="bodySmall">
            {tr('Your lodge, at a glance.')}
          </Text>
        </View>
        <MaterialCommunityIcons color="#E6B8C5" name="temple-hindu" size={48} />
      </View>

      <View style={styles.statGrid}>
        {overview.map((item) => (
          <Card key={item.label} mode="outlined" style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <MaterialCommunityIcons color={ownerColors.primary} name={item.icon} size={23} />
              <Text style={{ color: ownerColors.text, fontWeight: '700' }} variant="titleLarge">
                {item.value}
              </Text>
              <Text style={{ color: ownerColors.muted }} variant="bodySmall">
                {item.label}
              </Text>
            </Card.Content>
          </Card>
        ))}
      </View>
      <Text style={{ color: ownerColors.muted }} variant="bodySmall">
        {tr(
          assignedLodges.lodges.length > 1
            ? 'Revenue estimate for all dates. Rooms are for this lodge; other totals include all your lodges.'
            : 'Revenue estimate for all dates.',
        )}
      </Text>

      <Text variant="titleMedium">{tr('Quick Actions')}</Text>
      <View style={styles.quickGrid}>
        {(
          [
            {
              label: 'View Bookings',
              icon: 'calendar-check-outline',
              action: () => router.push('/(app)/bookings'),
            },
            {
              label: 'Scan QR',
              icon: 'qrcode-scan',
              action: () => router.push('/(app)/scan'),
            },
            {
              label: 'Room Availability',
              icon: 'bed-outline',
              action: () =>
                router.push({ pathname: '/(app)/rooms', params: { tab: 'AVAILABILITY' } }),
            },
            {
              label: 'Lodge Profile',
              icon: 'home-city-outline',
              action: () => router.push('/(app)/profile'),
            },
          ] as const
        ).map((item) => (
          <Pressable
            accessibilityRole="button"
            key={item.label}
            onPress={item.action}
            android_ripple={{ color: ownerColors.blush }}
            style={styles.quickAction}
          >
            <View style={styles.actionIcon}>
              <MaterialCommunityIcons color={ownerColors.primary} name={item.icon} size={24} />
            </View>
            <Text style={{ textAlign: 'center', width: '100%' }} variant="labelSmall">
              {tr(item.label)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.header}>
        <Text style={{ flex: 1 }} variant="titleMedium">
          {tr('Recent Bookings')}
        </Text>
        <Button onPress={() => router.push('/(app)/bookings')}>{tr('View All')}</Button>
      </View>
      {recent.isLoading ? <ActivityIndicator /> : null}
      {recent.errorMessage ? (
        <Text style={{ color: theme.colors.error }}>{recent.errorMessage}</Text>
      ) : null}
      {!recent.isLoading && !recent.errorMessage && recent.data.length === 0 ? (
        <Text style={{ color: ownerColors.muted }}>{tr('No bookings yet.')}</Text>
      ) : null}
      {recent.data.slice(0, 3).map((booking) => (
        <OwnerBookingCard
          key={booking.id}
          booking={booking}
          onOpen={(item) =>
            router.push({ pathname: '/(app)/bookings/[id]', params: { id: item.id } })
          }
        />
      ))}

      <Text variant="titleMedium">{tr('Reception & Finances')}</Text>
      <View style={styles.statusRow}>
        <Button icon="qrcode-scan" mode="contained" onPress={() => router.push('/(app)/scan')}>
          {tr('Scan QR')}
        </Button>
        <Button
          icon="calendar-clock-outline"
          mode="outlined"
          onPress={() => router.push('/(app)/upcoming')}
        >
          {tr('Upcoming Stays')}
        </Button>
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
            {realtime.connected
              ? tr('Live presence connected')
              : tr('Reconnecting to live presence')}
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

      <View style={styles.financeGrid}>
        <FinanceCard
          accessibilityHint="Opens all bookings that make up your income."
          icon="hand-coin-outline"
          label="Total Income"
          onPress={() => router.push('/(app)/bookings')}
          subtitle="Eligible booking income received by your lodge"
          value={dashboard.data ? formatMoney(dashboard.data.totalIncome) : '—'}
          variant="income"
        />
        <FinanceCard
          accessibilityHint="Opens the commission payment history recorded by Tuljai Stays."
          icon="hand-extended-outline"
          label={tr('Commission Payable')}
          onPress={() =>
            router.push({ pathname: '/(app)/reports', params: { view: 'settlements' } })
          }
          subtitle="Outstanding until Tuljai Stays records settlement"
          value={dashboard.data ? formatMoney(dashboard.data.commissionPayable) : '—'}
          variant="payable"
        />
      </View>

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

      <View style={styles.actions}>
        <Button
          accessibilityHint="Opens arrivals, departures, and guest register summary."
          accessibilityLabel="Open register dashboard"
          icon="book-open-variant"
          mode="contained-tonal"
          onPress={() => router.push('/(app)/register-dashboard')}
        >
          {tr('Register Dashboard')}
        </Button>
        <Button
          accessibilityHint="Opens room status and gallery management."
          accessibilityLabel="Open room management"
          icon="bed-outline"
          mode="contained-tonal"
          onPress={() => router.push('/(app)/rooms')}
        >
          {tr('Manage Rooms')}
        </Button>
      </View>
    </ScrollView>
  );
}

function FinanceCard({
  accessibilityHint,
  icon,
  label,
  onPress,
  subtitle,
  value,
  variant,
}: {
  accessibilityHint: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
  subtitle: string;
  value: string;
  variant: 'income' | 'payable';
}) {
  const colors = variant === 'income' ? financeColors.income : financeColors.payable;

  return (
    <Card
      accessibilityHint={accessibilityHint}
      accessibilityLabel={`${label}, Rs. ${value}`}
      mode="contained"
      onPress={onPress}
      style={[styles.financeCard, { backgroundColor: colors.background }]}
    >
      <Card.Content style={styles.financeContent}>
        <View style={[styles.financeIcon, { backgroundColor: colors.iconBackground }]}>
          <MaterialCommunityIcons color={colors.icon} name={icon} size={27} />
        </View>
        <Text style={[styles.financeLabel, { color: colors.label }]}>{label}</Text>
        <Text style={[styles.financeValue, { color: colors.value }]}>Rs. {value}</Text>
        <Text style={[styles.financeSubtitle, { color: colors.subtitle }]}>{subtitle}</Text>
      </Card.Content>
    </Card>
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
      { label: tr('Pending Bookings'), value: '—' },
      { label: tr("Today's Bookings"), value: '—' },
      { label: tr("Today's Check-ins"), value: '—' },
      { label: tr("Today's Check-outs"), value: '—' },
      { label: tr('Available Rooms'), value: '—' },
      { label: tr('Occupied Rooms'), value: '—' },
      { label: tr('Maintenance'), value: '—' },
      { label: tr('Average Rating'), value: '-' },
      { label: tr('Unread Notifications'), value: '—' },
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
  lodgeAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: ownerColors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeCard: {
    backgroundColor: ownerColors.primary,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  quickAction: {
    width: '23%',
    minWidth: 0,
    minHeight: 108,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: ownerColors.border,
    borderRadius: 12,
    padding: 6,
  },
  actionIcon: { backgroundColor: ownerColors.blush, borderRadius: 12, padding: 10 },
  actions: {
    gap: spacing.md,
  },
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
  financeCard: {
    borderRadius: radius.lg,
    flex: 1,
    minWidth: 130,
  },
  financeContent: {
    gap: spacing.xs,
    minHeight: 160,
  },
  financeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  financeIcon: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  financeLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  financeSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  financeValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 31,
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

const financeColors = {
  income: {
    background: '#FFFFFF',
    icon: ownerColors.primary,
    iconBackground: ownerColors.blush,
    label: ownerColors.text,
    subtitle: ownerColors.muted,
    value: ownerColors.deep,
  },
  payable: {
    background: ownerColors.blush,
    icon: ownerColors.primary,
    iconBackground: '#FFFFFF',
    label: ownerColors.text,
    subtitle: ownerColors.muted,
    value: ownerColors.deep,
  },
} as const;
