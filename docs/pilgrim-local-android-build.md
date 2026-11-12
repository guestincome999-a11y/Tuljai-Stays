# Build the pilgrim APK locally on Windows

The native Android project is `apps/pilgrim-app/android`. It is generated from
Expo configuration and is ignored by Git. Android Studio can open this folder.
Local Gradle builds do not use EAS Build quota.

## This computer

- Android SDK: `C:\Users\Admin\AppData\Local\Android\Sdk`
- JDK 17: `C:\Users\Admin\.gradle\jdks\eclipse_adoptium-17-amd64-windows.2`
- Native tools: SDK 36, build tools 35/36 and NDK 27.0/27.1. Gradle installs
  required components on the first build using the SDK's accepted licences.
- Signing: the existing EAS keystore downloaded into the app's ignored
  `credentials/android/keystore.jks` and `credentials.json` files.
- Release configuration: app ID `com.tuljaistays.pilgrim`, version `0.1.0`,
  Android version code `42`, update channel `preview`.
- The app's existing `.env` supplies public configuration; the build uses the
  production backend and disables mocks.

## Rebuild the configured native project

From the repository root in PowerShell:

```powershell
$env:JAVA_HOME = 'C:\Users\Admin\.gradle\jdks\eclipse_adoptium-17-amd64-windows.2'
$env:ANDROID_HOME = 'C:\Users\Admin\AppData\Local\Android\Sdk'
$env:NODE_ENV = 'production'
$env:EXPO_PUBLIC_API_BASE_URL = 'https://tuljai-stays-backend.onrender.com/api'
$env:EXPO_PUBLIC_USE_MOCKS = 'false'
Set-Location apps/pilgrim-app/android
.\gradlew.bat :app:assembleRelease --console=plain --max-workers=1 '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64'
```

The output is `apps/pilgrim-app/android/app/build/outputs/apk/release/app-release.apk`.
It includes the JavaScript bundle and runs without Metro or Expo Go. This command
targets ARM64/32-bit ARM phones and x86_64 emulators. Never distribute an APK built with only `-PreactNativeArchitectures=x86_64` to an ARM phone. Gradle reuses the generic output filename and may clear additional files in its output folder during later builds. Copy distributable APKs outside that folder, for example `.codex-temp/apks/Tuljai-Stays-Android.apk`. Verify the `native-code` line with SDK `aapt dump badging` before distribution.

For Android Studio, open the native folder, select JDK 17 in the Gradle settings,
and use the Gradle task `:app:assembleRelease`. The `.env` is read during bundling.

## Regeneration and signing

Running `npx expo prebuild --platform android --no-install` regenerates native
configuration. After regeneration, reapply the version code, release signing
configuration and preview update request header before distributing an APK.
The generated template otherwise signs release builds with a debug key and
starts at version code 1.

The current generated `android/app/build.gradle` reads the release keystore
fields from `../credentials.json` relative to the Android project. Keep these
credentials private and backed up. Download them again with
`eas credentials --platform android` if necessary; choose the preview profile,
then **credentials.json → Download credentials from EAS to credentials.json**.

Increase the native `versionCode` above the latest installed/cloud version for
future updates. Local builds do not update EAS's remote version counter.

Reference: [Expo's local release build guide](https://docs.expo.dev/guides/local-app-production/).
