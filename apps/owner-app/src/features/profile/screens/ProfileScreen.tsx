import { AppScreen, radius, spacing } from '@tuljai/ui';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Button, Card, List, Text, useTheme } from 'react-native-paper';

import { useAuth } from '../../../auth/auth-context';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';

const appVersion = '0.1.0';

export function ProfileScreen() {
  const auth = useAuth();
  const assignedLodges = useAssignedLodges();
  const router = useRouter();
  const theme = useTheme();
  const displayName = auth.user?.displayName ?? auth.user?.phoneNumber ?? 'Owner';
  const selectedLodgeName = assignedLodges.selectedLodge?.name ?? 'No lodge selected';

  return (
    <AppScreen scrollable style={styles.screen}>
      <Card mode="contained" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <Text style={{ color: theme.colors.primary }} variant="headlineSmall">
            Owner Profile
          </Text>
          <Text variant="titleMedium">{displayName}</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
            {auth.user?.phoneNumber}
          </Text>
          <Text variant="titleSmall">{selectedLodgeName}</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
            Lodge owner account
          </Text>
        </Card.Content>
      </Card>

      <Card mode="outlined" style={styles.card}>
        <Card.Title title="History & tools" />
        <List.Item
          description="Completed, checked-out, cancelled and expired stays"
          left={(props) => <List.Icon {...props} icon="history" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          title="Previous Bookings"
          onPress={() => router.push('/(app)/previous-bookings')}
        />
        <List.Item
          left={(props) => <List.Icon {...props} icon="qrcode-scan" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          title="QR Scan History"
          onPress={() => router.push('/(app)/scan-history')}
        />
        <List.Item
          left={(props) => <List.Icon {...props} icon="bell-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          title="Notifications"
          onPress={() => router.push('/(app)/notifications')}
        />
        <List.Item
          left={(props) => <List.Icon {...props} icon="bullhorn-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          title="Announcements"
          onPress={() => router.push('/(app)/announcements')}
        />
        <List.Item
          left={(props) => <List.Icon {...props} icon="chart-box-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          title="Reports"
          onPress={() => router.push('/(app)/reports')}
        />
        <List.Item
          left={(props) => <List.Icon {...props} icon="cog-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          title="Settings"
          onPress={() => router.push('/(app)/settings')}
        />
      </Card>

      <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
        Contact Tuljai Stays admin for lodge assignment changes. App version {appVersion}
      </Text>

      <Button
        accessibilityLabel="Logout from owner app"
        mode="contained-tonal"
        onPress={() => {
          void auth.logout();
        }}
      >
        Logout
      </Button>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
  },
  cardContent: {
    gap: spacing.md,
  },
  screen: {
    gap: spacing.lg,
  },
});
