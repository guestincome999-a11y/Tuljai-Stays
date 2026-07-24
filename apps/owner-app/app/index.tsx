import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { useAuth } from '../src/auth/auth-context';

export default function BootstrapScreen() {
  const { bootstrapComplete, hasOwnerAccess, isAuthenticated } = useAuth();

  if (!bootstrapComplete) {
    return (
      <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator animating size="large" />
      </View>
    );
  }

  return (
    <Redirect
      href={
        isAuthenticated && hasOwnerAccess ? '/(app)/dashboard' : '/(auth)/login'
      }
    />
  );
}
