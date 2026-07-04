import { emptyAuthSession, type AuthSession } from '@tuljai/shared';
import type { AuthUserProfile, UserRole } from '@tuljai/types';
import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { logoutFromApi, refreshAccessToken, verifyOwnerLoginOtp } from './auth-api';
import { clearAuthSession, restoreAuthSession, saveAuthSession } from './auth-session-store';

const allowedOwnerRoles: UserRole[] = ['OWNER', 'ADMIN', 'SUPER_ADMIN'];

interface AuthContextValue {
  accessDeniedMessage: string | null;
  bootstrapComplete: boolean;
  hasOwnerAccess: boolean;
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
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function restore() {
      const restored = await restoreAuthSession();

      if (!mounted) {
        return;
      }

      if (!hasAllowedOwnerRole(restored.user)) {
        await clearAuthSession();
        setSession(emptyAuthSession);
        setBootstrapComplete(true);
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
      const response = await verifyOwnerLoginOtp(phoneNumber, otp);

      if (!hasAllowedOwnerRole(response.user)) {
        await clearAuthSession();
        setSession(emptyAuthSession);
        setAccessDeniedMessage(
          'This number is not registered as a lodge owner. Please contact Tuljai Stays admin.',
        );
        router.replace('/(auth)/login');
        return;
      }

      const nextSession: AuthSession = {
        activeSession: response.session,
        tokens: response.tokens,
        user: response.user,
      };

      setAccessDeniedMessage(null);
      await saveAuthSession(nextSession);
      setSession(nextSession);
      router.replace('/(app)/dashboard');
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
    setAccessDeniedMessage(null);
    router.replace('/(auth)/login');
  }, [router, session.tokens?.refreshToken]);

  const hasOwnerAccess = hasAllowedOwnerRole(session.user);
  const value = useMemo<AuthContextValue>(
    () => ({
      accessDeniedMessage,
      bootstrapComplete,
      hasOwnerAccess,
      isAuthenticated: Boolean(session.tokens?.accessToken && session.user && hasOwnerAccess),
      logout,
      session,
      signInWithOtp,
      user: session.user,
    }),
    [accessDeniedMessage, bootstrapComplete, hasOwnerAccess, logout, session, signInWithOtp],
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

function hasAllowedOwnerRole(user: AuthUserProfile | null): boolean {
  return Boolean(user?.roles.some((role) => allowedOwnerRoles.includes(role)));
}
