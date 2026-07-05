# Staging Environment Plan

## Purpose

Staging must validate production-like deployment, migrations, credentials, and workflows before production.

## Components

- Staging backend Render service
- Staging PostgreSQL database
- Staging admin panel Render service
- Staging Supabase bucket
- Staging Firebase project or test credentials
- Mobile apps pointed at staging API

## Test Data

- Admin test user
- Pilgrim test user
- Owner test user
- Verified lodge
- Room types and rooms
- Sample booking lifecycle records
- QR pass and scan examples
- Notification test devices

## Required Workflow Tests

- Admin login
- Lodge discovery
- Booking request
- Owner accept/reject
- QR generation
- Owner QR scan
- Guest register creation
- Checkout
- Notification delivery
- Feature flag and settings change
- Health check after migration

## Staging Rules

- Never use production secrets in staging.
- Never use real guest identity data.
- Keep staging data clearly marked as test data.
- Run migrations on staging before production.
