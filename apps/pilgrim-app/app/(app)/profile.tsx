import { AppScreen, spacing } from '@tuljai/ui';
import { StyleSheet } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { useAuth } from '../../src/auth/auth-context';

export default function ProfileScreen() {
  const auth = useAuth();
  const user = auth.user;

  return (
    <AppScreen scrollable style={styles.screen}>
      <Text variant="headlineMedium">Profile</Text>
      <Card mode="contained" style={styles.card}>
        <Card.Content style={styles.content}>
          <Text variant="titleMedium">{user?.displayName ?? 'Pilgrim'}</Text>
          <Text variant="bodyMedium">{user?.phoneNumber}</Text>
          <Text variant="bodySmall">Roles: {user?.roles.join(', ')}</Text>
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
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
  },
  content: {
    gap: spacing.sm,
  },
  screen: {
    gap: spacing.lg,
  },
});
