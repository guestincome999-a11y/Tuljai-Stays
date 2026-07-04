import { AppScreen, radius, spacing } from '@tuljai/ui';
import { StyleSheet } from 'react-native';
import { Button, Card, Chip, Text, useTheme } from 'react-native-paper';

import { useAuth } from '../../../auth/auth-context';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';

const appVersion = '0.1.0';

export function ProfileScreen() {
  const auth = useAuth();
  const assignedLodges = useAssignedLodges();
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
          <Text variant="titleSmall">Roles</Text>
          <Chip mode="outlined">{auth.user?.roles.join(', ') ?? 'Owner'}</Chip>
        </Card.Content>
      </Card>

      <Card mode="outlined" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">Selected Lodge</Text>
          <Text variant="bodyMedium">{selectedLodgeName}</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
            Lodge selection is stored locally after assignment loading.
          </Text>
        </Card.Content>
      </Card>

      <Card mode="outlined" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">Support</Text>
          <Text variant="bodyMedium">Contact Tuljai Stays admin for lodge assignment changes.</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
            App version {appVersion}
          </Text>
        </Card.Content>
      </Card>

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
