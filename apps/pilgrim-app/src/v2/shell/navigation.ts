import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback, useEffect } from 'react';

import { useAuth } from '../core/auth';

/** Small typed wrapper so screens navigate with plain path strings. */
export function useGo() {
  const router = useRouter();
  const push = useCallback((path: string) => router.push(path as Href), [router]);
  const replace = useCallback((path: string) => router.replace(path as Href), [router]);
  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);
  return { back, push, replace };
}

/** Sends people who are not signed in to the login screen and returns them here afterwards. */
export function useRequireAuth(nextPath: string): boolean {
  const auth = useAuth();
  const { replace } = useGo();
  const needsLogin = auth.ready && !auth.signedIn;

  useEffect(() => {
    if (needsLogin) replace(`/login?next=${encodeURIComponent(nextPath)}`);
  }, [needsLogin, nextPath, replace]);

  return auth.ready && auth.signedIn;
}
