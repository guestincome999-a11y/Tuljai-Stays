# Regression Test Checklist

## Backend

- [ ] Auth OTP request, verify, refresh, logout
- [ ] RBAC and role guards
- [ ] Lodge list, detail, verification, owner access
- [ ] Room type, room status, availability
- [ ] Booking create, accept, reject, expire, manual admin update
- [ ] QR generation, payload display, scan, duplicate scan
- [ ] Notifications list, read, delivery logs
- [ ] Settings and feature flags
- [ ] Reports and analytics endpoints
- [ ] Admin operation APIs
- [ ] Health endpoint

## Pilgrim App

- [ ] Login and OTP verification
- [ ] Home and public configuration
- [ ] Lodge discovery and filters
- [ ] Lodge details
- [ ] Booking request flow
- [ ] Booking lifecycle display
- [ ] QR pass display and refresh
- [ ] Notifications and read states
- [ ] Announcements
- [ ] Profile and logout
- [ ] Offline and slow-network states

## Owner App

- [ ] Login and owner role validation
- [ ] Dashboard and reception snapshot
- [ ] Booking alerts
- [ ] Accept/reject booking
- [ ] QR scan
- [ ] Guest register unlock
- [ ] Checkout
- [ ] Room management
- [ ] Notifications
- [ ] Reports
- [ ] Offline and restart behavior

## Admin Panel

- [ ] Login
- [ ] Dashboard
- [ ] Booking control center
- [ ] Lodge, owner, room governance
- [ ] Photo governance
- [ ] Platform control
- [ ] Monitoring and health
- [ ] Business intelligence
- [ ] Permission gates and route visibility
- [ ] Session expiry behavior
