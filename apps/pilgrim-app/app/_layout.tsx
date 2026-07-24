import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';

import { AuthProvider } from '../src/auth/auth-context';
import { AppErrorBoundary } from '../src/components/AppErrorBoundary';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { ConnectivityProvider } from '../src/connectivity/connectivity-context';
import { PilgrimAppProvider } from '../src/pilgrim-ui/PilgrimAppProvider';
import { RealtimeProvider } from '../src/realtime/realtime-provider';
import { pilgrimLightTheme } from '../src/theme/pilgrim-theme';

import '../global.css';

export default function RootLayout() {
  const theme = pilgrimLightTheme;

  return (
    <PaperProvider theme={theme}>
      <AppErrorBoundary>
        <ConnectivityProvider>
          <AuthProvider>
            <RealtimeProvider>
              <PilgrimAppProvider>
                <StatusBar style="dark" />
                <OfflineBanner />
                <Stack
                  screenOptions={{
                    contentStyle: { backgroundColor: theme.colors.background },
                    headerShown: false,
                  }}
                >
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(app)" />
                </Stack>
              </PilgrimAppProvider>
            </RealtimeProvider>
          </AuthProvider>
        </ConnectivityProvider>
      </AppErrorBoundary>
    </PaperProvider>
  );
}
