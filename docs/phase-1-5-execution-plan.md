# Tuljai Stays — Phase 1–5 execution plan

This document tracks the production implementation of the requested platform work. All changes are additive unless a bug fix is required. Tuljapur is the sole operating town and INR is the sole currency; no city selector or multi-currency logic is introduced.

## Verification gates

- Production admin OTP is never returned or rendered.
- Every admin API is authenticated and server-side authorized.
- Booking, payment, commission and settlement records are never destructively migrated.
- Coupon, festival pricing, cancellation and refund calculations are deterministic and covered by tests.
- Owner bank account numbers are encrypted at rest and never returned unmasked.
- Realtime messaging is scoped to a booking and its authorized participants.
- Data export/deletion actions are audited.
- Invoice generation uses INR only.
