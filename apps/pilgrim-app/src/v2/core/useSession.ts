import type { AuthSession } from '@tuljai/shared';
import { useSyncExternalStore } from 'react';

import { currentSession, subscribeSession } from './session';

export function useSession(): AuthSession {
  return useSyncExternalStore(subscribeSession, currentSession);
}
