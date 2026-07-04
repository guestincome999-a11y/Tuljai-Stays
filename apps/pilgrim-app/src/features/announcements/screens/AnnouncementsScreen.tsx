import { EmptyState, radius, spacing } from '@tuljai/ui';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Text, useTheme } from 'react-native-paper';

import { useAnnouncements } from '../hooks/useAnnouncements';

export function AnnouncementsScreen() {
  const announcements = useAnnouncements();
  const theme = useTheme();

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void announcements.refresh();
          }}
          refreshing={announcements.isRefreshing}
          tintColor={theme.colors.primary}
        />
      }
    >
      <Text variant="headlineSmall">Announcements</Text>

      {announcements.errorMessage ? (
        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.content}>
            <Text variant="titleMedium">Unable to load announcements</Text>
            <Text variant="bodyMedium">{announcements.errorMessage}</Text>
          </Card.Content>
        </Card>
      ) : null}

      {announcements.isLoading ? <ActivityIndicator animating size="large" /> : null}

      {!announcements.isLoading && announcements.data.length === 0 ? (
        <EmptyState
          title="No announcements"
          description="Temple notices, festival updates, and app messages will appear here."
        />
      ) : null}

      {announcements.data.map((announcement) => {
        const prominent =
          announcement.category === 'EMERGENCY' || announcement.category === 'FESTIVAL';

        return (
          <Card
            key={announcement.id}
            mode={prominent ? 'contained' : 'outlined'}
            style={styles.card}
          >
            <Card.Content style={styles.content}>
              <View style={styles.cardHeader}>
                <Chip compact>{announcement.category.replaceAll('_', ' ')}</Chip>
                <Chip compact>{announcement.priority}</Chip>
              </View>
              <Text variant="titleMedium">{announcement.title}</Text>
              <Text variant="bodyMedium">{announcement.body}</Text>
              <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
                {new Date(announcement.createdAt).toLocaleString()}
              </Text>
              {!announcement.readAt ? (
                <Button
                  mode="contained-tonal"
                  onPress={() => {
                    void announcements.markRead(announcement.id);
                  }}
                >
                  Mark Read
                </Button>
              ) : null}
            </Card.Content>
          </Card>
        );
      })}
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
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  content: {
    gap: spacing.sm,
  },
  screen: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
});
