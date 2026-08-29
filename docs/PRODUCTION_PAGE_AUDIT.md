# Production Page & UX-State Audit — Tuljai Stays

Scope: backend (NestJS/Fastify), admin-panel (Next.js), owner-app (Expo/RN), pilgrim-app (Expo/RN).
This is Phase 1 of a structured audit. This document is updated as implementation proceeds.

Legend for Status: EXISTS_AND_ADEQUATE | EXISTS_NEEDS_IMPROVEMENT | APPLICABLE_MISSING |
NOT_APPLICABLE | BLOCKED_BY_MISSING_INFORMATION

## Legal

Business facts confirmed by Jay (29 Aug 2026): legal entity **Shri Tuljabhavani Technologies**,
based in Tuljapur, Maharashtra, India; support contact **tuljaistays@gmail.com**, typical reply
4–24 hours; refund/cancellation rules as already drafted in pilgrim Terms; DPA decision delegated
to Claude's judgement (see row below).

| Category | Page/state | Status | Evidence | Applicability reason | Required action |
|---|---|---|---|---|---|
| Legal | Privacy Policy (pilgrim) | **DONE** | `apps/pilgrim-app/src/pilgrim-ui/legal-documents.tsx`, rendered from `PilgrimProfileScreen.tsx` and now also from the new login-screen consent checkbox | App collects phone, guest ID docs, booking/payment data | Legal entity name, address/jurisdiction and real support contact added; still needs a final India-qualified legal review before public launch (flagged in-document) |
| Legal | Terms & Conditions (pilgrim) | **DONE** | same file, `TermsContent()` | Bookings + payments + user accounts | Same as above; governing-law clause now names Tuljapur, Maharashtra courts |
| Legal | Privacy Policy (owner-app) | **DONE** | `apps/owner-app/src/owner-ui/legal-documents.tsx` (new file) | Owner accounts collect lodge/owner personal data + guest data received through bookings | Scoped to data actually collected from owners (no invented banking/payout data — none exists in the codebase) |
| Legal | Terms (owner-app) | **DONE** | same file | Owners enter into a commission/booking relationship | Reachable from `OwnerSettingsScreen.tsx` "Legal" card |
| Legal | Terms/Privacy consent checkbox (pilgrim + owner) | **DONE** | `PilgrimAuthScreens.tsx` login screen, `apps/owner-app/app/(auth)/login.tsx` | Jay requested affirmative consent, not just passive notice text | Real functional checkbox (not decorative) — "Send OTP"/"Get OTP" and "Continue with Google" are disabled until checked; tapping the linked text opens the full document in-app |
| Legal | Terms/Privacy consent checkbox (admin-panel) | NOT_APPLICABLE | Admin accounts are internal, provisioned by ops per `docs/lodge-owner-onboarding.md`-equivalent internal process, not self-registered | No public self-signup exists for staff | None — revisit only if admin-panel ever gains public self-registration |
| Legal | Cookie Policy / Cookie Preferences | NOT_APPLICABLE | admin-panel is an internal authenticated tool; owner/pilgrim are native apps (no browser cookies) | No public marketing website in repo; no cookie-based tracking found | None — re-evaluate only if a public marketing site is added |
| Legal | Refund Policy | EXISTS_NEEDS_IMPROVEMENT | `legal-documents.tsx` §8 "Cancellation, refund and failed payments" (pilgrim) | Prepaid Razorpay bookings exist | Jay confirmed the existing pilgrim T&C language is the source of truth; kept as-is, not rewritten from a guess |
| Legal | Cancellation Policy | EXISTS_NEEDS_IMPROVEMENT | `legal-documents.tsx` §8 (pilgrim) | Bookings can be cancelled | Same as Refund Policy — existing language retained per Jay's instruction |
| Legal | Shipping Policy | NOT_APPLICABLE | No product/shipment models in Prisma schema or backend modules | Lodging booking platform, no physical goods shipped | None |
| Legal | Return/Exchange Policy | NOT_APPLICABLE | Same as above | No physical goods | None |
| Legal | Disclaimer | EXISTS_AND_ADEQUATE | `legal-documents.tsx` §1 "who we are" (both apps) states Tuljai Stays is not the operator of every listed property | Platform intermediates third-party lodges | Covered inline in both legal documents |
| Legal | Accessibility Statement | APPLICABLE_MISSING | `docs/accessibility-qa-checklist.md` exists as an internal checklist, no public statement | Public-facing pilgrim/owner apps | Do not claim WCAG conformance; state current status only — not yet drafted |
| Legal | Data Processing Agreement | **NOT_APPLICABLE (decided)** | No B2B customer contracts found; lodge owners use the Owner App as platform users under the Owner Terms, not as separate customers contracting Tuljai Stays as an independent processor | Jay delegated this decision; reasoning recorded as a code comment at the bottom of `apps/owner-app/src/owner-ui/legal-documents.tsx` | Revisit only if a future enterprise/chain-owner arrangement makes an owner a distinct data controller |
| Legal | Acceptable Use Policy | EXISTS_AND_ADEQUATE | Folded into Terms §8 (pilgrim) / §8 (owner) rather than a separate document | Accounts + uploads + reviews | Covered inline; can be split into a standalone page later if Jay wants a dedicated one |
| Legal | Security Policy / Responsible Disclosure | APPLICABLE_MISSING | `docs/security-hardening-report.md`, `docs/production-security-checklist.md` exist internally | Public product; no external vulnerability-reporting channel found | Needs a real reporting email before publishing — support inbox could be reused if Jay confirms, otherwise needs a dedicated address |
| Legal | Community Guidelines | EXISTS_NEEDS_IMPROVEMENT | `apps/pilgrim-app/src/features/reviews`, `apps/owner-app/.../reviews` (reviews are the only UGC) | Reviews are user-generated content | Lightweight guidelines scoped to reviews only, not yet drafted |

