import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radius, spacing } from '@tuljai/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  IconButton,
  Text,
  useTheme,
} from 'react-native-paper';

import { useAuth } from '../../../auth/auth-context';
import { LodgeCard } from '../../lodges/components/LodgeCard';
import { LodgeSearchBar } from '../../lodges/components/LodgeSearchBar';
import { useHomeDiscovery } from '../../lodges/hooks/useLodgeDiscovery';
import { useUnreadNotificationCount } from '../../notifications/hooks/useNotifications';

const quickFilters = [
  { label: 'Near Temple', quick: 'near-temple' },
  { label: 'Family Rooms', quick: 'family' },
  { label: 'Parking', quick: 'parking' },
  { label: 'AC', quick: 'ac' },
  { label: 'Budget', quick: 'budget' },
  { label: 'Bhakt Niwas', quick: 'bhakt-niwas' },
];

export function HomeScreen() {
  const auth = useAuth();
  const discovery = useHomeDiscovery();
  const notifications = useUnreadNotificationCount();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const theme = useTheme();

  const displayName = auth.user?.displayName ?? auth.user?.phoneNumber ?? 'Pilgrim';

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void discovery.refresh();
          }}
          refreshing={discovery.isRefreshing}
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
        </View>
        <View style={styles.bellWrap}>
          <IconButton
            accessibilityLabel="Notifications"
            icon="bell-outline"
            mode="contained-tonal"
            onPress={() => router.push('/(app)/notifications')}
          />
          <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
            <Text style={{ color: theme.colors.onPrimary }} variant="labelSmall">
              {Math.min(notifications.unreadCount, 9)}
            </Text>
          </View>
        </View>
      </View>

      <LodgeSearchBar
        onChangeSearch={setSearch}
        onSubmit={() => {
          if (search.trim()) {
            router.push({ pathname: '/(app)/lodges', params: { search: search.trim() } });
          } else {
            router.push('/(app)/lodges');
          }
        }}
        value={search}
      />

      <Card mode="contained" style={styles.heroCard}>
        <Card.Content style={styles.heroContent}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons color={theme.colors.onPrimary} name="temple-hindu" size={36} />
          </View>
          <View style={styles.heroText}>
            <Text variant="titleLarge">Trusted stays for Tuljapur darshan</Text>
            <Text variant="bodyMedium">
              Compare verified lodges and Bhakt Niwas options before the festival rush.
            </Text>
          </View>
        </Card.Content>
      </Card>

      <View style={styles.quickFilters}>
        {quickFilters.map((filter) => (
          <Chip
            key={filter.quick}
            onPress={() =>
              router.push({ pathname: '/(app)/lodges', params: { quick: filter.quick } })
            }
          >
            {filter.label}
          </Chip>
        ))}
      </View>

      {discovery.errorMessage ? (
        <Card mode="outlined" style={styles.statusCard}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Discovery is taking longer than expected</Text>
            <Text variant="bodyMedium">{discovery.errorMessage}</Text>
            <Button
              mode="contained-tonal"
              onPress={() => {
                void discovery.refresh();
              }}
            >
              Try Again
            </Button>
          </Card.Content>
        </Card>
      ) : null}

      {discovery.isLoading ? <ActivityIndicator animating size="large" /> : null}

      {discovery.data?.announcements[0] ? (
        <Card mode="outlined" style={styles.statusCard}>
          <Card.Content style={styles.cardContent}>
            <Text style={{ color: theme.colors.primary }} variant="labelLarge">
              Announcement
            </Text>
            <Text variant="titleMedium">{discovery.data.announcements[0].title}</Text>
            <Text numberOfLines={2} variant="bodyMedium">
              {discovery.data.announcements[0].body}
            </Text>
            <Button mode="contained-tonal" onPress={() => router.push('/(app)/announcements')}>
              View Announcements
            </Button>
          </Card.Content>
        </Card>
      ) : null}

      <SectionHeader
        actionLabel="View all"
        onAction={() => router.push('/(app)/lodges')}
        title="Featured Lodges"
      />
      <View style={styles.cardList}>
        {discovery.data?.featuredLodges.map((lodgePreview) => (
          <LodgeCard
            key={lodgePreview.lodge.id}
            lodgePreview={lodgePreview}
            onPress={() =>
              router.push({ pathname: '/(app)/lodges/[id]', params: { id: lodgePreview.lodge.id } })
            }
          />
        ))}
      </View>

      <SectionHeader
        actionLabel="Explore"
        onAction={() =>
          router.push({ pathname: '/(app)/lodges', params: { quick: 'near-temple' } })
        }
        title="Available Near Temple"
      />
      <View style={styles.cardList}>
        {discovery.data?.nearbyLodges.map((lodgePreview) => (
          <LodgeCard
            key={lodgePreview.lodge.id}
            lodgePreview={lodgePreview}
            onPress={() =>
              router.push({ pathname: '/(app)/lodges/[id]', params: { id: lodgePreview.lodge.id } })
            }
          />
        ))}
      </View>
    </ScrollView>
  );
}

function SectionHeader({
  actionLabel,
  onAction,
  title,
}: {
  actionLabel: string;
  onAction: () => void;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="titleLarge">{title}</Text>
      <Button onPress={onAction}>{actionLabel}</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    top: 4,
    width: 20,
  },
  bellWrap: {
    position: 'relative',
  },
  cardContent: {
    gap: spacing.sm,
  },
  cardList: {
    gap: spacing.md,
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
  heroCard: {
    borderRadius: radius.sm,
  },
  heroContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#B95713',
    borderRadius: radius.full,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
  },
  quickFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  screen: {
    flexGrow: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusCard: {
    borderRadius: radius.sm,
  },
});
