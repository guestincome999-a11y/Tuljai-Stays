# Pilgrim-Safe QR Payload

This fix adds a scannable QR payload for the Pilgrim App without exposing sensitive guest, owner, or database information.

## Endpoint

```text
GET /api/bookings/:id/qr
```

Allowed user:

- The pilgrim who owns the booking

Response:

```json
{
  "bookingId": "uuid",
  "bookingCode": "TJS-2026-000001",
  "qrPayload": "tjsqr.v1.<payload>.<signature>",
  "expiresAt": "datetime",
  "status": "ACTIVE",
  "tokenVersion": 1
}
```

## Payload Contents

The signed body includes only:

- `bookingId`
- `bookingCode`
- `qrTokenId`
- `expiresAt`
- `tokenVersion`
- `version`

The payload excludes:

- Guest phone number
- Guest address
- Government ID details
- Owner details
- Internal token hash
- Raw database secrets

## Security Model

The backend stores QR token hashes internally. For pilgrim display, it returns a short-lived signed envelope that references the active QR token row.

The owner scan flow sends the scanned QR payload to:

```text
POST /api/qr/scan
```

The backend verifies:

- Payload format and HMAC signature
- Token reference and token version
- Token active status
- Token expiry
- Token not already used
- Booking status allows QR check-in
- Scanner has lodge access

If all checks pass, the backend marks the token used, checks the guest in, creates the digital guest register, and returns unlocked booking/register details.

## Pilgrim App Behavior

The Pilgrim App renders `qrPayload` with a QR component and never displays the payload as text. The card shows booking summary and expiry time, with refresh support for changed status or expiry.
