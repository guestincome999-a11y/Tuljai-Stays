import type { AuthSession } from '@tuljai/shared';
import type {
  AuthUserProfile,
  GoogleLoginRequest,
  LogoutRequest,
  RequestOtpResponse,
  UpdateAuthProfileRequest,
  VerifyOtpResponse,
} from '@tuljai/types';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';

import { api, onSessionExpired, refreshAccessToken } from './api';
import { GoogleLoginCancelledError, startGoogleLogin } from './google';
import {
  clearSession,
  currentSession,
  deviceId,
  loadSession,
  saveSession,
  subscribeSession,
  updateAccessToken,
} from './session';

const ONBOARDING_KEY = 'tuljai.pilgrim.v2.onboardingRequired';

function devicePlatform(): GoogleLoginRequest['platform'] {
  if (Platform.OS === 'android') return 'ANDROID';
  if (Platform.OS === 'ios') return 'IOS';
  return 'UNKNOWN';
}

function deviceName(): string {
  return Platform.OS === 'ios' ? 'iPhone' : 'Android phone';
}

/** Indian mobile numbers only: 10 digits starting 6-9, with or without a 91 prefix. */
export function normalizeIndianMobile(value: string): string | null {
  const digits = value.replace(/\D/gu, '');
  if (/^[6-9]\d{9}$/u.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/u.test(digits)) return `+${digits}`;
  return null;
}

export function requestLoginOtp(phoneNumber: string): Promise<RequestOtpResponse> {
  return api.post<RequestOtpResponse>('/auth/request-otp', {
    appType: 'PILGRIM_APP',
    phoneNumber,
    purpose: 'LOGIN',
  });
}

async function establish(response: VerifyOtpResponse): Promise<boolean> {
  const next: AuthSession = {
    activeSession: response.session,
    tokens: response.tokens,
    user: response.user,
  };
  const onboardingRequired = response.onboardingRequired === true;
  await saveSession(next);
  await SecureStore.setItemAsync(ONBOARDING_KEY, onboardingRequired ? '1' : '0');
  return onboardingRequired;
}

export interface AuthContextValue {
  /** True once the saved session has been checked, so screens never flash a signed-out state. */
  ready: boolean;
  logout: () => Promise<void>;
  onboardingRequired: boolean;
  sessionExpired: boolean;
  signedIn: boolean;
  /** Resolves with whether the person still needs to give their name. */
  signInWithGoogle: () => Promise<boolean | null>;
  signInWithOtp: (phoneNumber: string, otp: string) => Promise<boolean>;
  updateName: (displayName: string) => Promise<void>;
  user: AuthUserProfile | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession>(currentSession());
  const [ready, setReady] = useState(false);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => subscribeSession(setSession), []);

  useEffect(() => {
    onSessionExpired(() => {
      void clearSession();
      setSessionExpired(true);
    });
    return () => onSessionExpired(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const restored = await loadSession().catch(() => null);
      if (restored?.tokens?.refreshToken) {
        // Confirm the saved login still works before showing signed-in screens.
        const refreshed = await refreshAccessToken();
        if (!refreshed) await clearSession();
        else await updateAccessToken(refreshed);
        const flag = await SecureStore.getItemAsync(ONBOARDING_KEY).catch(() => null);
        if (mounted) setOnboardingRequired(refreshed !== null && flag === '1');
      }
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const signInWithOtp = useCallback(async (phoneNumber: string, otp: string) => {
    const response = await api.post<VerifyOtpResponse>('/auth/verify-otp', {
      appType: 'PILGRIM_APP',
      deviceId: await deviceId(),
      deviceName: deviceName(),
      otp,
      phoneNumber,
      platform: devicePlatform(),
    });
    setSessionExpired(false);
    const required = await establish(response);
    setOnboardingRequired(required);
    return required;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const supabaseAccessToken = await startGoogleLogin();
      const payload: GoogleLoginRequest = {
        appType: 'PILGRIM_APP',
        deviceId: await deviceId(),
        deviceName: deviceName(),
        platform: devicePlatform(),
        supabaseAccessToken,
      };
      const response = await api.post<VerifyOtpResponse>('/auth/google', payload);
      setSessionExpired(false);
      const required = await establish(response);
      setOnboardingRequired(required);
      return required;
    } catch (cause) {
      if (cause instanceof GoogleLoginCancelledError) return null;
      throw cause;
    }
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = session.tokens?.refreshToken;
    if (refreshToken) {
      const payload: LogoutRequest = {
        deactivateDeviceToken: false,
        deviceId: await deviceId(),
        refreshToken,
      };
      await api.post('/auth/logout', payload).catch(() => undefined);
    }
    await clearSession();
    await SecureStore.deleteItemAsync(ONBOARDING_KEY).catch(() => undefined);
    setOnboardingRequired(false);
  }, [session.tokens?.refreshToken]);

  const updateName = useCallback(
    async (displayName: string) => {
      const input: UpdateAuthProfileRequest = { displayName };
      const user = await api.request<AuthUserProfile>('/auth/me', { body: input, method: 'PATCH' });
      await saveSession({ ...session, user });
      await SecureStore.setItemAsync(ONBOARDING_KEY, '0');
      setOnboardingRequired(false);
    },
    [session],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      logout,
      onboardingRequired,
      ready,
      sessionExpired,
      signedIn: Boolean(session.tokens?.accessToken && session.user),
      signInWithGoogle,
      signInWithOtp,
      updateName,
      user: session.user,
    }),
    [
      logout,
      onboardingRequired,
      ready,
      session.tokens?.accessToken,
      session.user,
      sessionExpired,
      signInWithGoogle,
      signInWithOtp,
      updateName,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
