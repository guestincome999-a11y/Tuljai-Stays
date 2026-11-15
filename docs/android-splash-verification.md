# Android splash readiness fix

## Diagnosis

The pilgrim app used the SDK 57 native splash plugin correctly for bundling, but did not take ownership of splash dismissal. Expo Router/native content readiness is not photograph decode readiness. `PilgrimBootstrapScreen` also removed `AnimatedWelcomeSplash` as soon as authentication completed, and its 450 ms animation started at opacity zero before the asynchronous React Native image had loaded. Fast authentication, slow decoding/storage, and route replacement could therefore hide or unmount the photograph before it became visible. The regression tests execute these event orderings against the actual components.

This establishes a startup lifecycle defect. It does not establish that every reported device failure had the same cause: no logs from the originally affected physical devices were supplied. There is no observed evidence that the source PNG is unsupported or exhausts bitmap memory.

## Implementation

- Retain the native splash using module-scope `preventAutoHideAsync()` before React content appears.
- Keep one startup overlay above the route tree and outside the language-keyed route remount. Authentication and deep links can prepare underneath without cancelling image loading.
- Require image `onLoad` and a nonzero image layout before `SplashScreen.hide()`. Keep the photograph fully opaque in a static parent, outside the animated opacity layer; disable the image's own Android fade. After frame boundaries, run the existing 450 ms fade only on the branding. Disable the second native fade.
- Dismiss the overlay only after authentication bootstrap and the entrance finish. Later authentication changes do not remount it.
- Retry the bundled original photograph if cutout decoding fails. Log failures; a second failure releases startup rather than trapping the app. A UI error fallback also releases the native splash after its own layout.
- Explicitly select Android `contain` in the splash plugin, retaining the existing 288 dp size, background, image, icons, and iOS configuration. SDK 57's Android plugin already generates contained density variants; no custom native plugin or dependency is necessary.
- Replace the route-level splash with its existing background, avoiding a second splash component and animation. Navigation/authentication behavior is otherwise unchanged.

The owner application uses a separate temple photograph and does not have the pilgrim photograph's route-local opacity animation. No owner or admin files are changed.

## Image integrity and memory

| Source                             | Dimensions  | Encoding       | File bytes | RGBA decode estimate       |
| ---------------------------------- | ----------- | -------------- | ---------- | -------------------------- |
| `assets/splash-screen.png`         | 1070 × 1470 | 8-bit RGB PNG  | 2,812,148  | 6,291,600 bytes (6.00 MiB) |
| `assets/splash-goddess-cutout.png` | 873 × 1200  | 8-bit RGBA PNG | 1,640,467  | 4,190,400 bytes (4.00 MiB) |

Both original files are unchanged. Neither PNG has an ICC/gamma profile; the original has a `caBX` ancillary provenance chunk. No re-encoding, resizing, lossy compression, color conversion, cropping, or runtime image processing was introduced. Tests pin the original SHA-256 hashes. The overlay requests the cutout without a separate prefetch/decode pass; the larger photograph is only requested if that decode fails. Native and React images can temporarily coexist during handoff. Allocation figures above are estimates, not measured peak process memory.

Expo generates splash drawable PNGs at mdpi 288², hdpi 432², xhdpi 576², xxhdpi 864², and xxxhdpi 1152². Largest native RGBA allocation is 5.06 MiB. These are density-qualified native resources, not a density-scaled oversized `drawable` bitmap. Native themes reference `@drawable/splashscreen_logo`; `MainActivity` registers `SplashScreenManager`. Android's system splash icon masking remains OS-controlled; the React startup overlay retains the existing unmasked arch design and photograph composition.

The production export contains both photographs exactly once, with bytes matching their sources. The fallback adds 2.68 MiB of source image data before APK compression. No application package or lockfile changes are required. The background and native photograph require no JavaScript or network; the React handoff depends only on decoding a bundled asset and measuring its view, not on fetching the photograph.

## Automated verification

- Pilgrim TypeScript and ESLint checks pass.
- Four splash regression tests pass: decode/layout/frame orderings and fully opaque photograph ancestry; fast/slow auth and no remount; local decode fallback and terminal failure; original image hashes/PNG dimensions.
- Expo Android prebuild and public configuration resolution pass with `expo-splash-screen` 57.0.11.
- Production Android export passes; both bundled images match source hashes.
- Full pilgrim tests: 42 tests, 32 pass, 10 existing failures. A clean detached checkout of `origin/main` at `f5255b3f` has 38 tests, 28 pass, and reproduces the exact same ten failing test names. The failures concern booking actions, catalogue/festival test mocks, and the startup auth test harness. They are outside this change.

