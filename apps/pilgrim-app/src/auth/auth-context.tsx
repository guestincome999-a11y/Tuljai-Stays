import * as SecureStore from 'expo-secure-store';
import { emptyAuthSession, type AuthSession } from '@tuljai/shared';
import type { AuthUserProfile } from '@tuljai/types';
import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { exchangeGoogleLogin, logoutFromApi, refreshAccessToken, updateAuthProfile, verifyLoginOtp } from './auth-api';
import { clearAuthSession, restoreAuthSession, saveAuthSession, subscribeAuthSession } from './auth-session-store';

type AuthResponseWithOnboarding = { session: AuthSession['activeSession']; tokens: NonNullable<AuthSession['tokens']>; user: AuthUserProfile; onboardingRequired?: boolean };
interface AuthContextValue { bootstrapComplete: boolean; isAuthenticated: boolean; logout(): Promise<void>; refreshSession: () => Promise<string | null>; session: AuthSession; signInWithGoogle(supabaseAccessToken: string): Promise<void>; signInWithOtp(phoneNumber: string, otp: string): Promise<void>; updateProfile(displayName: string): Promise<void>; user: AuthUserProfile | null; }
const ONBOARDING_KEY = 'tuljai.pilgrim.onboarding.required';
const AuthContext = createContext<AuthContextValue | null>(null);
async function setOnboardingRequired(required: boolean) { if (!(await SecureStore.isAvailableAsync())) return; if (required) await SecureStore.setItemAsync(ONBOARDING_KEY, 'true'); else await SecureStore.deleteItemAsync(ONBOARDING_KEY); }
async function isOnboardingRequired() { if (!(await SecureStore.isAvailableAsync())) return false; return (await SecureStore.getItemAsync(ONBOARDING_KEY)) === 'true'; }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter(); const [session, setSession] = useState<AuthSession>(emptyAuthSession); const [bootstrapComplete, setBootstrapComplete] = useState(false);
  useEffect(() => subscribeAuthSession(setSession), []);
  useEffect(() => { let mounted = true; async function restore() { const restored = await restoreAuthSession(); if (!mounted) return; if (restored.tokens?.refreshToken) { const refreshed = await refreshAccessToken(restored.tokens.refreshToken).catch(() => null); if (refreshed) { const nextSession = { ...restored, tokens: { ...restored.tokens, accessToken: refreshed.accessToken } }; await saveAuthSession(nextSession); setSession(nextSession); if (await isOnboardingRequired()) router.replace('/(auth)/onboarding'); } else { await clearAuthSession(); await setOnboardingRequired(false); setSession(emptyAuthSession); } } else setSession(restored); setBootstrapComplete(true); } void restore(); return () => { mounted = false; }; }, [router]);
  const routeAfterLogin = useCallback(async (response: AuthResponseWithOnboarding) => { const required = response.onboardingRequired === true; await setOnboardingRequired(required); router.replace(required ? '/(auth)/onboarding' : '/(app)/home'); }, [router]);
  const signInWithOtp = useCallback(async (phoneNumber: string, otp: string) => { const response = (await verifyLoginOtp(phoneNumber, otp)) as AuthResponseWithOnboarding; const nextSession: AuthSession = { activeSession: response.session, tokens: response.tokens, user: response.user }; await saveAuthSession(nextSession); setSession(nextSession); await routeAfterLogin(response); }, [routeAfterLogin]);
  const signInWithGoogle = useCallback(async (supabaseAccessToken: string) => { const response = (await exchangeGoogleLogin(supabaseAccessToken)) as AuthResponseWithOnboarding; const nextSession: AuthSession = { activeSession: response.session, tokens: response.tokens, user: response.user }; await saveAuthSession(nextSession); setSession(nextSession); await routeAfterLogin(response); }, [routeAfterLogin]);
  const logout = useCallback(async () => { const refreshToken = session.tokens?.refreshToken; if (refreshToken) await logoutFromApi(refreshToken).catch(() => undefined); await clearAuthSession(); await setOnboardingRequired(false); setSession(emptyAuthSession); router.replace('/(auth)/login'); }, [router, session.tokens?.refreshToken]);
  const refreshSession = useCallback(async (): Promise<string | null> => { const refreshToken = session.tokens?.refreshToken; if (!refreshToken || !session.tokens) return null; const refreshed = await refreshAccessToken(refreshToken).catch(() => null); if (!refreshed) return null; const nextSession: AuthSession = { ...session, tokens: { ...session.tokens, accessToken: refreshed.accessToken } }; await saveAuthSession(nextSession); setSession(nextSession); return refreshed.accessToken; }, [session]);
  const updateProfile = useCallback(async (displayName: string) => { const user = await updateAuthProfile({ displayName }); const nextSession = { ...session, user }; await saveAuthSession(nextSession); setSession(nextSession); await setOnboardingRequired(false); }, [session]);
  const value = useMemo<AuthContextValue>(() => ({ bootstrapComplete, isAuthenticated: Boolean(session.tokens?.accessToken && session.user), logout, refreshSession, session, signInWithGoogle, signInWithOtp, updateProfile, user: session.user }), [bootstrapComplete, logout, refreshSession, session, signInWithGoogle, signInWithOtp, updateProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthContextValue { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used inside AuthProvider'); return context; }
