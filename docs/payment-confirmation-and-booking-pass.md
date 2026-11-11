# Payment confirmation and booking pass

## Architecture and root cause

The payment response previously awaited the post-commit booking/owner notification streams and then a payment notification. Gateway latency, synchronous notification queries and push submissions all contributed to checkout latency. Recovery status also fetched the same order's payments twice. Local secure-storage cleanup delayed rendering after confirmation. There was no durable booking-email queue, and the password-reset SMTP wrapper deliberately swallowed delivery errors.

The callback now paints a verification state immediately, calls signature verification once, checks the owned stored intent and authoritative Razorpay capture/amount/currency, and commits inventory, booking, paid receipt, payment intent and two unique outbox jobs together. The HTTP response returns the existing booking DTO for API compatibility. The pilgrim success screen uses that response directly, primes its detail cache and displays booking code, lodge, room, dates, guests and paid amount. Viewing details no longer loads the full booking history. Existing response fields and routes remain compatible.

Razorpay order POSTs run outside inventory transactions. Replays reuse the existing durable order request/receipt and source-lock uniqueness. A stored confirmed intent can return its booking after signature and ownership checks without another gateway read. An uncaptured authorization is pending, not successful. A captured payment whose inventory transaction fails remains in recovery; it never becomes a false confirmation.

Explicit gateway failure receives failure UI immediately. Closing checkout, SDK network errors and HTTP timeouts receive a neutral verification-pending state. The order is saved per user before checkout opens. Reopening checkout first restores and reconciles that order before preparing a new hold. Retry resumes the same order when the backend permits it. Reconciliation is bounded (seven requests with backoff), resumes on foreground or a booking socket update, and has a manual status button. A 12-second watchdog replaces a hung verification loader with the usable pending state.

## Razorpay configuration

Keep automatic capture enabled in the existing Razorpay account. The application confirms only `captured` payments with `captured=true`; it does not capture an authorization itself.

Configure `POST https://<backend-host>/api/payments/razorpay/webhook` for `payment.authorized`, `payment.captured`, `payment.failed`, and `order.paid`. Retain all existing refund events (`refund.created`, `refund.processed`, `refund.failed`, `refund.speed_changed`). Set the matching **backend-only** `RAZORPAY_WEBHOOK_SECRET`. Never reuse the API key secret as the webhook secret.

Fastify raw-body verification uses the exact request bytes. `x-razorpay-event-id` is durably deduplicated. Intake acknowledges only after the database transaction succeeds; a gateway read/confirmation is scheduled independently. The five-second recovery scheduler retries due intents after missed callbacks/webhooks and restarts, with database leases/backoff. Gateway reads, rather than webhook order, decide capture, so delayed failure events cannot demote a paid booking. Existing cancellation/refund intake, accounting and refund-completion rules remain in place.

Post-commit socket hints update pilgrim, lodge, city availability and admin consumers. Durable notification jobs persist the usual alerts using existing notification deduplication and push retry infrastructure. Reconnect/focus retrieves authoritative data; disconnected visible screens use lightweight fallback refresh. Email/PDF generation is independent of those jobs.

## Gmail API setup and Render variables

`EMAIL_PROVIDER=gmail` sends through Gmail's API over HTTPS. Render free web services block outbound SMTP ports 465/587, so this provider does not depend on SMTP connectivity. Existing Nodemailer composes MIME with the PDF and inline images; native HTTPS requests perform OAuth refresh and `users.messages.send`. Access tokens are cached in memory, and concurrent refreshes share one request. No Google SDK dependency is added.

Booking jobs call `TransactionalEmailProvider.submit()`, which throws on failure and reports provider acceptance. Password-reset `send()` retains its non-disclosing behavior. Replacing the provider adapter does not require changing booking logic.

1. Select/create the sender's Google Cloud project and enable **Gmail API**.
2. Configure the OAuth consent screen for `https://www.googleapis.com/auth/gmail.send`. Inbox-read scopes are unnecessary. Add the sender as a test user initially, then complete the consent publishing/verification or Workspace internal configuration appropriate for production. Do not rely on temporary OAuth testing credentials for ongoing delivery.
3. Create an OAuth **Web application** client. For the official OAuth Playground provisioning flow, add `https://developers.google.com/oauthplayground` as an authorized redirect URI.
4. In Google's OAuth Playground settings, enable **Use your own OAuth credentials**. Enter that client ID/secret, select server-side flow, offline access and consent prompt, authorize the actual sender for `gmail.send`, and exchange the code for tokens. Store the refresh token directly as a Render backend secret. Never paste tokens into chat, source files or logs. Remove the temporary Playground redirect afterward if required by your credential policy.
5. Configure only the Render **backend service**, never mobile/admin frontend bundles:

