# Pilgrim app updates without a new APK

The pilgrim app uses Expo EAS Update. Themes, colours, layouts, translations, JavaScript fixes and bundled assets can be published to an installed compatible APK. Native libraries, permissions, app icons/splash configuration and Expo SDK upgrades require a new APK. When native code or native app configuration changes, increment `expo.version` before building or publishing; `runtimeVersion.policy: appVersion` prevents that update from reaching older native runtimes.

## Installed app behavior

The existing `ON_LOAD` update check downloads compatible releases on launch. The app also checks when it returns to the foreground or reconnects, at most once per five minutes. A downloaded update applies on the next cold start. On browsing screens an optional “Update ready” banner lets the guest restart immediately or continue until later. The banner is hidden throughout checkout, booking details with payment actions, login and pass display. Failed checks/downloads leave the installed app usable offline.

## Publishing preview changes

The EAS workflow at `apps/pilgrim-app/.eas/workflows/preview-update.yml` publishes Android updates to the existing `preview` channel after relevant pushes to `fix/price-availability-sync` or `main`. It typechecks and runs update lifecycle tests before publishing. EAS must have the GitHub repository linked and GitHub workflow triggers enabled for this project. No GitHub `EXPO_TOKEN` secret is needed by the EAS-hosted workflow.

To publish manually, from `apps/pilgrim-app`:

```powershell
eas update --channel preview --environment preview --platform android --message "Describe the UI change" --clear-cache --non-interactive
```

Always publish from a tested, committed checkout. EAS Update does not inherit `build.preview.env`; the preview EAS environment must contain the same public API URL, mocks flag, Supabase configuration and payment key as the preview build. The workflow explicitly sets the API URL and mocks flag and loads the remaining values from the `preview` EAS environment.

Production releases remain deliberate: after testing the change, use the `production` channel and `production` environment from the same tested source. A GitHub push is not itself an update unless the workflow successfully publishes it. Server code and database changes still require a backend deployment; they are not distributed through EAS Update.

## Preview build and validation

Build the existing `preview` EAS profile for Android and install its APK. It embeds the `preview` channel and runtime `0.1.0`. Subsequent compatible UI updates target that same channel/runtime without an APK rebuild. Publishing an update with a different app version will not update this APK.

On a real device, publish a visible preview-only UI change, leave and reopen the app, verify the update banner, choose Restart, and confirm the change appears without reinstalling. Check that checkout, payment and pass display never offer an update restart. Also verify that the app remains usable offline. Bundler/typecheck tests alone cannot confirm native update installation on a physical device.

References: [Expo Updates SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/updates/), [runtime compatibility](https://docs.expo.dev/eas-update/runtime-versions/), [EAS workflow update jobs](https://docs.expo.dev/eas/workflows/pre-packaged-jobs/#update).
