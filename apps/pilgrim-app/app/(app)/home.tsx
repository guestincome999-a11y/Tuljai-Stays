import { AppScreen, spacing } from '@tuljai/ui';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

import { useAuth } from '../../src/auth/auth-context';

const featureCards = ['Browse Lodges', 'My Bookings', 'QR Pass', 'Announcements'];

export default function HomeScreen() {
  const { user } = useAuth();
  const theme = useTheme();

  return (
    <AppScreen scrollable style={styles.screen}>
      <View style={styles.header}>
        <Text style={{ color: theme.colors.primary }} variant="headlineMedium">
          Namaste
        </Text>
        <Text variant="bodyLarge">
          {user?.displayName ?? user?.phoneNumber ?? 'Welcome to Tuljai Stays'}
        </Text>
      </View>

      <Card mode="contained" style={styles.noticeCard}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">Your pilgrimage stay companion</Text>
          <Text variant="bodyMedium">
            Lodge browsing, bookings, QR pass, and announcements will appear here in the next
            sequences.
          </Text>
        </Card.Content>
      </Card>

      <View style={styles.grid}>
        {featureCards.map((title) => (
          <Card key={title} mode="outlined" style={styles.featureCard}>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleSmall">{title}</Text>
              <Text variant="bodySmall">Coming soon</Text>
            </Card.Content>
          </Card>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  cardContent: {
    gap: spacing.sm,
  },
  featureCard: {
    borderRadius: 8,
    flexBasis: '47%',
    flexGrow: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  noticeCard: {
    borderRadius: 8,
  },
  screen: {
    gap: spacing.lg,
  },
});
