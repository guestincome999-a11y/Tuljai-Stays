# Production Page & UX-State Audit — Tuljai Stays

Scope: backend (NestJS/Fastify), admin-panel (Next.js), owner-app (Expo/RN), pilgrim-app (Expo/RN).
This is Phase 1 of a structured audit. No implementation has occurred yet — this document is the
evidence gate required before Phase 3.

Legend for Status: EXISTS_AND_ADEQUATE | EXISTS_NEEDS_IMPROVEMENT | APPLICABLE_MISSING |
NOT_APPLICABLE | BLOCKED_BY_MISSING_INFORMATION

## Legal

| Category | Page/state | Status | Evidence | Applicability reason | Required action |
|---|---|---|---|---|---|
| Legal | Privacy Policy (pilgrim) | EXISTS_NEEDS_IMPROVEMENT | `apps/pilgrim-app/src/pilgrim-ui/legal-documents.tsx`, rendered from `PilgrimProfileScreen.tsx` | App collects phone, guest ID docs, booking/payment data | Verify against `docs/privacy-policy-checklist.md` (retention periods, deletion process, service-provider list still unchecked there) |
| Legal | Terms & Conditions (pilgrim) | EXISTS_NEEDS_IMPROVEMENT | same file, `TermsContent()` | Bookings + payments + user accounts | Cross-check against `docs/terms-checklist.md` (commission model, dispute process unchecked) |
| Legal | Privacy Policy (owner-app) | APPLICABLE_MISSING | No privacy/terms reference found under `apps/owner-app/src` | Owner accounts collect lodge/owner personal + payout-adjacent data | Add owner-facing legal screen, reuse pilgrim content model, reachable from `OwnerSettingsScreen.tsx` |
| Legal | Terms (owner-app) | APPLICABLE_MISSING | same | Owners enter into a commission/booking relationship | Same as above |
| Legal | Cookie Policy / Cookie Preferences | NOT_APPLICABLE | admin-panel is an internal authenticated tool; owner/pilgrim are native apps (no browser cookies) | No public marketing website in repo; no cookie-based tracking found (`grep` for cookie/consent found none) | None — re-evaluate only if a public marketing site is added |
| Legal | Refund Policy | BLOCKED_BY_MISSING_INFORMATION | `backend/src/modules/bookings/prepaid-bookings.service.ts`, Razorpay integration exists | Prepaid bookings exist, so refunds are possible | Need actual refund rules from Jay before publishing |
| Legal | Cancellation Policy | EXISTS_NEEDS_IMPROVEMENT (checklist only, not published) | `docs/terms-checklist.md` "Cancellation and refund foundation" unchecked | Bookings can be cancelled | Needs business input, see open questions |
| Legal | Shipping Policy | NOT_APPLICABLE | No product/shipment models in Prisma schema or backend modules | Lodging booking platform, no physical goods shipped | None |
| Legal | Return/Exchange Policy | NOT_APPLICABLE | Same as above | No physical goods | None |
| Legal | Disclaimer | APPLICABLE_MISSING | Platform intermediates third-party lodges (`legal-documents.tsx` §1 "not the owner or operator of every listed property") | Needs explicit liability-limitation disclaimer surfaced outside legal doc too | Draft using existing "who we are" language already vetted in pilgrim legal doc |
| Legal | Accessibility Statement | APPLICABLE_MISSING | `docs/accessibility-qa-checklist.md` exists as an internal checklist, no public statement | Public-facing pilgrim/owner apps | Do not claim WCAG conformance; state current status only |
| Legal | Data Processing Agreement | NOT_APPLICABLE (pending confirmation) | No B2B customer contracts found; lodge owners are platform users, not "controllers" contracting Tuljai as processor in current model | Would apply only if lodge owners are legally data controllers requiring a DPA | Confirm with Jay whether lodges are treated as independent data controllers |
| Legal | Acceptable Use Policy | APPLICABLE_MISSING | Guest ID upload, QR system, reviews module exist | Accounts + uploads + reviews | Draft from real features only |
| Legal | Security Policy / Responsible Disclosure | APPLICABLE_MISSING | `docs/security-hardening-report.md`, `docs/production-security-checklist.md` exist internally | Public product; no external vulnerability-reporting channel found | Needs a real reporting email before publishing |
| Legal | Community Guidelines | EXISTS_NEEDS_IMPROVEMENT | `apps/pilgrim-app/src/features/reviews`, `apps/owner-app/.../reviews` (reviews are the only UGC) | Reviews are user-generated content | Lightweight guidelines scoped to reviews only, not full community/social claims |

