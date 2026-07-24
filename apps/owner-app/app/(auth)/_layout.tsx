import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: '#FAF7F2' },
        headerTintColor: '#7A1F2B',
        headerStyle: { backgroundColor: '#FAF7F2' },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="verify-otp" options={{ title: 'Verify OTP' }} />
      <Stack.Screen name="register-lodge" options={{ headerShown: false }} />
      <Stack.Screen name="pending-approval" options={{ headerShown: false }} />
    </Stack>
  );
}
