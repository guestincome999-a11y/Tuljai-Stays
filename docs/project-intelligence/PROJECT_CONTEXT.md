# Tuljai Stays — verified audit checkpoint

Read AUDIT_STATUS.md first. This is an incomplete investigation checkpoint, not production certification.

Tuljai Stays is a Tuljapur pilgrimage accommodation platform with Expo pilgrim and owner applications, a Next.js admin panel, and NestJS/Fastify backend. npm workspaces cover apps/*, backend and packages/*. Shared packages are types, utils, shared and ui. Existing README and early architecture/limitation documents are stale: real booking, QR, payments, notifications and financial workflows exist.

Audited local branch main at ac78961b94f3c6dbcb15ba98fc5314d5d93186df; clean at start. HEAD restores the original pilgrim UI. History has 713 reachable commits and tag v1.0.0. Branch switching and application changes are prohibited for this audit. Preserve all existing state. Only docs/project-intelligence is being written.

Backend uses Prisma/PostgreSQL, JWT sessions, role/resource authorization, Razorpay, Supabase storage/auth integration, Firebase push and Socket.IO. Authentication has owner/password, admin/password/OTP and Google-related paths. Follow actual code rather than assuming every path shares the same controls. Booking holds, cash owner approval and prepaid confirmation are distinct workflows. Commission accounting includes database migrations/triggers and financial reporting; it is not merely a frontend amount.

Current high-priority source findings under consolidation:

- Owner report query lodgeId overrides authorized lodge IDs (operations.service.ts:526,595).
- Owner password login can admit administrator roles without admin MFA; adminSetPassword lacks a target-role hierarchy check (auth.service.ts:404,585).
- Prepaid confirmation commits booking before payment collection persistence, with awaited audit/notification work between them; interruption can strand a paid booking.
- Availability checks and booking lock consumption have concurrency gaps; no overselling guarantee established.
- Restored pilgrim root and retained v2 routes have provider incompatibilities; owner price events and legacy mock fallback require correction.

These are local source findings. Render backend and admin both report live commit 8ccc63076fb39f94db8575f1663e77cea21db2d6, which is absent from local object database. Inspect that revision before attributing every finding to production. Render workspace was explicitly confirmed by user; see 16_DEPLOYMENT_AND_OPERATIONS_AUDIT.md.

Supabase project heypsutewmttbscuwqje is accessible and reported PostgreSQL 17. Public RLS is disabled, but tested anonymous CRUD privileges and authenticated SELECT privileges are denied. Do not infer public exposure from RLS alone. Full live schema/drift investigation remains pending.

Runtime Node 22.23.0/npm 10.9.8; declared npm 10.8.0. No dependency installation or upgrade. Workspace presence check passed; typecheck/lint started, final results pending. No isolated integration suite, live booking/payment transaction or physical-device test has been executed.

Follow the numbered audit reports as they are added. Never treat a missing report as completed work. Resume remaining tasks listed in AUDIT_STATUS.md and update this context after authorized architecture/behavior/deployment changes.
