import type { ReactNode } from 'react';

import { AuthProvider } from '../core/auth';
import { useRemoteConfig } from '../core/config';
import { ConnectivityProvider } from '../core/connectivity';
import { PreferencesProvider } from '../core/preferences';
import { RealtimeProvider } from '../core/realtime';
import { ThemeProvider } from '../design/theme';
import { LanguageProvider } from '../i18n/language';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { ToastProvider } from '../ui/Toast';

function RemoteTheme({ children }: { children: ReactNode }) {
  const { config } = useRemoteConfig();
  return <ThemeProvider tokens={config.layout.theme}>{children}</ThemeProvider>;
}

/** Everything the screens depend on, in the order they depend on each other. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <RemoteTheme>
          <ConnectivityProvider>
            <ToastProvider>
              <AuthProvider>
                <PreferencesProvider>
                  <RealtimeProvider>{children}</RealtimeProvider>
                </PreferencesProvider>
              </AuthProvider>
            </ToastProvider>
          </ConnectivityProvider>
        </RemoteTheme>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
