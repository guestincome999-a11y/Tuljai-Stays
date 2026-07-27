import type { Notification, NotificationPriority, NotificationType } from '@tuljai/types';
import { EmptyState, radius, spacing } from '@tuljai/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Snackbar,
  Text,
  useTheme,
} from 'react-native-paper';

import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { useConnectivity } from '../../../connectivity/connectivity-context';
import { OwnerBookingCard } from '../../bookings/components/OwnerBookingCard';
import { RejectBookingModal } from '../../bookings/components/RejectBookingModal';
import { useOwnerBookingActions, useOwnerBookings } from '../../bookings/hooks/useOwnerBookings';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
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

interface RejectBookingTarget {
  bookingCode: string | null;
  bookingId: string;
  notificationId: string | null;
}

export function OwnerNotificationsScreen() {
  const params = useLocalSearchParams<{
    actionResult?: string;
    bookingId?: string;
  }>();
  const { isOffline } = useConnectivity();
  const router = useRouter();
  const theme = useTheme();
  const assignedLodges = useAssignedLodges();
  const [activeType, setActiveType] = useState<NotificationType | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RejectBookingTarget | null>(null);
  const [resolvedNotificationIds, setResolvedNotificationIds] = useState<string[]>([]);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const notifications = useOwnerNotifications(activeType);
  const pendingBookings = useOwnerBookings(
    assignedLodges.selectedLodge?.id ?? null,
    'PENDING_OWNER_APPROVAL',
  );
  const actions = useOwnerBookingActions(() => {
    void notifications.refresh();
    void pendingBookings.refresh();
  });
  const unreadCount = notifications.data.filter((item) => !item.readAt).length;
  const showPendingBookings = activeType === null || activeType === 'BOOKING_REQUEST';
  const displayedNotifications = useMemo(() => {
    const requestedBookingId = typeof params.bookingId === 'string' ? params.bookingId : null;

    if (!requestedBookingId) {
      return notifications.data;
    }

    return [...notifications.data].sort((left, right) => {
      if (left.bookingId === requestedBookingId) return -1;
      if (right.bookingId === requestedBookingId) return 1;
      return 0;
    });
  }, [notifications.data, params.bookingId]);

  useEffect(() => {
    if (params.actionResult === 'accepted') {
      setResultMessage('Booking accepted successfully.');
    } else if (params.actionResult === 'rejected') {
      setResultMessage('Booking rejected successfully.');
    } else if (params.actionResult === 'failed') {
      setResultMessage('The booking response could not be completed. Please check its status.');
    }
  }, [params.actionResult]);

  useEffect(() => {
    if (
      (params.actionResult !== 'accepted' && params.actionResult !== 'rejected') ||
      typeof params.bookingId !== 'string'
    ) {
      return;
    }

    const matchingIds = notifications.data
      .filter((notification) => notification.bookingId === params.bookingId)
      .map((notification) => notification.id);

    setResolvedNotificationIds((current) => [...new Set([...current, ...matchingIds])]);
  }, [notifications.data, params.actionResult, params.bookingId]);

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void notifications.refresh();
            void pendingBookings.refresh();
          }}
          refreshing={notifications.isRefreshing || pendingBookings.isRefreshing}
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
          actions.errorMessage ??
          pendingBookings.errorMessage ??
          notifications.errorMessage ??
          (isOffline ? 'Notification actions are disabled while offline.' : null)
        }
      />

      {showPendingBookings ? (
        <View style={styles.pendingSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleBlock}>
              <Text variant="titleLarge">Pending booking requests</Text>
              <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
                Accept or reject requests directly from the bell screen.
              </Text>
            </View>
            <Chip compact icon="bell-ring-outline">
              {pendingBookings.totalItems}
            </Chip>
          </View>

          {pendingBookings.isLoading ? <ActivityIndicator animating size="small" /> : null}

          {!pendingBookings.isLoading && pendingBookings.data.length === 0 ? (
            <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
              No pending booking requests.
            </Text>
          ) : null}

          <View style={styles.list}>
            {pendingBookings.data.map((booking) => (
              <OwnerBookingCard
                booking={booking}
                isActionDisabled={isOffline || actions.submittingBookingId === booking.id}
                isSubmitting={actions.submittingBookingId === booking.id}
                key={booking.id}
                onAccept={(selectedBooking) => {
                  void actions.accept(selectedBooking.id).then((completed) => {
                    if (completed) {
                      setResultMessage('Booking accepted successfully.');
                    }
                  });
                }}
                onOpen={(selectedBooking) => {
                  router.push({
                    pathname: '/(app)/bookings/[id]',
                    params: { id: selectedBooking.id },
                  });
                }}
                onReject={(selectedBooking) =>
                  setRejectTarget({
                    bookingCode: selectedBooking.bookingCode,
                    bookingId: selectedBooking.id,
                    notificationId: null,
                  })
                }
              />
            ))}
          </View>
        </View>
      ) : null}

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
        {displayedNotifications.map((notification) => (
          <NotificationCard
            disabled={
              isOffline ||
              notifications.isSubmitting ||
              actions.submittingBookingId === notification.bookingId
            }
            key={notification.id}
            notification={notification}
            responded={
              resolvedNotificationIds.includes(notification.id) ||
              hasBookingBeenResponded(notification)
            }
            onAccept={() => {
              if (!notification.bookingId) {
                return;
              }

              void actions.accept(notification.bookingId).then((completed) => {
                if (completed) {
                  setResolvedNotificationIds((current) => [...current, notification.id]);
                  setResultMessage('Booking accepted successfully.');
                  void notifications.markRead(notification.id);
                }
              });
            }}
            onDelete={() => {
              void notifications.remove(notification.id);
            }}
            onRead={() => {
              void notifications.markRead(notification.id);
            }}
            onReject={() => {
              if (notification.bookingId) {
                setRejectTarget({
                  bookingCode:
                    typeof notification.data?.bookingCode === 'string'
                      ? notification.data.bookingCode
                      : null,
                  bookingId: notification.bookingId,
                  notificationId: notification.id,
                });
              }
            }}
            onViewBooking={() => {
              if (notification.bookingId) {
                void notifications.markRead(notification.id);
                router.push({
                  pathname: '/(app)/bookings/[id]',
                  params: { id: notification.bookingId },
                });
              }
            }}
          />
        ))}
      </View>

      <RejectBookingModal
        bookingCode={rejectTarget?.bookingCode ?? null}
        isSubmitting={Boolean(
          rejectTarget && actions.submittingBookingId === rejectTarget.bookingId,
        )}
        visible={Boolean(rejectTarget)}
        onCancel={() => setRejectTarget(null)}
        onConfirm={(reason) => {
          if (!rejectTarget) {
            return;
          }

          const currentTarget = rejectTarget;
          void actions.reject(currentTarget.bookingId, reason).then((completed) => {
            if (completed) {
              if (currentTarget.notificationId) {
                setResolvedNotificationIds((current) => [
                  ...current,
                  currentTarget.notificationId as string,
                ]);
                void notifications.markRead(currentTarget.notificationId);
              }
              setRejectTarget(null);
              setResultMessage('Booking rejected successfully.');
            }
          });
        }}
      />

      <Snackbar onDismiss={() => setResultMessage(null)} visible={Boolean(resultMessage)}>
        {resultMessage}
      </Snackbar>
    </ScrollView>
  );
}

