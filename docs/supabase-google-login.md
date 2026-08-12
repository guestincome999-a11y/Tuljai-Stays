# Supabase Google Login Setup

Tuljai Stays uses Supabase to verify the Google identity, then exchanges that identity for the
existing Tuljai access token, refresh token, and device session. Supabase credentials never assign
Tuljai roles directly.

## 1. Configure Google and Supabase

1. In Google Auth Platform, create a **Web application** OAuth client.
2. Add this authorized redirect URI, replacing the project reference:

   `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`

3. In Supabase Dashboard, open **Authentication → Providers → Google**, enable Google, and enter
   the web client ID and client secret.
4. In **Authentication → URL Configuration**, add this redirect URL:

   `tuljai-stays://auth/google`

## 2. Configure the pilgrim app

Provide these variables locally and in every EAS build environment:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

The publishable key is intended for the app. Never put `SUPABASE_SERVICE_ROLE_KEY` in an Expo
variable or mobile build.

## 3. Configure and migrate the backend

The backend needs its existing server-only variables:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
```

Deploy the included database migration before enabling the button in a production build:

```text
npm run db:deploy
```

## Pilgrim name behavior

For Google logins, `user_metadata.full_name` is stored as the pilgrim display name exactly as
Google returns it. The name is refreshed from Google on every Google sign-in; `user_metadata.name`
is used only if `full_name` is unavailable.
