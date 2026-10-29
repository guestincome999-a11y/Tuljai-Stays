const CHECK_INTERVAL_MS = 5 * 60_000;

interface UpdateClient {
  checkForUpdateAsync: () => Promise<{ isAvailable: boolean; isRollBackToEmbedded?: boolean }>;
  fetchUpdateAsync: () => Promise<unknown>;
}

/** Foreground/reconnect events share one request and cannot create a retry loop. */
export function createUpdateChecker(client: UpdateClient, now: () => number = Date.now) {
  let inFlight = false;
  let lastAttempt: number | null = null;
  return async (): Promise<void> => {
    if (inFlight || (lastAttempt !== null && now() - lastAttempt < CHECK_INTERVAL_MS)) return;
    inFlight = true;
    lastAttempt = now();
    try {
      const update = await client.checkForUpdateAsync();
      if (update.isAvailable || update.isRollBackToEmbedded) await client.fetchUpdateAsync();
    } catch {
      // Keep the installed version usable offline and retry on a later foreground event.
    } finally {
      inFlight = false;
    }
  };
}

/** Never offer to restart during guest entry, payment, login or pass display. */
export function canRestartForUpdate(pathname: string): boolean {
  return !(
    /\/(?:book|booking|pass|auth|login|verify|verify-otp|name|onboarding)(?:\/|$)/u.test(
      pathname,
    ) || /\/bookings\/[^/]+/u.test(pathname)
  );
}
