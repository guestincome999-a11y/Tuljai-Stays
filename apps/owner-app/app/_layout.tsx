import { tuljaiDarkTheme, tuljaiLightTheme } from '@tuljai/ui';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { AuthProvider } from '../src/auth/auth-context';
import { OwnerErrorBoundary } from '../src/components/error-boundary/OwnerErrorBoundary';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { ConnectivityProvider } from '../src/connectivity/connectivity-context';
import { RealtimeProvider } from '../src/realtime/realtime-provider';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? tuljaiDarkTheme : tuljaiLightTheme;

  return (
    <PaperProvider theme={theme}>
      <OwnerErrorBoundary>
        <ConnectivityProvider>
          <AuthProvider>
            <RealtimeProvider>
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
        </ConnectivityProvider>
      </OwnerErrorBoundary>
    </PaperProvider>
  );
}
