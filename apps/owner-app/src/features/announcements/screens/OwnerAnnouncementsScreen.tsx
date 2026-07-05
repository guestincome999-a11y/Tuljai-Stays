import type { Announcement, AnnouncementCategory } from '@tuljai/types';
import { EmptyState, radius, spacing } from '@tuljai/ui';
import { memo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Text, useTheme } from 'react-native-paper';

import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { useConnectivity } from '../../../connectivity/connectivity-context';
import { useOwnerAnnouncements } from '../hooks/useOwnerAnnouncements';

const categories: Array<{ label: string; value: AnnouncementCategory | null }> = [
  { label: 'All', value: null },
  { label: 'General', value: 'GENERAL' },
  { label: 'Emergency', value: 'EMERGENCY' },
  { label: 'Temple', value: 'TEMPLE_NOTICE' },
  { label: 'Festival', value: 'FESTIVAL' },
  { label: 'Maintenance', value: 'MAINTENANCE' },
  { label: 'Offer', value: 'OFFER' },
  { label: 'System', value: 'SYSTEM' },
];

export function OwnerAnnouncementsScreen() {
  const { isOffline } = useConnectivity();
  const theme = useTheme();
  const [activeCategory, setActiveCategory] = useState<AnnouncementCategory | null>(null);
  const announcements = useOwnerAnnouncements(activeCategory);

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
      <View style={styles.header}>
        <Text variant="headlineSmall">Admin Announcements</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
          Temple, festival, and operations notices
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filters}>
          {categories.map((category) => (
            <Button
              key={category.label}
              mode={activeCategory === category.value ? 'contained' : 'outlined'}
              onPress={() => setActiveCategory(category.value)}
            >
              {category.label}
            </Button>
          ))}
        </View>
      </ScrollView>

      <FormErrorBanner
        message={
          announcements.errorMessage ??
          (isOffline ? 'Announcements need internet access to refresh.' : null)
        }
      />

      {announcements.isLoading ? <ActivityIndicator animating size="large" /> : null}

      {!announcements.isLoading && announcements.data.length === 0 ? (
        <EmptyState
          title="No announcements"
          description="Admin alerts and temple updates will appear here."
          actionLabel="Refresh"
          onActionPress={() => {
            void announcements.refresh();
          }}
        />
      ) : null}

      <View style={styles.list}>
        {announcements.data.map((announcement) => (
          <AnnouncementCard
            announcement={announcement}
            disabled={isOffline}
            key={announcement.id}
            onRead={() => {
              void announcements.markRead(announcement.id);
            }}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const AnnouncementCard = memo(function AnnouncementCard({
  announcement,
  disabled,
  onRead,
}: {
  announcement: Announcement;
  disabled: boolean;
  onRead: () => void;
}) {
  const theme = useTheme();
  const prominent =
    announcement.category === 'EMERGENCY' ||
    announcement.category === 'FESTIVAL' ||
    announcement.priority === 'CRITICAL';

  return (
    <Card mode={prominent ? 'contained' : 'outlined'} style={styles.card}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.chips}>
          <Chip compact>{formatCategory(announcement.category)}</Chip>
          <Chip compact>{announcement.priority}</Chip>
          {!announcement.readAt ? <Chip compact>Unread</Chip> : null}
        </View>
        <Text
          style={prominent ? { color: theme.colors.primary } : undefined}
          variant={prominent ? 'titleLarge' : 'titleMedium'}
        >
          {announcement.title}
        </Text>
        <Text variant="bodyMedium">{announcement.body}</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
          {new Date(announcement.createdAt).toLocaleString('en-IN')}
        </Text>
        {announcement.expiresAt ? (
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
            Active until {new Date(announcement.expiresAt).toLocaleString('en-IN')}
          </Text>
        ) : null}
        {!announcement.readAt ? (
          <Button
            accessibilityHint="Marks this admin announcement as read."
            accessibilityLabel={`Mark announcement ${announcement.title} as read`}
            disabled={disabled}
            mode="contained-tonal"
            onPress={onRead}
          >
            Mark Read
          </Button>
        ) : null}
      </Card.Content>
    </Card>
  );
});

function formatCategory(category: AnnouncementCategory): string {
  return category
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
  },
  cardContent: {
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
    gap: spacing.xs,
  },
  list: {
    gap: spacing.md,
  },
  screen: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
});
