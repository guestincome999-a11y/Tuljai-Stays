# Pilgrim App UI Audit and Improvement Plan

## Scope and principles

This plan covers only `apps/pilgrim-app`. Existing Expo Router navigation, authentication, realtime updates, local caches, and backend API contracts remain unchanged. Work should be delivered screen by screen, reusing React Native Paper, Expo icons, Reanimated, and the dependencies already installed.

The visual direction is devotional without becoming ornamental: saffron as the primary action colour, deep red for important emphasis, restrained gold highlights, warm neutral surfaces, generous whitespace, rounded cards, clear type hierarchy, and short lightweight transitions. Components must allow text growth for Marathi, Hindi, and English and must not depend on fixed text widths.

## Existing routes and implemented screens

| Route                  | Current experience                              | Planned screen mapping                              |
| ---------------------- | ----------------------------------------------- | --------------------------------------------------- |
| `/`                    | Animated bootstrap/splash                       | Splash                                              |
| `/(auth)/login`        | Mobile-number login                             | Language selection entry and OTP login              |
| `/(auth)/verify-otp`   | OTP verification                                | OTP verification                                    |
| `/(app)/home`          | Discovery home                                  | Home                                                |
| `/(app)/lodges`        | Search, filters, lodge results                  | Search and filters; lodge listings                  |
| `/(app)/lodges/[id]`   | Details, photos, rooms and directions           | Lodge details; photo gallery; room selection        |
| `/(app)/bookings/new`  | Availability, room, guests and submit flow      | Room selection; guest details; booking confirmation |
| `/(app)/bookings`      | Filtered booking list                           | My bookings                                         |
| `/(app)/bookings/[id]` | Booking lifecycle and QR readiness              | Booking details; booking confirmation               |
| `/(app)/pass`          | Dedicated current-stay pass                     | Current booking QR check-in                         |
| `/(app)/notifications` | Notification list                               | Notifications                                       |
| `/(app)/announcements` | Announcement list                               | Supporting temple/travel notices                    |
| `/(app)/profile`       | Profile, cache controls and inline support copy | Profile; help and support                           |

The app shell uses authenticated tabs for Home, Lodges, Bookings, and Profile, with a dedicated centre Pass action. Announcements, Notifications, and Pass are hidden tab routes opened from their dedicated actions. The root shell provides Paper theme, error boundary, connectivity, authentication, realtime updates, and a global offline banner.

## API and state connections to preserve

- Authentication: `/auth/request-otp`, `/auth/verify-otp`, `/auth/refresh-token`, and `/auth/logout`.
- Discovery: `/api/cities`, `/api/amenities`, `/api/lodges`, lodge detail, lodge photos, and room-type endpoints.
- Booking: availability, lock, create booking, my bookings, booking detail, and booking QR endpoints.
- Communication: announcements, notifications, read state, unread count, device push registration, and realtime events.
- Configuration: public settings and public feature flags.
- Resilience: secure token storage, network awareness, recently viewed lodges, booking summary cache, resilient images, error boundary, and offline banner.

## Missing or combined experiences

- Language selection has no route or persisted preference UI.
- Photo gallery is embedded in lodge details rather than a dedicated gallery route.
- Room selection, guest details, and confirmation are combined into one long booking form.
- QR route currently renders the complete booking details screen rather than a focused check-in pass.
- Help and support is inline in Profile and has no dedicated route or contact actions.
- There is no reusable confirmation modal or shared input-field wrapper yet.
- Empty/error/loading patterns exist, but are not visually or behaviorally consistent across screens.

These can be separated incrementally with nested routes while preserving the same hooks and payloads. No new route should duplicate server state or introduce permanent placeholder data.

## Reusable component audit

Existing reusable pieces include `AppScreen`, `EmptyState`, `LodgeCard`, `LodgeSearchBar`, `LodgeFilterSheet`, `BookingCard`, `BookingStatusChip`, `BookingTimeline`, `QrPassCard`, `ResilientImage`, `OfflineBanner`, `FormErrorBanner`, `PushPermissionCard`, and `AppErrorBoundary`.

