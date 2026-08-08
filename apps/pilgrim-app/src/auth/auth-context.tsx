import { emptyAuthSession, type AuthSession } from '@tuljai/shared';
import type { AuthUserProfile } from '@tuljai/types';
import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  exchangeGoogleLogin,
  logoutFromApi,
  refreshAccessToken,
  updateAuthProfile,
  verifyLoginOtp,
} from './auth-api';
import {
  clearAuthSession,
  restoreAuthSession,
  saveAuthSession,
  subscribeAuthSession,
} from './auth-session-store';

interface AuthContextValue {
  bootstrapComplete: boolean;
  isAuthenticated: boolean;
  logout(): Promise<void>;
  refreshSession: () => Promise<string | null>;
  session: AuthSession;
  signInWithGoogle(supabaseAccessToken: string): Promise<void>;
  signInWithOtp(phoneNumber: string, otp: string): Promise<void>;
  updateProfile(displayName: string): Promise<void>;
  user: AuthUserProfile | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession>(emptyAuthSession);
  const [bootstrapComplete, setBootstrapComplete] = useState(false);

  useEffect(() => subscribeAuthSession(setSession), []);

  useEffect(() => {
    let mounted = true;

    async function restore() {
      const restored = await restoreAuthSession();

      if (!mounted) {
        return;
      }

      if (restored.tokens?.refreshToken) {
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

  const signInWithGoogle = useCallback(
    async (supabaseAccessToken: string) => {
      const response = await exchangeGoogleLogin(supabaseAccessToken);
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

  const refreshSession = useCallback(async (): Promise<string | null> => {
    const refreshToken = session.tokens?.refreshToken;

    if (!refreshToken || !session.tokens) {
      return null;
    }

    const refreshed = await refreshAccessToken(refreshToken).catch(() => null);

    if (!refreshed) {
      return null;
    }

    const nextSession: AuthSession = {
      ...session,
      tokens: {
        ...session.tokens,
        accessToken: refreshed.accessToken,
      },
    };
    await saveAuthSession(nextSession);
    setSession(nextSession);
    return refreshed.accessToken;
  }, [session]);

  const updateProfile = useCallback(
    async (displayName: string) => {
      const user = await updateAuthProfile({ displayName });
      const nextSession = { ...session, user };
      await saveAuthSession(nextSession);
      setSession(nextSession);
    },
    [session],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      bootstrapComplete,
      isAuthenticated: Boolean(session.tokens?.accessToken && session.user),
      logout,
      refreshSession,
      session,
      signInWithGoogle,
      signInWithOtp,
      updateProfile,
      user: session.user,
    }),
    [
      bootstrapComplete,
      logout,
      refreshSession,
      session,
      signInWithGoogle,
      signInWithOtp,
      updateProfile,
    ],
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