## Customer lifecycle

| Category | Page/state | Status | Evidence | Applicability reason | Required action |
|---|---|---|---|---|---|
| Lifecycle | Login/Register (pilgrim) | EXISTS_AND_ADEQUATE | `PilgrimAuthScreens.tsx`, OTP-based | Accounts required | None found needed |
| Lifecycle | Login (admin) | EXISTS_AND_ADEQUATE | `apps/admin-panel/app/(auth)/login/page.tsx` | Admin accounts | None |
| Lifecycle | Login/Register/Verify-OTP (owner) | EXISTS_AND_ADEQUATE | `apps/owner-app/app/(auth)/login.tsx`, `verify-otp.tsx`, `register-lodge.tsx`, `pending-approval.tsx` | Owners must log in and register a lodge for approval | None — `pending-approval.tsx` already covers the lodge-approval lifecycle state |
| Lifecycle | Email Verification | NOT_APPLICABLE | Auth is OTP/mobile-based across all three apps (`verify-otp.tsx`, pilgrim OTP screens); no email-verification module in `backend/src/modules` | No email-based auth flow | None |
| Lifecycle | Forgot/Reset Password | NOT_APPLICABLE | OTP is the sole credential in all three apps (confirmed: owner-app `verify-otp.tsx`, pilgrim OTP screens, no password field found) | Only applies to password-based auth | None |
| Lifecycle | Onboarding (pilgrim) | EXISTS_AND_ADEQUATE | `PilgrimOnboardingScreen.tsx` | New pilgrim users | None |
| Lifecycle | Onboarding/registration (owner) | EXISTS_AND_ADEQUATE | `apps/owner-app/app/(auth)/register-lodge.tsx` + `pending-approval.tsx` | Owners need lodge/room setup + approval gating | None |
| Lifecycle | Account Settings | EXISTS_AND_ADEQUATE | `OwnerSettingsScreen.tsx`, `PilgrimProfileScreen.tsx`, admin `account/page.tsx` | All three apps | None |
| Lifecycle | Billing/Upgrade/Downgrade/Cancel Subscription | NOT_APPLICABLE | No subscription model found anywhere in `backend/src` or `packages` | No subscription product exists (commission-based booking model) | None |
| Lifecycle | Payment Success/Failed/Pending | APPLICABLE_MISSING (needs deeper verification) | `backend/src/modules/payments/payments.controller.ts`, `razorpay.service.ts`, pilgrim `AnimatedResultBadge`/pending "Pay at lodge" states (per prior session work) | Prepaid Razorpay bookings exist | Confirm whether payment status is verified from backend/webhook (not URL params) end-to-end across all entry points, not just the flows built in the last session |
| Lifecycle | Support (in-app contact) | EXISTS_NEEDS_IMPROVEMENT | `admin/support/page.tsx` (internal ticket view exists); `docs/support-contact-readiness.md` shows support email/phone as "Pending business input" | Users need a support path | Cannot publish real contact details until Jay confirms them |
| Lifecycle | Help Center | APPLICABLE_MISSING | No FAQ/help content found in pilgrim or owner apps | Booking + QR flows benefit from self-serve help | Draft from actual features (booking, QR check-in, cancellation) once copy is approved |

## UX / system states