The first UI foundation adds Pilgrim-specific theme tokens plus `AppHeader`, `PrimaryButton`, `SecondaryButton`, `PilgrimSearchBar`, `SectionHeading`, `StateCard`, and `LoadingSkeleton`. Later screen passes should add `PilgrimInput`, `RoomCard`, `StatusBadge`, `ImageCarousel`, `BottomNavigation`, `EmptyState`, `ErrorState`, `OfflineState`, `ConfirmationModal`, and a focused `QrCheckInCard`, migrating current components instead of duplicating them.

## Inconsistencies found

- Most cards use an 8px radius while screen density and spacing vary.
- Raw Paper buttons, cards, headings, loaders, and errors are composed differently per screen.
- Bottom tabs have default presentation and no devotional/travel icon language.
- Home previously gave the search, permission prompt, festival message, hero, filters, errors, announcements, and listings equal visual weight.
- Several screens use fixed English labels without planning for longer Marathi/Hindi strings.
- The splash Marathi line and several separator characters appear mojibake-corrupted in source.
- Loading uses isolated spinners even where content skeletons would reduce perceived delay.
- Error and offline messaging sometimes explains the problem but does not always offer a clear recovery action.
- Lodge and booking cards need a consistent image ratio, badge position, metadata hierarchy, price emphasis, and minimum touch targets.
- Forms are long, visually flat, and lack progressive section/step cues.

## Screen-by-screen implementation sequence

1. **Foundation and Home (current pass):** apply the premium palette, semantic tokens, reusable header/search/buttons/state/skeleton primitives, and a calmer Home hierarchy. Keep discovery hooks and navigation unchanged.
2. **App shell and navigation:** add meaningful tab icons, safe-area-aware styling, consistent stack headers, notification badge behavior, and accessible labels.
3. **Splash, language, and OTP:** repair multilingual source strings, introduce language selection and persistence, improve phone/OTP focus states, validation, resend timing, and keyboard behavior.
4. **Search, filters, and listings:** make filters a clear bottom sheet, show active filter count, add result context, migrate to the refined Lodge Card, and standardize empty/error/offline/loading states.
5. **Lodge details and gallery:** use a reusable image carousel, stronger trust/location metadata, compact amenity icons, readable rules, and a focused full-screen gallery.
6. **Room and booking flow:** introduce reusable Room Cards and input fields, divide the existing flow into visible steps, show a clear price/guest summary, and add a confirmation modal before the unchanged create call.
7. **My bookings and booking details:** refine filters, status badges, booking cards, timeline, response messaging, and contextual actions without altering realtime/cache logic.
8. **QR check-in:** make the QR route focused, add brightness/instruction affordances where supported, preserve the QR API and expiry behavior, and provide robust offline/expired states.
9. **Notifications and announcements:** group by recency, strengthen unread state, retain mark-read actions, and unify empty/error/loading treatments.
10. **Profile and support:** organize identity, language, app preferences, privacy, cache, logout, FAQs, and support into clear sections; add a dedicated support route only when real contact configuration exists.
11. **Accessibility and polish:** verify contrast, dynamic type, screen-reader order, 48px targets, reduced-motion behavior, RTL-safe layout assumptions, keyboard navigation, and Android/iOS safe areas.

## Files modified in the first pass

- `app/_layout.tsx`
- `src/theme/pilgrim-theme.ts`
- `src/components/pilgrim-ui.tsx`
- `src/features/home/screens/HomeScreen.tsx`
- `src/features/lodges/components/LodgeSearchBar.tsx`

## Likely files for later passes

- `app/index.tsx`, `app/(auth)/*`, `app/(app)/_layout.tsx`, and route wrappers for newly separated screens.
- All current feature screen files under `src/features/*/screens`.
- Lodge, booking, QR, notification, offline, error, and image components under `src/components` and `src/features/*/components`.

API modules, hooks, auth state, caches, and realtime providers should only change if a later UI integration exposes an existing type mismatch; their contracts must remain intact.