| Variable                           | Value/purpose                                                            |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `EMAIL_PROVIDER`                   | `gmail` (Gmail API over HTTPS)                                           |
| `EMAIL_FROM_NAME`                  | `Tuljai Stays`                                                           |
| `EMAIL_FROM_ADDRESS`               | Actual authorized sender or configured send-as alias                     |
| `GMAIL_CLIENT_ID`                  | OAuth client ID from that Cloud project                                  |
| `GMAIL_CLIENT_SECRET`              | OAuth client secret, stored as a Render secret                           |
| `GMAIL_REFRESH_TOKEN`              | Sender's offline refresh token, stored as a Render secret                |
| `BOOKING_EMAIL_ENABLED`            | Start with `false`; enable for controlled validation, then production    |
| `BOOKING_EMAIL_ALLOWED_RECIPIENTS` | Controlled mailboxes during validation; unset after validation           |
| `EMAIL_SUPPORT_ADDRESS`            | Optional real support mailbox; omit if unavailable                       |
| `BOOKING_WEB_URL_TEMPLATE`         | Optional existing supported HTTPS booking route containing `{bookingId}` |
| `BOOKING_QR_OPAQUE_ENABLED`        | Enable in-app encrypted QR v2 after owner rollout                        |

Gmail API mode does **not** require SMTP credentials or an App Password. `SENT` means accepted by Gmail, not guaranteed inbox delivery. OAuth refresh failures and explicit rate-limit rejections retry with queue backoff. Permission/configuration rejections become terminal. Ambiguous submission/network/server outcomes stop for review instead of risking duplicate mail.

For environments that permit SMTP, `EMAIL_PROVIDER=smtp` retains `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`. Gmail SMTP uses a Google App Password with 2-Step Verification and port 465/TLS or 587/STARTTLS. This alternative needs no Gmail OAuth variables; do not select it on a Render service that blocks those ports. TLS is required. Gmail quotas and sender/alias rules apply to the selected provider.

The allowlist **filters jobs** and never redirects a guest's ticket to a test recipient. Bookings without an email address have a `SKIPPED/NO_RECIPIENT` initial email job. Sending is off unless explicitly enabled; existing confirmed bookings are not backfilled.

## PDF, QR and privacy

`booking-pass.ts` generates a responsive maroon/saffron HTML email with inline QR/logo and an attached PDF using PDFKit and QRCode. Data comes from the committed booking, lodge address/rules and assigned room. Missing times/addresses are described as unavailable, not invented. One booking currently reserves one room, so the pass shows one room. Pay-at-lodge confirmation is queued only on actual acceptance and clearly shows payment pending.

The PDF embeds the existing brand icon and Mukta font (OFL license bundled) so Marathi guest/lodge names render. Nest copies these assets to the production build. No personal documents, ID proof files, internal owner data or arbitrary storage attachments are included. Text is HTML-escaped; links require HTTPS. Attachments are created in memory, not stored in public storage.

Email passes always use authenticated AES-256-GCM QR v2. Internal booking/token IDs are encrypted, and a purpose-derived backend key never reaches an app. The backend continues accepting signed v1 and validates both against the **same existing booking QR token**, expiry, version, lodge ownership and current booking state. QR creation is serialized by the booking row lock so concurrent email/in-app requests reuse one active token. Scanning atomically claims the token, updates booking/inventory and creates the guest register in one transaction. Duplicate scans return the existing authorized check-in. Cancellation/revocation continues to invalidate the pass.

The owner queue recognizes v1/v2, persists pending scans per owner, and retries after restart/reconnect. Offline recognition never claims cryptographic validation or completed check-in: the backend remains authoritative. Encrypted v2 cannot display identity from its payload while offline; verified details appear after server validation.

## Outbox, retries and recovery

Migration `20261111120000_booking_confirmation_outbox` only adds `booking_delivery_jobs`, its booking relation, unique `(booking_id,type,operation)` key, due/lease indexes and private RLS/grants. It does not alter old migrations, rename models or rewrite production rows. Main already has notification dedupe keys; that migration is retained unchanged. The Prisma backend must connect as the table owner or an appropriately privileged backend role, never an anonymous Data API role.

The Nest worker checks due jobs every second, claims them with compare-and-set leases, heartbeats long operations and processes independent jobs concurrently. Separate bounded reads reserve ten notification slots and four email slots per process, so an email backlog or slow provider cannot consume notification intake. States are `PENDING`, `PROCESSING`, `SUBMITTING`, `RETRYING`, `SENT`, `FAILED`, `SKIPPED`. Temporary errors retry after 30s, 60s, 120s, 240s and 480s, up to six attempts. PDF failure and email failure never modify booking/payment state. Cancellation/refund eligibility is rechecked immediately before submission. A cancellation already in flight can still race external provider acceptance; backend scanning always enforces the current booking status.

