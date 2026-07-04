import { EmptyState, radius, spacing } from '@tuljai/ui';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Text, useTheme } from 'react-native-paper';

import { useNotifications } from '../hooks/useNotifications';

export function NotificationsScreen() {
  const notifications = useNotifications();
  const theme = useTheme();

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
        <Text variant="headlineSmall">Notifications</Text>
        <Button
          mode="contained-tonal"
          onPress={() => {
            void notifications.markAllRead();
          }}
        >
          Mark All Read
        </Button>
      </View>

      {notifications.errorMessage ? (
        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.content}>
            <Text variant="titleMedium">Unable to load notifications</Text>
            <Text variant="bodyMedium">{notifications.errorMessage}</Text>
          </Card.Content>
        </Card>
      ) : null}

      {notifications.isLoading ? <ActivityIndicator animating size="large" /> : null}

      {!notifications.isLoading && notifications.data.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="Booking updates and app messages will appear here."
        />
      ) : null}

      {notifications.data.map((notification) => (
        <Card key={notification.id} mode="outlined" style={styles.card}>
          <Card.Content style={styles.content}>
            <View style={styles.cardHeader}>
              <Chip compact>{notification.type.replaceAll('_', ' ')}</Chip>
              <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
                {new Date(notification.createdAt).toLocaleString()}
              </Text>
            </View>
            <Text variant="titleMedium">{notification.title}</Text>
            <Text variant="bodyMedium">{notification.body}</Text>
            {!notification.readAt ? (
              <Button
                mode="contained-tonal"
                onPress={() => {
                  void notifications.markRead(notification.id);
                }}
              >
                Mark Read
              </Button>
            ) : null}
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  content: {
    gap: spacing.sm,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  screen: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
});
