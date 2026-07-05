import type { Notification, NotificationPriority, NotificationType } from '@tuljai/types';
import { EmptyState, radius, spacing } from '@tuljai/ui';
import { memo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Text, useTheme } from 'react-native-paper';

import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { useConnectivity } from '../../../connectivity/connectivity-context';
import { useOwnerNotifications } from '../hooks/useOwnerNotifications';

const filters: Array<{ label: string; value: NotificationType | null }> = [
  { label: 'All', value: null },
  { label: 'New Booking', value: 'BOOKING_REQUEST' },
  { label: 'Check-in', value: 'CHECKIN_COMPLETED' },
  { label: 'Checkout', value: 'CHECKOUT_COMPLETED' },
  { label: 'Photos', value: 'PHOTO_APPROVED' },
  { label: 'Admin', value: 'ADMIN_ANNOUNCEMENT' },
  { label: 'Emergency', value: 'EMERGENCY_ALERT' },
  { label: 'System', value: 'SYSTEM' },
];

export function OwnerNotificationsScreen() {
  const { isOffline } = useConnectivity();
  const theme = useTheme();
  const [activeType, setActiveType] = useState<NotificationType | null>(null);
  const notifications = useOwnerNotifications(activeType);
  const unreadCount = notifications.data.filter((item) => !item.readAt).length;

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void notifications.refresh();
          }}
          refreshing={notifications.isRefreshing}
          tintColor={theme.colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text variant="headlineSmall">Notifications</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
            {unreadCount} unread
          </Text>
        </View>
        <Button
          accessibilityHint="Marks every visible notification as read."
          accessibilityLabel="Mark all owner notifications as read"
          disabled={isOffline || notifications.isSubmitting || unreadCount === 0}
          mode="contained-tonal"
          onPress={() => {
            void notifications.markAllRead();
          }}
        >
          Mark All Read
        </Button>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filters}>
          {filters.map((filter) => (
            <Button
              key={filter.label}
              mode={activeType === filter.value ? 'contained' : 'outlined'}
              onPress={() => setActiveType(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </View>
      </ScrollView>

      <FormErrorBanner
        message={
          notifications.errorMessage ??
          (isOffline ? 'Notification actions are disabled while offline.' : null)
        }
      />

      {notifications.isLoading ? <ActivityIndicator animating size="large" /> : null}

      {!notifications.isLoading && notifications.data.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="Booking alerts, room updates, photo approvals, and admin messages will appear here."
          actionLabel="Refresh"
          onActionPress={() => {
            void notifications.refresh();
          }}
        />
      ) : null}

      <View style={styles.list}>
        {notifications.data.map((notification) => (
          <NotificationCard
            disabled={isOffline || notifications.isSubmitting}
            key={notification.id}
            notification={notification}
            onDelete={() => {
              void notifications.remove(notification.id);
            }}
            onRead={() => {
              void notifications.markRead(notification.id);
            }}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const NotificationCard = memo(function NotificationCard({
  disabled,
  notification,
  onDelete,
  onRead,
}: {
  disabled: boolean;
  notification: Notification;
  onDelete: () => void;
  onRead: () => void;
}) {
  const theme = useTheme();
  const isUnread = !notification.readAt;

  return (
    <Card
      accessibilityLabel={`${formatType(notification.type)} notification, ${
        isUnread ? 'unread' : 'read'
      }`}
      mode={isUnread ? 'contained' : 'outlined'}
      style={styles.card}
    >
      <Card.Content style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.chips}>
            <Chip compact icon={getPriorityIcon(notification.priority)}>
              {formatPriority(notification.priority)}
            </Chip>
            <Chip compact>{formatType(notification.type)}</Chip>
            {isUnread ? <Chip compact>Unread</Chip> : null}
          </View>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
            {new Date(notification.createdAt).toLocaleString('en-IN')}
          </Text>
        </View>
        <Text variant="titleMedium">{notification.title}</Text>
        <Text variant="bodyMedium">{sanitizePreview(notification.body)}</Text>
        <View style={styles.actions}>
          {isUnread ? (
            <Button disabled={disabled} mode="contained-tonal" onPress={onRead}>
              Mark Read
            </Button>
          ) : null}
          <Button
            accessibilityHint="Removes this notification from the list."
            accessibilityLabel={`Delete notification ${notification.title}`}
            disabled={disabled}
            mode="outlined"
            onPress={onDelete}
          >
            Delete
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
});

function sanitizePreview(value: string): string {
  return value.replace(/\b\d{10}\b/g, '**********');
}

function formatType(value: NotificationType): string {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function formatPriority(priority: NotificationPriority): string {
  if (priority === 'CRITICAL') {
    return 'Critical';
  }

  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

function getPriorityIcon(priority: NotificationPriority): string {
  if (priority === 'CRITICAL' || priority === 'HIGH') {
    return 'alert-circle-outline';
  }

  return 'information-outline';
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    borderRadius: radius.sm,
  },
  cardContent: {
    gap: spacing.sm,
  },
  cardHeader: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  list: {
    gap: spacing.md,
  },
  screen: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
});
