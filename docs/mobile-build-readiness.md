# Mobile Build Readiness

## Expo Requirements

- Expo SDK is configured for both mobile apps.
- EAS setup is still required before store builds.
- Production builds must use production `EXPO_PUBLIC_API_BASE_URL`.

## App Identities

Pilgrim app:

- Android package: `com.tuljaistays.pilgrim`
- iOS bundle identifier: `com.tuljaistays.pilgrim`

Owner app:

- Android package: `com.tuljaistays.owner`
- iOS bundle identifier: `com.tuljaistays.owner`

## Versioning

- Current app version: `0.1.0`
- Increase app version for every release candidate distributed to testers.
- Store build numbers must be managed during Play Store/App Store preparation.

## API Configuration

- Local emulator may use `10.0.2.2`.
- Physical devices need a LAN or HTTPS reachable backend.
- Production builds must use HTTPS backend URLs.

## Push Notifications

- FCM credentials must be configured on the backend.
- Expo push token registration exists, but production device testing is required.
- Do not ship notification-dependent workflows without real device tests.

## Owner Camera Permission

- Owner app includes camera permission for QR scanning.
- QR scanner must be tested on physical Android devices before release.

## Store Assets

Play Store and production marketing assets are out of scope for this sequence and should be handled in the release readiness sequence.
