import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: '#FFF9F3' },
        headerTintColor: '#861632',
        headerStyle: { backgroundColor: '#FFF9F3' },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
      <Stack.Screen name="reset-password" options={{ title: 'Reset password' }} />
      <Stack.Screen name="register-lodge" options={{ headerShown: false }} />
      <Stack.Screen name="pending-approval" options={{ headerShown: false }} />
    </Stack>
  );
}