## Release/device verification

The final `:app:assembleRelease` passed with JDK 17, production API configuration and mocks disabled, including Android release lint. It contains ARM64, ARMv7, and x86-64 libraries. The APK was signed using the existing local release keystore and verified with Android `apksigner` (v2/v3 signatures). No signing credentials are committed.

- App: `com.tuljaistays.pilgrim`, version `0.2.2`, version code `47`.
- Minimum Android API: 24; target API: 36.
- Signed APK: 108,714,002 bytes.
- SHA-256: `bedcac972ba10ac851911561230c7983f059186eef6c60fbe3aef2923a88ebaa`.
- Both full source photographs appear once in the APK and decode to pixels identical to their source PNGs. AAPT shortens physical filenames; the compiled resource table still correctly resolves all five splash density variants and the launch theme.

Only runs whose metadata matches this exact final APK hash are included in the evidence report. Earlier exploratory recordings led to the opaque-photograph adjustment and are excluded from final verification.

All **16 final release-APK cases passed**:

| Android             | Configured RAM / virtual CPU | Display coverage                                       | Cases |
| ------------------- | ---------------------------- | ------------------------------------------------------ | ----- |
| Android 10 / API 29 | 2 GB / 2 cores               | 160, 240, 320, 480, 640 dpi; 360×640 through 1440×2560 | 6     |
| Android 12 / API 31 | 2 GB / 2 cores               | Same five density buckets and resolutions              | 6     |
| Android 10 / API 29 | 3 GB / 2 cores               | 320 dpi, 720×1600                                      | 1     |
| API 37              | 4 GB / 4 cores               | 420 dpi, 1080×2400; normal and simulated hole cutout   | 2     |
| API 37              | 6 GB / 4 cores               | 560 dpi, 1440×3200                                     | 1     |

Tests used fresh emulator profiles, fresh installation/first launch, subsequent launches after force-stop, offline startup (Wi-Fi and mobile data disabled), and `RUNNING_CRITICAL` memory-trim notification during startup. Photographs were observed in startup recordings/lossless screenshots; every accepted run reached the welcome screen. Captured logs have no matched splash decode failures, missing-resource/decode errors, app ANRs, or out-of-memory/crash exceptions. `Get Started` also opened the login screen on the final APK; no OTP or real sign-in request was sent.

API 29/31 cases use actual launcher-icon taps. API 37 cases use standard ADB MAIN/LAUNCHER intents because its launcher search keyboard interfered with automated icon taps; those unsuccessful harness attempts were rerun and not counted as passes. First-boot ADB/WindowManager connection failures happened before app launch and were retried. No application changes were made to bypass these emulator issues.

Available `dumpsys meminfo` snapshots during startup range from 58,992 to 184,204 KiB PSS (about 58–180 MiB). Some first-launch samples preceded process creation. These are samples, not measured peak memory. RAM/CPU constraints and critical-trim delivery do not reproduce every physical low-memory or slow-storage condition; no artificial disk-latency or physical GPU benchmark was performed.

Emulator results and representative screenshots are recorded in [the evidence data](android-splash-evidence/verification.json) and [the matrix](android-splash-evidence/emulator-matrix.png). Physical Android devices are unavailable; these x86-64 emulators use WHPX/SwiftShader and cannot certify every ARM device or OEM GPU driver. Production Play Store/AAB delivery and physical-device performance were not tested.

## References

- [Expo splash-screen API](https://docs.expo.dev/versions/latest/sdk/splash-screen/), checked against installed SDK 57.0.11 source, including native `SplashScreenManager`, `SplashScreenModule`, and Android config-plugin image generation.
- New tests: `apps/pilgrim-app/scripts/splash-readiness.test.mjs`.

## Source files changed

- `apps/pilgrim-app/app.json`
- `apps/pilgrim-app/app/_layout.tsx`
- `apps/pilgrim-app/src/components/StartupSplash.tsx` (new)
- `apps/pilgrim-app/src/components/AnimatedWelcomeSplash.tsx`
- `apps/pilgrim-app/src/components/AppErrorBoundary.tsx`
- `apps/pilgrim-app/src/pilgrim-ui/screens/PilgrimAuthScreens.tsx`
- `apps/pilgrim-app/scripts/splash-readiness.test.mjs` (new)
- `docs/android-splash-verification.md` (this report)
- `docs/android-splash-evidence/verification.json` (APK/resource checks and individual emulator results)
- `docs/android-splash-evidence/emulator-matrix.png` and `api29-startup.png`, `api31-startup.png`, `api37-startup.png` (captured evidence)
