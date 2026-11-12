# Android ID proof picker

The installed Expo document picker (57.0.1) launches `ACTION_OPEN_DOCUMENT`.
On devices without an enabled handler, Android throws `ActivityNotFoundException`.
Expo also leaves its pending promise set after this launch failure, blocking retries.

`patches/expo-document-picker+57.0.1.patch` adds an `ACTION_GET_CONTENT` fallback,
preserving MIME options, selection results and copying to the app cache. All launch
failures clear the pending promise. The root `postinstall` applies this patch.
Both checkout screens show a translated Files-app instruction if neither handler
is available. An unsuccessful replacement selection preserves the previous ID.

Android reference: https://developer.android.com/guide/components/intents-common#Storage

## Release and device verification

Build and install a new APK from `apps/pilgrim-app`:

```sh
npx eas-cli build --platform android --profile preview
```

An OTA update alone cannot deliver the native fallback. Expo Go also uses its own
native picker and will not include this patch.

Verify on an Android test device/emulator:

1. With the system picker enabled, upload a JPEG, PNG and PDF under 5 MB.
2. With DocumentsUI disabled and a compatible file provider installed, verify
   the fallback selects and uploads the same file types.
3. With neither handler available, verify the Files instruction appears. Enable
   the system picker and retry without restarting the app; it must open normally.
4. Cancel a replacement selection and confirm the previous ID remains selected.
5. Confirm unsupported files and files over 5 MB are still rejected.

Do not disable system apps on a personal device for testing.
