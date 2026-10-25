import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';

import { useAuth } from '../../src/auth/auth-context';

export default function GoogleAuthCallbackScreen() {
  const auth = useAuth();
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    if (auth.bootstrapComplete && auth.isAuthenticated) {
      router.replace('/(app)/home');
    }
  }, [auth.bootstrapComplete, auth.isAuthenticated, router]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
      <Text style={styles.title} variant="titleMedium">
        Completing Google sign-in…
      </Text>
      <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]} variant="bodyMedium">
        Please wait while we securely open Tuljai Stays.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  message: {
    marginTop: 8,
    textAlign: 'center',
  },
  title: {
    marginTop: 20,
    textAlign: 'center',
  },
});
