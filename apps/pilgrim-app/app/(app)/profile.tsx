import { AppScreen, radius, spacing } from '@tuljai/ui';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, Divider, Text } from 'react-native-paper';

import { useAuth } from '../../src/auth/auth-context';
import { clearRecentlyViewedLodges } from '../../src/features/lodges/storage/recently-viewed-lodges';

export default function ProfileScreen() {
  const auth = useAuth();
  const user = auth.user;
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);

  return (
    <AppScreen scrollable style={styles.screen}>
      <Text variant="headlineMedium">Profile</Text>
      <Card mode="contained" style={styles.card}>
        <Card.Content style={styles.content}>
          <Text variant="titleMedium">{user?.displayName ?? 'Pilgrim'}</Text>
          <Text variant="bodyMedium">{user?.phoneNumber}</Text>
          <Text variant="bodySmall">Role: {user?.roles.join(', ')}</Text>
          <Text variant="bodySmall">App version: 0.1.0</Text>
        </Card.Content>
      </Card>

      <Card mode="outlined" style={styles.card}>
        <Card.Content style={styles.content}>
          <Text variant="titleMedium">Support</Text>
          <Text variant="bodyMedium">How booking works</Text>
          <Text variant="bodySmall">
            Send a booking request, wait for lodge approval, then use the QR pass when available.
          </Text>
          <Divider />
          <Text variant="bodyMedium">If booking is pending</Text>
          <Text variant="bodySmall">
            The lodge has not accepted or rejected the request yet. Pull to refresh booking status.
          </Text>
          <Divider />
          <Text variant="bodyMedium">If QR is not visible</Text>
          <Text variant="bodySmall">
            Refresh the booking after approval. Reconnect to the internet before check-in.
          </Text>
          <Divider />
          <Text variant="bodyMedium">Contact support</Text>
          <Text variant="bodySmall">Support contact will be available soon.</Text>
        </Card.Content>
      </Card>

      <Card mode="outlined" style={styles.card}>
        <Card.Content style={styles.content}>
          <Text variant="titleMedium">App</Text>
          <Text variant="bodyMedium">Terms and privacy information will be available soon.</Text>
          <Button
            mode="contained-tonal"
            onPress={() => {
              void clearCachedData();
            }}
          >
            Clear Cached Data
          </Button>
          {cacheMessage ? <Text variant="bodySmall">{cacheMessage}</Text> : null}
        </Card.Content>
      </Card>

      <Button
        mode="contained-tonal"
        onPress={() => {
          void auth.logout();
        }}
      >
        Logout
      </Button>
    </AppScreen>
  );

  async function clearCachedData() {
    await clearRecentlyViewedLodges();
    setCacheMessage('Cached lodge history cleared.');
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
  },
  content: {
    gap: spacing.sm,
  },
  screen: {
    gap: spacing.lg,
  },
});