const NotificationCard = memo(function NotificationCard({
  disabled,
  notification,
  responded,
  onAccept,
  onDelete,
  onRead,
  onReject,
  onViewBooking,
}: {
  disabled: boolean;
  notification: Notification;
  responded: boolean;
  onAccept: () => void;
  onDelete: () => void;
  onRead: () => void;
  onReject: () => void;
  onViewBooking: () => void;
}) {
  const theme = useTheme();
  const isUnread = !notification.readAt;
  const isBookingRequest = notification.type === 'BOOKING_REQUEST' && notification.bookingId;

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
            {responded ? (
              <Chip compact icon="check">
                Responded
              </Chip>
            ) : null}
          </View>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
            {new Date(notification.createdAt).toLocaleString('en-IN')}
          </Text>
        </View>
        <Text variant="titleMedium">{notification.title}</Text>
        <Text variant="bodyMedium">{sanitizePreview(notification.body)}</Text>
        <View style={styles.actions}>
          {isBookingRequest && !responded ? (
            <>
              <Button disabled={disabled} mode="contained" onPress={onAccept}>
                Accept Booking
              </Button>
              <Button disabled={disabled} mode="outlined" onPress={onReject}>
                Reject Booking
              </Button>
            </>
          ) : null}
          {notification.bookingId ? (
            <Button disabled={disabled} mode="contained-tonal" onPress={onViewBooking}>
              View Booking
            </Button>
          ) : null}
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

function hasBookingBeenResponded(notification: Notification): boolean {
  const status = notification.data?.bookingStatus;

  return (
    notification.type === 'BOOKING_REQUEST' &&
    typeof status === 'string' &&
    status !== 'PENDING_OWNER_APPROVAL'
  );
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
  pendingSection: {
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
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
});
