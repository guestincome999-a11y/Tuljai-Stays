# Razorpay webhook activation

The backend already implements `POST /api/payments/razorpay/webhook`.
It verifies HMAC-SHA256 against the original request bytes, saves event IDs and
payment references in a database transaction, and acknowledges only after that
transaction succeeds. Duplicate events are safe. The recovery worker checks due
payment intents every 30 seconds and verifies captured status, order, amount and
currency with Razorpay before confirming a booking. This does not delay Checkout.

## Configure the backend

1. Deploy the backend including the `20261028180000_payment_recovery` and
   `20261029120000_checkout_idempotency` migrations.
   The normal backend start command runs `prisma migrate deploy`. Resolve any
   migration error before enabling delivery; do not mark a failed migration as applied.
2. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` on the backend for the chosen
   Razorpay mode. Recovery uses these credentials to read authoritative payment state.
3. Set `RAZORPAY_WEBHOOK_SECRET` to a separate, strong random secret in the backend
   hosting environment. Use exactly the same secret in Razorpay's webhook settings.
   Keep it out of mobile/public environment variables and version control.
4. Restart or redeploy the backend to load environment changes.

## Configure Razorpay

Start in Test mode against a test deployment and database. In Razorpay Dashboard's
webhook settings, add the public HTTPS backend URL ending in
`/api/payments/razorpay/webhook`, enter the matching secret, and select:

- `payment.captured`
- `order.paid`
- `payment.failed`

The production URL recorded for this project is
`https://tuljai-stays-backend.onrender.com/api/payments/razorpay/webhook`.
This document does not confirm that the current deployment contains the endpoint
or migration. Enable production delivery after the test flow succeeds and the
production backend has the matching Live-mode configuration.

No app login token is required for the webhook; the signature authenticates it.
Use separate configuration for Test and Live deployments. If rotating the secret,
account for retried events signed with the previous secret before replacing it;
this implementation accepts one configured secret at a time.

## Verify delivery and recovery

1. Create a real Test-mode checkout through the app, so the order and guest details
   are saved before payment (`POST /api/payments/prepaid/prepare`).
2. Complete a Test-mode payment. Confirm Razorpay's delivery log shows HTTP 200
   with `{"received":true}` from the endpoint.
3. Repeat with the app callback deliberately interrupted after paying. Allow the
   worker to reconcile; verify one confirmed booking and its payment record.
   The 30-second worker interval is not a completion guarantee if gateway reads fail.
4. Redeliver the same event and verify that a second booking is not created.
5. Confirm invalid signatures are rejected. A database failure must return a
   non-success response so Razorpay can retry delivery.
6. Review `GET /api/payments/recovery` with an ADMIN token for unmatched orders
   or paid bookings that need manual attention, such as an expired room hold.

## Checkout retries

Send an `Idempotency-Key` header with `POST /api/payments/prepaid/hold`.
Use 16–128 letters, numbers, hyphens or underscores, and retain the same key for
every retry of the same dates/room checkout attempt. Keys are scoped to the
authenticated user. Replaying an active attempt returns its original hold/order;
changing its dates or room, or reusing an ended attempt, returns HTTP 409.
Clients without a key remain compatible but lack initial-hold request deduplication.

Order creation has a durable database claim written before the gateway POST.
If the response is lost or the booking transaction rolls back, retrying recovers
the order by its deterministic receipt. A timeout never automatically triggers a
second gateway POST. Explicit gateway rejections permit retry; an uncertain
outcome without a matching order returns HTTP 503 and requires further lookup
or operator review. Amount and currency changes are rejected. The admin recovery
endpoint's `orderRequests` collection exposes uncertain order creations.

The mobile checkout keeps its attempt key across network retries in the mounted
checkout screen. Once an order is known, the existing pending-payment store
supports app restart recovery. A crash before the order response is received
does not yet persist the initial hold attempt key across app restarts.

The recovery worker runs while the backend instance is running. Its 30-second
interval does not guarantee completion during hosting sleep, restarts or outages.

Local regression checks (synthetic events; no real payment or delivery):

```powershell
npm run test --workspace @tuljai/backend
npm run typecheck --workspace @tuljai/backend
```

Reference: [Razorpay webhook validation, testing, idempotency and ordering](https://razorpay.com/docs/webhooks/validate-test/).
