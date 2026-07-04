import { AppScreen, spacing } from '@tuljai/ui';
import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';

import { useAuth } from '../src/auth/auth-context';

export default function BootstrapScreen() {
  const { bootstrapComplete, isAuthenticated } = useAuth();
  const theme = useTheme();

  if (bootstrapComplete) {
    return <Redirect href={isAuthenticated ? '/(app)/home' : '/(auth)/login'} />;
  }

  return (
    <AppScreen style={styles.screen}>
      <View style={styles.brandMark}>
        <Text style={{ color: theme.colors.primary }} variant="displaySmall">
          Tuljai Stays
        </Text>
        <Text style={styles.subtitle} variant="bodyLarge">
          Preparing your stay...
        </Text>
      </View>
      <ActivityIndicator animating color={theme.colors.primary} size="large" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  brandMark: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  screen: {
    alignItems: 'center',
    gap: spacing.xl,
    justifyContent: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
});
