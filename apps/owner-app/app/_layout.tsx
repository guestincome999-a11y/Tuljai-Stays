import { tuljaiLightTheme } from '@tuljai/ui';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';

import { AuthProvider } from '../src/auth/auth-context';
import { OwnerErrorBoundary } from '../src/components/error-boundary/OwnerErrorBoundary';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { ConnectivityProvider } from '../src/connectivity/connectivity-context';
import { OwnerPushNotifications } from '../src/notifications/OwnerPushNotifications';
import { OwnerAppProvider } from '../src/owner-ui/OwnerAppProvider';
import { RealtimeProvider } from '../src/realtime/realtime-provider';

import '../global.css';

export default function RootLayout() {
  const theme = tuljaiLightTheme;

  return (
    <PaperProvider theme={theme}>
      <OwnerErrorBoundary>
        <ConnectivityProvider>
          <OwnerAppProvider>
            <AuthProvider>
              <RealtimeProvider>
                <OwnerPushNotifications />
                <OfflineBanner />
                <Stack
                  screenOptions={{
                    contentStyle: { backgroundColor: theme.colors.background },
                    headerStyle: { backgroundColor: theme.colors.surface },
                    headerTitleStyle: { color: theme.colors.onSurface },
                    headerTintColor: theme.colors.primary,
                  }}
                >
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen name="(app)" options={{ headerShown: false }} />
                </Stack>
              </RealtimeProvider>
            </AuthProvider>
          </OwnerAppProvider>
        </ConnectivityProvider>
      </OwnerErrorBoundary>
    </PaperProvider>
  );
}
