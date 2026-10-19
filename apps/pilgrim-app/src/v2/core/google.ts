import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

let client: SupabaseClient | null = null;

export class GoogleLoginCancelledError extends Error {
  public constructor() {
    super('Google login was cancelled');
    this.name = 'GoogleLoginCancelledError';
  }
}

function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error('Google sign-in is not set up in this build');

  // Supabase is used only to run the Google consent screen. The session it creates is not
  // stored: its token is exchanged for a Tuljai session on our own backend straight away.
  client = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'implicit',
      persistSession: false,
    },
  });
  return client;
}

function readParams(url: string): URLSearchParams {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const fragment = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : '');
  fragment.forEach((value, key) => params.set(key, value));
  return params;
}

/** Opens Google's consent screen and returns the Supabase access token to exchange. */
export async function startGoogleLogin(): Promise<string> {
  const redirectTo = Linking.createURL('auth/google');
  const { data, error } = await supabase().auth.signInWithOAuth({
    options: { redirectTo, scopes: 'openid email profile', skipBrowserRedirect: true },
    provider: 'google',
  });
  if (error || !data.url) throw new Error(error?.message ?? 'Could not start Google sign-in');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new GoogleLoginCancelledError();

  const params = readParams(result.url);
  const oauthError = params.get('error_description') ?? params.get('error');
  if (oauthError) throw new Error(oauthError);
  const accessToken = params.get('access_token');
  if (!accessToken) throw new Error('Google sign-in did not return an access token');
  return accessToken;
}