## Customer lifecycle

| Category | Page/state | Status | Evidence | Applicability reason | Required action |
|---|---|---|---|---|---|
| Lifecycle | Login/Register (pilgrim) | EXISTS_AND_ADEQUATE | `PilgrimAuthScreens.tsx`, OTP-based, now with consent checkbox | Accounts required | None |
| Lifecycle | Login (admin) | EXISTS_AND_ADEQUATE | `apps/admin-panel/app/(auth)/login/page.tsx` | Admin accounts | None |
| Lifecycle | Login/Register/Verify-OTP (owner) | EXISTS_AND_ADEQUATE | `apps/owner-app/app/(auth)/login.tsx` (now with consent checkbox), `verify-otp.tsx`, `register-lodge.tsx`, `pending-approval.tsx` | Owners must log in; lodge registration/approval handled by ops per `docs/lodge-owner-onboarding.md` | None |
| Lifecycle | Email Verification | NOT_APPLICABLE | Auth is OTP/mobile-based across all three apps | No email-based auth flow | None |
| Lifecycle | Forgot/Reset Password | NOT_APPLICABLE | OTP is the sole credential in all three apps (confirmed) | Only applies to password-based auth | None |
| Lifecycle | Onboarding (pilgrim) | EXISTS_AND_ADEQUATE | `PilgrimOnboardingScreen.tsx` | New pilgrim users | None |
| Lifecycle | Onboarding/registration (owner) | EXISTS_AND_ADEQUATE | `apps/owner-app/app/(auth)/register-lodge.tsx` + `pending-approval.tsx` | Owners need lodge/room setup + approval gating | None |
| Lifecycle | Account Settings | EXISTS_AND_ADEQUATE | `OwnerSettingsScreen.tsx` (now includes Legal card), `PilgrimProfileScreen.tsx`, admin `account/page.tsx` | All three apps | None |
| Lifecycle | Billing/Upgrade/Downgrade/Cancel Subscription | NOT_APPLICABLE | No subscription model found anywhere in `backend/src` or `packages` | No subscription product exists | None |
| Lifecycle | Payment Success/Failed/Pending | APPLICABLE_MISSING (needs deeper verification) | `backend/src/modules/payments/payments.controller.ts`, `razorpay.service.ts` | Prepaid Razorpay bookings exist | Confirm backend/webhook verification is used end-to-end, not just the flows built in a prior session |
| Lifecycle | Support (in-app contact) | **DONE** | Support email surfaced in both legal-document modals and footers (`tuljaistays@gmail.com`, 4–24hr reply) | Users need a support path | Real contact now published; `admin/support/page.tsx` internal ticket view unchanged |
| Lifecycle | Help Center | APPLICABLE_MISSING | No FAQ/help content found in pilgrim or owner apps | Booking + QR flows benefit from self-serve help | Not yet drafted |

## UX / system states

