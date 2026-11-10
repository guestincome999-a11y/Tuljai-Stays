import type { Notification, PaginatedResponse } from '@tuljai/types';

export interface NotificationSnapshot extends PaginatedResponse<Notification> {
  userId: string;
  unreadIds: string[];
  unreadCount: number;
}

export interface NotificationState {
  items: Notification[];
  readIds: string[];
  unreadCount: number;
  pendingCount: number;
  loading: boolean;
  error: string | null;
}

interface SavedState {
  items: Notification[];
  unreadIds: string[];
  pendingIds: string[];
  readIds?: string[];
}

interface Dependencies {
  fetch: (type?: string) => Promise<NotificationSnapshot>;
  mark: (ids: string[]) => Promise<{ userId: string }>;
  read: (userId: string) => Promise<string | null>;
  write: (userId: string, value: string) => Promise<void>;
  scheduleRetry?: (retry: () => void, delay: number) => () => void;
}

/** One account-scoped read journal and snapshot for lists, headers and native badges.
 * Push/socket payloads are invalidations, never count writes. Only one worker can
 * fetch/mutate; a generation fence discards work spanning a user change or tap.
 */
export function createNotificationState(deps: Dependencies) {
  let userId: string | null = null;
  let epoch = 0;
  let revision = 0;
  let items: Notification[] = [];
  let unread = new Set<string>();
  let pending = new Set<string>();
  let confirmedRead = new Set<string>();
  let ready: Promise<void> = Promise.resolve();
  let disk: Promise<void> = Promise.resolve();
  let worker: Promise<void> | null = null;
  let requested = false;
  let error: string | null = null;
  let loading = false;
  let activeType: string | undefined;
  let retryAttempt = 0;
  let cancelRetry: (() => void) | undefined;
  const visibleItems = new WeakMap<Notification, Notification>();
  let snapshot: NotificationState = {
    items: [],
    readIds: [],
    unreadCount: 0,
    pendingCount: 0,
    loading: false,
    error: null,
  };
  const listeners = new Set<() => void>();

  function publish() {
    const nextItems = items.map((item) => {
      const previous = visibleItems.get(item);
      const readAt =
        pending.has(item.id) || !unread.has(item.id)
          ? (item.readAt ?? previous?.readAt ?? new Date().toISOString())
          : null;
      if (previous?.readAt === readAt) return previous;
      const next = { ...item, readAt };
      visibleItems.set(item, next);
      return next;
    });
    snapshot = {
      items:
        nextItems.length === snapshot.items.length &&
        nextItems.every((item, index) => item === snapshot.items[index])
          ? snapshot.items
          : nextItems,
      unreadCount: [...unread].filter((id) => !pending.has(id)).length,
      pendingCount: pending.size,
      readIds: [
        ...new Set([
          ...confirmedRead,
          ...pending,
          ...items.filter((item) => item.readAt).map((item) => item.id),
        ]),
      ],
      loading,
      error,
    };
    listeners.forEach((listener) => listener());
  }

  function persist() {
    if (!userId) return Promise.resolve();
    const owner = userId;
    const value = JSON.stringify({
      items,
      unreadIds: [...unread],
      pendingIds: [...pending],
      readIds: [...confirmedRead],
    } satisfies SavedState);
    // Capture the account and bytes now: later logins cannot redirect this write.
    const write = disk.catch(() => undefined).then(() => deps.write(owner, value));
    disk = write;
    return write;
  }

  async function activate(nextUserId: string | null) {
    if (userId === nextUserId) return ready;
    const generation = ++epoch;
    cancelRetry?.();
    retryAttempt = 0;
    revision++;
    userId = nextUserId;
    items = [];
    unread = new Set();
    pending = new Set();
    confirmedRead = new Set();
    error = null;
    loading = Boolean(nextUserId);
    publish();
    ready = (async () => {
      if (!nextUserId) return;
      try {
        await disk.catch(() => undefined);
        const raw = await deps.read(nextUserId);
        if (generation !== epoch) return;
        if (raw) {
          const saved = JSON.parse(raw) as SavedState;
          if (
            !Array.isArray(saved.items) ||
            !Array.isArray(saved.unreadIds) ||
            !Array.isArray(saved.pendingIds)
          )
            throw new Error('Invalid notification cache');
          items = saved.items.filter((item) => item.recipientUserId === nextUserId);
          unread = new Set(saved.unreadIds);
          pending = new Set(saved.pendingIds);
          confirmedRead = new Set(saved.readIds ?? []);
        }
      } catch {
        if (generation === epoch)
          error = 'Saved notifications could not be loaded. Refresh to try again.';
      }
      if (generation === epoch) {
        loading = false;
        publish();
      }
    })();
    return ready;
  }

  async function run() {
    while (requested && userId) {
      requested = false;
      const generation = epoch;
      await ready;
      if (generation !== epoch) {
        requested = Boolean(userId);
        continue;
      }
      const version = revision;
      loading = true;
      publish();
      try {
        // Never issue a mutation before its durable journal write finishes.
        await disk;
        if (generation !== epoch) continue;
        const batch = [...pending].slice(0, 1000);
        if (batch.length) {
          const result = await deps.mark(batch);
          if (generation !== epoch) continue;
          if (result.userId !== userId) throw new Error('Notification account changed');
          batch.forEach((id) => {
            pending.delete(id);
            unread.delete(id);
            confirmedRead.add(id);
          });
          // Only recent acknowledgements are needed to clean delivered native alerts.
          confirmedRead = new Set([...confirmedRead].slice(-2000));
          await persist();
          if (generation !== epoch) continue;
          if (pending.size) {
            requested = true;
            continue;
          }
        }
        const result = await deps.fetch(activeType);
        if (generation !== epoch) continue;
        if (result.userId !== userId) throw new Error('Notification account changed');
        if (version !== revision) {
          requested = true;
          continue;
        }
        if (!Array.isArray(result.unreadIds))
          throw new Error('Notification server update required');
        items = result.items.filter((item) => item.recipientUserId === userId);
        const nextUnread = new Set(result.unreadIds);
        for (const id of unread) if (!nextUnread.has(id)) confirmedRead.add(id);
        confirmedRead = new Set([...confirmedRead].slice(-2000));
        unread = nextUnread;
        error = null;
        retryAttempt = 0;
        await persist();
      } catch {
        if (generation === epoch) {
          error = pending.size
            ? 'Read changes are saved on this device and will sync when connected.'
            : 'Notifications could not be refreshed. Pull to refresh to retry.';
          // A failed write must be retried before any later network mutation.
          disk = disk.catch(() => undefined);
          if (pending.size && retryAttempt < 3 && deps.scheduleRetry) {
            const delay = [1000, 5000, 30000][retryAttempt++] ?? 30000;
            cancelRetry?.();
            cancelRetry = deps.scheduleRetry(() => {
              if (generation === epoch) void refresh();
            }, delay);
          }
        }
        if (generation === epoch) requested = false;
      } finally {
        if (generation === epoch) {
          loading = false;
          publish();
        }
      }
    }
  }

  function refresh(): Promise<void> {
    cancelRetry?.();
    cancelRetry = undefined;
    if (!userId) return Promise.resolve();
    requested = true;
    if (!worker)
      worker = run().finally(() => {
        worker = null;
        if (requested && userId) void refresh();
      });
    return worker;
  }

  async function markIds(ids: string[]) {
    const generation = epoch;
    await ready;
    if (!userId || generation !== epoch) return;
    // Include unknown IDs from a push, but decrement only IDs known to be unread.
    const added = ids.filter(
      (id) => !pending.has(id) && (!items.some((item) => item.id === id) || unread.has(id)),
    );
    if (!added.length) return;
    added.forEach((id) => pending.add(id));
    revision++;
    error = null;
    publish();
    try {
      await persist();
    } catch {
      if (generation !== epoch) return;
      added.forEach((id) => pending.delete(id));
      error = 'Could not save the read action on this device. Please try again.';
      publish();
      return;
    }
    if (generation === epoch) await refresh();
  }

  return {
    activate,
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    setType: (type?: string) => {
      if (activeType !== type) {
        activeType = type;
        revision++;
      }
      return refresh();
    },
    markRead: (id: string) => markIds([id]),
    markAllRead: () => markIds([...unread]),
  };
}
