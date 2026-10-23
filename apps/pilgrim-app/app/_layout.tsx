import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useAuth } from '../src/v2/core/auth';
import { useColors } from '../src/v2/design/theme';
import { AppProviders } from '../src/v2/shell/AppProviders';
import { PushRouting } from '../src/v2/shell/PushRouting';
import { useAppBack } from '../src/v2/shell/useAppBack';
import { useBootstrap } from '../src/v2/shell/useBootstrap';
import { OfflineBanner } from '../src/v2/ui/OfflineBanner';

void SplashScreen.preventAutoHideAsync();

function Shell() {
  const colors = useColors();
  const auth = useAuth();
  const bootstrapped = useBootstrap();
  const ready = bootstrapped && auth.ready;
  useAppBack();

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="dark" />
      <PushRouting />
      <Stack
        screenOptions={{
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.background },
          headerShown: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen name="login" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
      <OfflineBanner />
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <Shell />
    </AppProviders>
  );
}
