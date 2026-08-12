import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { useMockExperience } from './auth-api';

WebBrowser.maybeCompleteAuthSession();

let supabaseClient: SupabaseClient | null = null;

export class GoogleLoginCancelledError extends Error {
  public constructor() {
    super('Google login was cancelled');
    this.name = 'GoogleLoginCancelledError';
  }
}

export async function startGoogleLogin(): Promise<string> {
  if (useMockExperience()) {
    return 'demo-google-access-token';
  }

  const redirectTo = Linking.createURL('auth/google');
  const { data, error } = await getSupabaseClient().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      scopes: 'openid email profile',
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    throw new Error(error?.message ?? 'Could not start Google login');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    throw new GoogleLoginCancelledError();
  }

  const params = readOAuthParams(result.url);
  const oauthError = params.get('error_description') ?? params.get('error');
  if (oauthError) {
    throw new Error(oauthError);
  }

  const accessToken = params.get('access_token');
  if (!accessToken) {
    throw new Error('Google login did not return an access token');
  }

  return accessToken;
}

function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error('Google login is not configured for this app build');
  }

  supabaseClient = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'implicit',
      persistSession: false,
    },
  });

  return supabaseClient;
}

function readOAuthParams(url: string): URLSearchParams {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const fragmentParams = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : '');

  fragmentParams.forEach((value, key) => params.set(key, value));
  return params;
}
