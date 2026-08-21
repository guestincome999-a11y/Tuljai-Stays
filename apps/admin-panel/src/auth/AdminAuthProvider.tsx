'use client';

import { emptyAuthSession, type AuthSession } from '@tuljai/shared';
import type { AuthUserProfile } from '@tuljai/types';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { refreshAdminAccessToken } from '../api/client';
import {
  getPermissionsForRoles,
  hasAdminAccess,
  type AdminPermission,
} from '../permissions/permissions';

import { getAdminProfile, logoutAdmin, requestAdminOtp, verifyAdminOtp } from './admin-auth-api';
import { getOrCreateAdminDeviceId } from './admin-device';
import { ADMIN_SESSION_EXPIRED_EVENT, ADMIN_SESSION_REFRESHED_EVENT } from './admin-session-events';
import { clearAuthSession, getAuthSession, setAuthSession } from './auth-session-store';
import { tokenStorage } from './token-storage';

interface AdminAuthState {
  accessDenied: boolean;
  bootstrapComplete: boolean;
  errorMessage: string | null;
  isAuthenticated: boolean;
  isSubmitting: boolean;
  permissions: AdminPermission[];
  refreshSession: () => Promise<string | null>;
  requestOtp: (phoneNumber: string) => Promise<RequestOtpResult>;
  session: AuthSession;
  signOut: () => Promise<void>;
  verifyOtp: (input: { otp: string; phoneNumber: string }) => Promise<boolean>;
}

interface RequestOtpResult {
  expiresAt: string | null;
  otpForTesting?: string;
  success: boolean;
}

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<AuthSession>(emptyAuthSession);
  const [bootstrapComplete, setBootstrapComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const permissions = useMemo(
    () => getPermissionsForRoles(session.user?.roles ?? []),
    [session.user?.roles],
  );
  const isAuthenticated = Boolean(
    session.tokens && session.user && hasAdminAccess(session.user.roles),
  );
  const accessDenied = Boolean(session.user && !hasAdminAccess(session.user.roles));

  const clearSession = useCallback(async () => {
    clearAuthSession();
    await tokenStorage.clear();
    setSession(emptyAuthSession);
  }, []);
  const refreshSession = useCallback(() => refreshAdminAccessToken(), []);

  useEffect(() => {
    const handleSessionRefreshed = () => {
      setSession(getAuthSession());
      setErrorMessage(null);
    };
    const handleSessionExpired = () => {
      setSession(emptyAuthSession);
      setErrorMessage('Your session expired. Please log in again.');
      router.replace('/login');
    };

    window.addEventListener(ADMIN_SESSION_REFRESHED_EVENT, handleSessionRefreshed);
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleSessionExpired);

    return () => {
      window.removeEventListener(ADMIN_SESSION_REFRESHED_EVENT, handleSessionRefreshed);
      window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [router]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const storedSession = getAuthSession();

      if (!storedSession.tokens || !storedSession.user) {
        if (mounted) {
          setBootstrapComplete(true);
        }
        return;
      }

      try {
        const profile = await getAdminProfile();

        if (!hasAdminAccess(profile.roles)) {
          await clearSession();
          if (mounted) {
            setErrorMessage(
              'This account does not have permission to access the Tuljai Stays Admin Panel.',
            );
          }
          return;
        }

        const nextSession = { ...storedSession, user: profile };
        setAuthSession(nextSession);

        if (mounted) {
          setSession(nextSession);
        }
      } catch {
        await clearSession();
        if (mounted) {
          setErrorMessage('Your session expired. Please log in again.');
        }
      } finally {
        if (mounted) {
          setBootstrapComplete(true);
        }
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [clearSession]);

  useEffect(() => {
    if (!bootstrapComplete) {
      return;
    }

    if (pathname.startsWith('/admin') && !isAuthenticated) {
      router.replace('/login');
    }
  }, [bootstrapComplete, isAuthenticated, pathname, router]);

  const requestOtp = useCallback(async (phoneNumber: string): Promise<RequestOtpResult> => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await requestAdminOtp(phoneNumber);
      return {
        expiresAt: result.expiresAt,
        otpForTesting: process.env.NODE_ENV === 'production' ? undefined : result.otpForTesting,
        success: true,
      };
    } catch (error) {
      setErrorMessage(getOtpRequestErrorMessage(error));
      return { expiresAt: null, success: false };
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const verifyOtp = useCallback(
    async (input: { otp: string; phoneNumber: string }): Promise<boolean> => {
      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        const result = await verifyAdminOtp({
          deviceId: getOrCreateAdminDeviceId(),
          otp: input.otp,
          phoneNumber: input.phoneNumber,
        });

        if (!hasAdminAccess(result.user.roles)) {
          await tokenStorage.clear();
          setErrorMessage(
            'This account does not have permission to access the Tuljai Stays Admin Panel.',
          );
          return false;
        }

        await tokenStorage.setTokens(result.tokens);
        const nextSession: AuthSession = {
          activeSession: result.session,
          tokens: result.tokens,
          user: result.user,
        };
        setAuthSession(nextSession);
        setSession(nextSession);
        router.replace('/admin/dashboard');
        return true;
      } catch {
        setErrorMessage('OTP verification failed. Please try again.');
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [router],
  );

  const signOut = useCallback(async () => {
    const currentSession = getAuthSession();

    if (currentSession.tokens?.refreshToken && currentSession.activeSession?.deviceId) {
      await logoutAdmin({
        deactivateDeviceToken: true,
        deviceId: currentSession.activeSession.deviceId,
        refreshToken: currentSession.tokens.refreshToken,
      }).catch(() => undefined);
    }

    await clearSession();
    router.replace('/login');
  }, [clearSession, router]);

  const value = useMemo<AdminAuthState>(
    () => ({
      accessDenied,
      bootstrapComplete,
      errorMessage,
      isAuthenticated,
      isSubmitting,
      permissions,
      refreshSession,
      requestOtp,
      session,
      signOut,
      verifyOtp,
    }),
    [
      accessDenied,
      bootstrapComplete,
      errorMessage,
      isAuthenticated,
      isSubmitting,
      permissions,
      refreshSession,
      requestOtp,
      session,
      signOut,
      verifyOtp,
    ],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthState {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  }

  return context;
}

export function getAdminDisplayName(user: AuthUserProfile | null): string {
  return user?.displayName ?? user?.phoneNumber ?? 'Admin';
}

function getOtpRequestErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';

  if (/too many otp requests/iu.test(message)) {
    return 'Too many OTP requests. Please wait 15 minutes before trying again.';
  }

  if (/phoneNumber|phone number|must match/iu.test(message)) {
    return 'Enter a valid 10-digit Indian mobile number.';
  }

  return 'We could not generate an OTP right now. Please try again shortly.';
}
