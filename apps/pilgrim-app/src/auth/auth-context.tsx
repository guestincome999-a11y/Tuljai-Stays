import { emptyAuthSession, type AuthSession } from '@tuljai/shared';
import type { AuthUserProfile } from '@tuljai/types';
import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { logoutFromApi, refreshAccessToken, verifyLoginOtp } from './auth-api';
import { clearAuthSession, restoreAuthSession, saveAuthSession } from './auth-session-store';

interface AuthContextValue {
  bootstrapComplete: boolean;
  isAuthenticated: boolean;
  logout(): Promise<void>;
  session: AuthSession;
  signInWithOtp(phoneNumber: string, otp: string): Promise<void>;
  user: AuthUserProfile | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession>(emptyAuthSession);
  const [bootstrapComplete, setBootstrapComplete] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function restore() {
      const restored = await restoreAuthSession();

      if (!mounted) {
        return;
      }

      if (restored.tokens?.refreshToken && !restored.tokens.accessToken) {
        const refreshed = await refreshAccessToken(restored.tokens.refreshToken).catch(() => null);

        if (refreshed) {
          const nextSession = {
            ...restored,
            tokens: {
              ...restored.tokens,
              accessToken: refreshed.accessToken,
            },
          };
          await saveAuthSession(nextSession);
          setSession(nextSession);
        } else {
          await clearAuthSession();
          setSession(emptyAuthSession);
        }
      } else {
        setSession(restored);
      }

      setBootstrapComplete(true);
    }

    void restore();

    return () => {
      mounted = false;
    };
  }, []);

  const signInWithOtp = useCallback(
    async (phoneNumber: string, otp: string) => {
      const response = await verifyLoginOtp(phoneNumber, otp);
      const nextSession: AuthSession = {
        activeSession: response.session,
        tokens: response.tokens,
        user: response.user,
      };

      await saveAuthSession(nextSession);
      setSession(nextSession);
      router.replace('/(app)/home');
    },
    [router],
  );

  const logout = useCallback(async () => {
    const refreshToken = session.tokens?.refreshToken;

    if (refreshToken) {
      await logoutFromApi(refreshToken).catch(() => undefined);
    }

    await clearAuthSession();
    setSession(emptyAuthSession);
    router.replace('/(auth)/login');
  }, [router, session.tokens?.refreshToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      bootstrapComplete,
      isAuthenticated: Boolean(session.tokens?.accessToken && session.user),
      logout,
      session,
      signInWithOtp,
      user: session.user,
    }),
    [bootstrapComplete, logout, session, signInWithOtp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