| Category | Page/state | Status | Evidence | Applicability reason | Required action |
|---|---|---|---|---|---|
| UX | 404 / unknown route (admin-panel) | **DONE** | `apps/admin-panel/app/not-found.tsx` | Next.js app router | Implemented, typechecked, linted, verified in production build (`/_not-found` route present) |
| UX | 500 / route error (admin-panel) | **DONE** | `apps/admin-panel/app/error.tsx` | Next.js app router | Implemented — shows generic message + digest reference, no stack traces, retry + dashboard link |
| UX | 500 / root layout error (admin-panel) | **DONE** | `apps/admin-panel/app/global-error.tsx` | Covers errors thrown by the root layout itself, which `error.tsx` cannot catch | Implemented, dependency-free so it renders even if globals.css fails |
| UX | 403 permission-denied (admin-panel) | EXISTS_AND_ADEQUATE | `apps/admin-panel/src/components/PermissionGate.tsx` | Granular roles exist | Shows a clear "Restricted" panel without revealing protected data; functional, no change needed |
| UX | Maintenance | NEEDS VERIFICATION | `apps/admin-panel/src/platform-control/platform-control-config.ts`, `admin/emergency-control` and `admin/festival-control` pages suggest a platform-status flag may already exist | May already be partly covered by festival/emergency control | Inspect config before building a duplicate — next session |
| UX | Offline (owner-app, pilgrim-app) | EXISTS_AND_ADEQUATE | `apps/owner-app/src/components/OfflineBanner.tsx` + `connectivity-context.tsx`; `apps/pilgrim-app/src/components/OfflineBanner.tsx` + `connectivity-context.tsx` | Both mobile apps already detect connectivity | None found needed on first inspection |
| UX | Empty state / No results | NEEDS VERIFICATION | Not yet inspected per-screen | Applies to bookings, lodges lists, reviews | Inspect list screens next session |
| UX | Loading state | NEEDS VERIFICATION (admin-panel partially done) | Admin-panel `AsyncState.tsx` (`LoadingState`/`ErrorBanner`/`EmptyState`) already rolled out to several pages per Phase 10 in progress; mobile apps not yet inspected | Applies broadly | Continue existing Phase 10 admin rollout; inspect mobile apps |
| UX | Session Expired | APPLICABLE_MISSING | Traced `packages/shared/src/api-client.ts`: on a 401, it calls `refreshAccessToken`; if that also fails, it just `throw`s a normalized `ApplicationError` — there is no global handler that clears the session and routes the user back to login. Confirmed in both `apps/owner-app/src/api/client.ts` and pilgrim app's use of the same `ApiClient`. | `JwtAuthStrategy` can invalidate a session mid-request (live revalidation), so a real "your session ended" moment now happens in normal use, not just token expiry | Currently a user just sees a generic per-screen error, not a "please sign in again" flow. This is a real gap — next unblocked item to build |

## Not yet scanned (incomplete — listed for transparency, not guessed)

- Owner-app/pilgrim-app empty-state and loading-state coverage per screen
- Admin-panel maintenance-mode config (`platform-control-config.ts`) vs. a dedicated maintenance page
- CI workflow definitions under `.github/`

## Consolidated questions blocking legal/business content (do not guess)

1. Legal operating name, registered/operating address, and jurisdiction to print on Privacy Policy/Terms.
2. Support email and/or phone (currently "Pending business input" in `docs/support-contact-readiness.md`).
3. Actual refund and cancellation rules for prepaid Razorpay bookings (window, %, process).
4. Security-reporting contact address for a Responsible Disclosure page.
5. Data retention periods for guest ID documents, booking data, and QR/scan logs.
6. Whether lodge owners are to be treated as independent data controllers (affects DPA applicability).

(Previously open question about OTP being the only credential is now resolved — confirmed true across all three apps.)

## Implemented this session

- `apps/admin-panel/app/not-found.tsx` — 404 page, uses existing `.panel`/`.eyebrow`/`.button` design tokens
- `apps/admin-panel/app/error.tsx` — route-level error boundary, safe logging (digest only), retry + dashboard actions
- `apps/admin-panel/app/global-error.tsx` — root-layout error boundary, dependency-free fallback
- Verified: `npm run typecheck --workspace @tuljai/admin-panel` PASSED, `npm run lint --workspace @tuljai/admin-panel` PASSED (pre-existing unrelated lint errors in `admin/support/[id]/page.tsx` and `AdminShell.tsx` left untouched), `npm run build:admin` PASSED with fresh install (`/_not-found` route confirmed present in build output)

## Next unblocked item

Session-expired handling for owner-app and pilgrim-app: when token refresh fails, clear the stored
session and route to login with a "your session ended, please sign in again" message, instead of
letting each screen surface a generic error. This requires touching `packages/shared/src/api-client.ts`
(shared by both apps) plus each app's auth context — will do owner-app first, verify, then mirror to
pilgrim-app per the incremental-edit pattern.
