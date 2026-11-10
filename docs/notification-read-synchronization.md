# Notification read synchronization

## Root causes

The database already persisted `Notification.readAt` and indexed `(recipientUserId, readAt)`.
The principal failures were in the consumers, rather than a missing database column:

- The original Pilgrim provider optimistically changed a separate list and count, suppressed mutation failures, then fetched the unchanged server state. No pending read intent survived a restart.
- The newer Pilgrim notification screen used its first page to write the native badge, while the header and tab used a different query cache. Those paths did not share mutation updates.
- Owner notification hooks maintained a separate list and used an account-independent SecureStore cache. Only `notification:new` refreshed the list; read-count events could update a count without updating read flags.
- Count event payloads and alert push badges could arrive after a newer local read action and restore an obsolete count. Native badge writes were not serialized.
- Bulk reads had no stable selection for retries; an unscoped retry could consume a newly arrived notification. Repeated individual reads also replaced the original read timestamp.
- Token registration did not deactivate a matching token owned by a previous account. Recipient-specific notification events were additionally broadcast to the entire role room.

## Backend contract

`GET /notifications` preserves pagination and filters and adds `userId`, `unreadIds` and `unreadCount`. The page, total and unread-ID selection are read in one repeatable-read transaction. Unread IDs cover all pages and types; only IDs, rather than entire histories, are loaded. The existing recipient/read index supports this selection. Both notification GET endpoints return `Cache-Control: no-store`.

`POST /notifications/read-all` accepts an optional `{ ids: string[] }` body, limited to 1,000 UUIDs per request. The update is atomic and restricted to the authenticated recipient, nondeleted records, the supplied IDs and `readAt: null`. An empty array is a no-op. Legacy bodyless calls first freeze their current unread IDs. The response includes the authoritative count and recipient ID.

`POST /notifications/:id/read` keeps ownership checks, updates only an unread owned record, and returns its persisted state and recipient ID. Repeating it preserves the original `readAt`. Existing response fields and routes remain available.

The authenticated session supplies the app type from the database. Recipient-role filtering keeps Owner and Pilgrim records isolated even when one account has both roles; role-neutral records remain account-wide. No database schema or migration changes are required. New mobile versions require the additive snapshot contract, so deploy the backend before distributing the mobile update. A bodyless legacy client's repeated bulk calls cannot convey an offline snapshot; the exact retry guarantee requires the updated clients.

## Client state and persistence

`packages/shared/src/notification-state.ts` is the shared implementation used by both apps, including both Pilgrim screen generations. Lists, header/tab badges and native badge synchronization subscribe to that state. Count-only consumers subscribe to a primitive count to avoid rerendering on unrelated list/loading changes.

Each app persists an account-specific snapshot and pending-ID journal in its sandbox document directory (account-prefixed localStorage on web). The former Owner SecureStore cache is no longer read. Writes are serialized, use a temporary file, and recover a completed temporary journal after an interrupted replacement. A failed journal write rolls back the optimistic action with a visible error. A failed request retains a visible pending state and the durable IDs.

Only one network worker operates at a time. Account generations reject previous-login responses; mutation revisions reject fetches superseded by a tap. Responses must identify the active user. Pending mutations flush before a new snapshot is accepted. Read-all persists the exact known unread selection and sends batches of at most 1,000 IDs; future arrivals are excluded, including across offline recovery and response-loss retries.

Reconciliation occurs at login, foreground, reconnection, socket connection readiness, notification events, push receipt and manual refresh. Failed pending work has at most three automatic retries (1, 5 and 30 seconds), then waits for a lifecycle event or manual refresh. There is no notification polling loop. Read actions do not block navigation.

## Push and native badges

Push and socket count payloads are invalidation signals, never authoritative count assignments. Duplicate deliveries do not insert local records or increment counters. FCM uses the notification ID as its Android tag and APNs collapse identifier. Alert payloads omit numeric badges, so delayed alerts cannot restore a stale number. Foreground handlers disable payload-driven badge writes.

The native badge writer serializes changes and finishes with the newest state. It dismisses delivered alerts by confirmed/pending read IDs, including IDs outside the loaded page; it does not dismiss the entire tray while a new alert may be arriving. Recent acknowledgement IDs are persisted with a bounded retention of 2,000. Reconciliation also identifies reads made by another device from changes to the authoritative unread set.

FCM/Expo delivery and device registration otherwise retain their existing behavior. A reused token is deactivated for previous account/device registrations within the same app type. Recipient-specific events only go to the recipient's private room.

## Verification commands and scope

```text
npm run test:notifications --workspace @tuljai/backend
npm run test:notifications --workspace @tuljai/pilgrim-app
npm run test:notifications --workspace @tuljai/owner-app
node --test backend/scripts/auth-session.test.mjs
npm run typecheck --workspace @tuljai/shared
npm run typecheck --workspace @tuljai/backend
npm run typecheck --workspace @tuljai/pilgrim-app
npm run typecheck --workspace @tuljai/owner-app
npx eslint backend apps/pilgrim-app apps/owner-app packages/shared
npm run build --workspace @tuljai/backend
```

From `backend`, run `npx prisma generate` and `npx prisma validate`. From each mobile app, run `npx expo export --platform android --max-workers 2` with an ignored output directory.

The notification tests execute the real shared engine, both real app adapters with simulated native storage, the real backend service with a Prisma test double, the actual FCM payload builder and the actual token-registration method. They cover individual/bulk reads, repeated taps, duplicate invalidations, stale responses, concurrent sessions, arrivals during bulk reads, offline recovery/restart, response loss, storage failure, pagination, recipient isolation, badge ordering and bounded retries. They do not substitute for a PostgreSQL integration run or physical-device testing.

## Operational limits

JavaScript cannot guarantee updating a launcher badge while the OS has force-stopped the app. The authoritative state is reconciled on the next launch/foreground. Android launcher support varies, and Expo/APNs may show duplicate alert cards even when the app's notification records and unread count remain deduplicated. No physical-device restart, signed APK/IPA deployment, live database mutation or production rollout is implied by the automated suites and Android JavaScript exports.

The fix was prepared in an isolated worktree to preserve uncommitted work in the connected checkout. Newer main changes, including cancellation/refund recovery and notification deduplication, were integrated before final verification.

## Checkout follow-up

Both checkout implementations now show the existing animated circular tick on a dedicated full-screen success result. The payment-success popup no longer obscures the result or immediately navigates past it. Failure and uncertain-payment states use a separate full-screen cross animation with retry/check-status and return-to-details controls. Retry retains the existing payment-recovery flow, checking an existing order before opening a new payment.

The original checkout now carries numeric room capacities from the backend and checks adults and children before advancing from stay details. Capacity errors appear inline beside the guest counters, and a final guard remains before submission. The newer checkout shares the same capacity helper and displays capacity errors next to its counters. The backend retains its independent capacity validation.

Independent post-commit booking notification streams now persist concurrently, reducing sequential work before the verified response. Signature, captured amount, currency, ownership and booking-transaction checks remain mandatory. No gateway latency improvement is claimed without production timing measurements.