| Category | Page/state | Status | Evidence | Applicability reason | Required action |
|---|---|---|---|---|---|
| UX | 404 / unknown route (admin-panel) | **DONE** | `apps/admin-panel/app/not-found.tsx` | Next.js app router | Implemented, typechecked, linted, verified in production build |
| UX | 500 / route error (admin-panel) | **DONE** | `apps/admin-panel/app/error.tsx` | Next.js app router | Implemented — generic message + digest reference, no stack traces |
| UX | 500 / root layout error (admin-panel) | **DONE** | `apps/admin-panel/app/global-error.tsx` | Covers errors thrown by the root layout itself | Implemented, dependency-free fallback |
| UX | 403 permission-denied (admin-panel) | EXISTS_AND_ADEQUATE | `apps/admin-panel/src/components/PermissionGate.tsx` | Granular roles exist | No change needed |
| UX | Maintenance | NEEDS VERIFICATION | `apps/admin-panel/src/platform-control/platform-control-config.ts`, `admin/emergency-control` and `admin/festival-control` | May already be partly covered | Inspect config before building a duplicate — next session |
| UX | Offline (owner-app, pilgrim-app) | EXISTS_AND_ADEQUATE | `OfflineBanner.tsx` + `connectivity-context.tsx` in both apps | Both mobile apps already detect connectivity | None found needed |
| UX | Empty state / No results | NEEDS VERIFICATION | Not yet inspected per-screen | Applies to bookings, lodges lists, reviews | Inspect list screens next session |
| UX | Loading state | NEEDS VERIFICATION (admin-panel partially done) | Admin-panel `AsyncState.tsx` rolled out to several pages per Phase 10 in progress | Applies broadly | Continue existing Phase 10 admin rollout; inspect mobile apps |
| UX | Session Expired | **APPLICABLE_MISSING — next item** | `packages/shared/src/api-client.ts`: on a 401, if `refreshAccessToken` also fails, it just `throw`s a normalized `ApplicationError` with no global session-clear/redirect-to-login handler | `JwtAuthStrategy` live revalidation means a real "session ended" moment happens in normal use | Not yet built — see "Next unblocked item" |

## Not yet scanned (incomplete — listed for transparency, not guessed)

- Owner-app/pilgrim-app empty-state and loading-state coverage per screen
- Admin-panel maintenance-mode config (`platform-control-config.ts`) vs. a dedicated maintenance page
- CI workflow definitions under `.github/`

## Resolved business facts (from Jay, 29 Aug 2026)

1. Legal name: **Shri Tuljabhavani Technologies** — added to both legal documents.
2. Address/jurisdiction: **Tuljapur** (Maharashtra) — added as operating base and governing-law forum.
3. Support email: **tuljaistays@gmail.com**, typical reply **4–24 hours** — added to both legal documents, both consent modals, and owner settings.
4. Refund/cancellation rules: Jay confirmed the language already in the pilgrim Terms is the source of truth — retained as-is rather than rewritten from a guess.
5. DPA: delegated to Claude's judgement — decided NOT_APPLICABLE today, reasoning recorded in-code (see owner `legal-documents.tsx`).

## Still open (do not guess)

1. Security-reporting contact for a Responsible Disclosure page (may reuse the support inbox if Jay confirms).
2. Data retention periods for guest ID documents, booking data, and QR/scan logs (currently described only in general terms — "as long as reasonably necessary" — no specific figure has been provided).

## Implemented this session (cumulative)

- `apps/admin-panel/app/not-found.tsx`, `error.tsx`, `global-error.tsx` — 404/500 UX states
- `apps/pilgrim-app/src/pilgrim-ui/legal-documents.tsx` — legal entity, jurisdiction, support contact added
- `apps/pilgrim-app/src/pilgrim-ui/screens/PilgrimAuthScreens.tsx` — real consent checkbox gating login/Google sign-in
- `apps/owner-app/src/owner-ui/legal-documents.tsx` (new) — owner-facing Privacy Policy + Terms
- `apps/owner-app/src/features/settings/screens/OwnerSettingsScreen.tsx` — Legal card added
- `apps/owner-app/app/(auth)/login.tsx` — real consent checkbox gating OTP request
- Verified on a fresh `git clone --depth 1`: shared-package builds PASSED, `typecheck` PASSED for admin-panel, owner-app, and pilgrim-app; `lint` PASSED for admin-panel, owner-app, and pilgrim-app (pre-existing unrelated lint errors elsewhere in admin-panel left untouched); `build:admin` PASSED

## Next unblocked item

Session-expired handling for owner-app and pilgrim-app: when token refresh fails, clear the stored
session and route to login with a "your session ended, please sign in again" message, instead of
letting each screen surface a generic error. Requires touching `packages/shared/src/api-client.ts`
(shared by both apps) plus each app's auth context — owner-app first, verify, then mirror to
pilgrim-app.