Neither SMTP nor Gmail messages.send provides an idempotent submission key. If the backend crashes after submission starts, or a Gmail HTTPS/SMTP connection fails with unknown acceptance, automatically resending could duplicate mail. Such jobs become `FAILED/SUBMISSION_UNKNOWN` for operator review; they are **not** automatically resent. Inspect Gmail Sent/provider logs using the deterministic `booking-<job UUID>` Message-ID and the structured provider-acceptance log before deciding on a separately tracked resend. This is an explicit limitation, not an exactly-once delivery claim. The database unique key prevents duplicate initial jobs, and lease fencing prevents simultaneous worker submissions. A future deliberate resend uses a new audited `operation` value; no public resend endpoint is exposed here.

Admin booking detail shows recipient, state, attempts, last attempt/error, provider reference and accepted timestamp. Terminal worker errors and uncertain submissions are logged by job/booking ID without tokens, passwords, SMTP bodies or guest documents. Pending jobs recover after process restart. Inspect permanently failed jobs through this status and backend database/logs; do not reset unknown submissions blindly.

## Verification and deployment

1. Install locked dependencies, generate Prisma, typecheck/lint all four apps, run tests and production builds. For Android, `expo export --platform android` verifies production Metro/Hermes bundling; it is not a signed APK or device payment test.
2. Initialize local PostgreSQL with UTF-8 encoding. Run integration tests only against a new, empty loopback database named `tuljai_test_*`, using `TEST_DATABASE_URL`. The harness refuses remote/nonempty databases and replays migrations. Never point tests at production. Historical migration fixture adaptations are pre-existing; strict historical replay remains a separate audit.
3. For a Render service rooted at this repository, use build command `npm ci && npm run db:generate && npm run build:backend` and start command `npm run start:backend`. Deploy with `BOOKING_EMAIL_ENABLED=false`. Startup runs `prisma migrate deploy`. Review pending migrations against the production ledger; do not edit applied migrations or push schema directly.
4. Deploy the updated owner scanner/queue first. Legacy online scanners forward opaque payloads, but older local recognition extensions may reject v2. Verify both an in-app QR and emailed v2 on supported owner devices before enabling delivery or in-app v2.
5. In **Razorpay test mode**, test capture, explicit decline, checkout dismissal, disconnected callback, callback/webhook order, duplicate events, missed callbacks, temporary booking transaction failure, cancellation and refund initiation/processed events. Never automate a live charge. Verify owner/admin reconnect and availability.
6. Create a test-mode booking with a controlled email address, set its mailbox in `BOOKING_EMAIL_ALLOWED_RECIPIENTS`, and enable sending. Verify provider acceptance, actual inbox receipt, HTML on mobile, PDF download and QR scan. Simulate SMTP outage, invalid recipient, PDF failure and a worker restart. Clear the allowlist only after acceptance. No external credentials or controlled recipient were supplied in this implementation session, so these live checks require the operator.

Timing logs identify `prepaid_hold`, gateway reads/writes, `payment_initiated`, `checkout_callback_received`, `payment_verification_started/completed`, `booking_transaction_completed`, `ui_confirmation_rendered`, `webhook_received`, provider acceptance and `booking_background_completed`. Use order ID/booking ID plus timestamps to compare staging/production percentiles. Local tests establish that background delivery does not participate in confirmation; they do not establish production payment latency or guarantee instantaneous confirmation over every network.

Workspace lint and TypeScript checks, backend/Next production builds, both Android production exports, Prisma validation, PostgreSQL integration tests and the payment/email/QR/mobile regression suites were executed locally. The synthetic PDF was rendered for visual inspection and its QR decoded against the generated server payload. No live Razorpay checkout, real Gmail delivery, signed mobile binary or production migration was performed. The compatible Next security update and shell-quote lockfile update remove critical audit findings; the final dependency audit still reports 24 high, 24 moderate and four low findings outside the added mail/PDF/QR dependencies. These remain a separate dependency-maintenance backlog.

Primary references checked: [Gmail API sending](https://developers.google.com/workspace/gmail/api/guides/sending), [Google offline OAuth](https://developers.google.com/identity/protocols/oauth2/web-server#offline), [Render SMTP restrictions](https://render.com/docs/free), [Razorpay webhooks](https://razorpay.com/docs/webhooks/best-practices/), [Nodemailer SMTP authentication](https://nodemailer.com/guides/using-gmail), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
