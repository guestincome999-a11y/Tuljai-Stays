import { MaterialCommunityIcons } from '@expo/vector-icons';
import { palette, spacing } from '@tuljai/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Text, useTheme } from 'react-native-paper';

import { useAuth } from '../../../auth/auth-context';
import {
  AppHeader,
  LoadingSkeleton,
  SectionHeading,
  StateCard,
} from '../../../components/pilgrim-ui';
import { PushPermissionCard } from '../../../notifications/PushPermissionCard';
import { usePublicSettings } from '../../../settings/usePublicSettings';
import { pilgrimColors, pilgrimRadius, pilgrimSpacing } from '../../../theme/pilgrim-theme';
import { LodgeCard } from '../../lodges/components/LodgeCard';
import { LodgeSearchBar } from '../../lodges/components/LodgeSearchBar';
import { useHomeDiscovery } from '../../lodges/hooks/useLodgeDiscovery';
import { useUnreadNotificationCount } from '../../notifications/hooks/useNotifications';

const quickFilters = [
  { icon: 'temple-hindu', label: 'Near Temple', quick: 'near-temple' },
  { icon: 'account-group-outline', label: 'Family', quick: 'family' },
  { icon: 'car-outline', label: 'Parking', quick: 'parking' },
  { icon: 'snowflake', label: 'AC', quick: 'ac' },
  { icon: 'wallet-outline', label: 'Budget', quick: 'budget' },
  { icon: 'home-heart', label: 'Bhakt Niwas', quick: 'bhakt-niwas' },
];

export function HomeScreen() {
  const auth = useAuth();
  const discovery = useHomeDiscovery();
  const notifications = useUnreadNotificationCount();
  const publicSettings = usePublicSettings();
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
      <AppHeader
        actionIcon="bell-outline"
        actionLabel="Notifications"
        badgeCount={notifications.unreadCount}
        eyebrow="Namaste · नमस्कार · नमस्ते"
        onAction={() => router.push('/(app)/notifications')}
        subtitle="Plan a peaceful stay near Tulja Bhavani Temple"
        title={displayName}
      />

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

      <Card mode="contained" style={[styles.heroCard, { backgroundColor: theme.colors.primary }]}>
        <Card.Content style={styles.heroContent}>
          <View style={styles.heroCopy}>
            <View style={styles.heroLabel}>
              <MaterialCommunityIcons color={pilgrimColors.goldSoft} name="candle" size={18} />
              <Text style={{ color: pilgrimColors.goldSoft }} variant="labelLarge">
                Your darshan, thoughtfully planned
              </Text>
            </View>
            <Text style={{ color: theme.colors.onPrimary }} variant="headlineSmall">
              Trusted stays in Tuljapur
            </Text>
            <Text style={styles.heroDescription} variant="bodyMedium">
              Compare verified lodges and Bhakt Niwas options close to the temple.
            </Text>
          </View>
          <View style={styles.heroTemple}>
            <MaterialCommunityIcons color={pilgrimColors.goldSoft} name="temple-hindu" size={52} />
          </View>
        </Card.Content>
      </Card>

      {publicSettings.festivalModeEnabled ? (
        <Card mode="contained" style={styles.festivalCard}>
          <Card.Content style={styles.festivalContent}>
            <MaterialCommunityIcons
              color={theme.colors.tertiary}
              name="star-four-points"
              size={22}
            />
            <View style={styles.festivalCopy}>
              <Text variant="titleSmall">Festival updates are active</Text>
              <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
                Important temple and travel notices will appear first.
              </Text>
            </View>
          </Card.Content>
        </Card>
      ) : null}

      <View style={styles.quickFilters}>
        {quickFilters.map((filter) => (
          <Chip
            icon={filter.icon}
            key={filter.quick}
            mode="outlined"
            onPress={() =>
              router.push({ pathname: '/(app)/lodges', params: { quick: filter.quick } })
            }
          >
            {filter.label}
          </Chip>
        ))}
      </View>

      {discovery.errorMessage ? (
        <StateCard
          actionLabel="Try again"
          description={discovery.errorMessage}
          icon="cloud-alert-outline"
          onAction={() => void discovery.refresh()}
          title="We couldn't refresh stays"
        />
      ) : null}

      {discovery.isLoading ? <LoadingSkeleton /> : null}

      {discovery.data?.announcements[0] ? (
        <Card mode="outlined" style={styles.announcementCard}>
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

      <SectionHeading
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

      <SectionHeading
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

      <PushPermissionCard />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  announcementCard: {
    borderColor: pilgrimColors.line,
    borderRadius: pilgrimRadius.lg,
  },
  cardContent: {
    gap: spacing.sm,
  },
  cardList: {
    gap: spacing.md,
  },
  festivalCard: {
    backgroundColor: pilgrimColors.goldSoft,
    borderRadius: pilgrimRadius.md,
  },
  festivalContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: pilgrimSpacing.md,
  },
  festivalCopy: { flex: 1, gap: 2 },
  heroCard: {
    borderRadius: pilgrimRadius.xl,
    overflow: 'hidden',
  },
  heroContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: pilgrimSpacing.lg,
    minHeight: 176,
    paddingVertical: pilgrimSpacing.xl,
  },
  heroCopy: { flex: 1, gap: pilgrimSpacing.sm },
  heroDescription: { color: palette.saffron[100], lineHeight: 21 },
  heroLabel: { alignItems: 'center', flexDirection: 'row', gap: pilgrimSpacing.sm },
  heroTemple: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: pilgrimRadius.full,
    height: 92,
    justifyContent: 'center',
    width: 92,
  },
  quickFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: pilgrimSpacing.sm,
  },
  screen: {
    flexGrow: 1,
    gap: pilgrimSpacing.xl,
    padding: pilgrimSpacing.lg,
    paddingBottom: pilgrimSpacing.xxl,
  },
});
