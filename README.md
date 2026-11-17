# Keesha

Expo SDK 58 app with Clerk sign-in and sign-up screens. Email verification, password
recovery, and Google OAuth are part of the authentication flow. Signed-in users can
open Home, History, and Settings through the bottom navigation. Spending and
transactions use sample data for the UI preview.

## Run and configure Clerk

1. Run `npm ci` (Node 24+ also runs the focused TypeScript tests without another test framework).
2. Create or select a Clerk development application. Configure:
   - Email address + password sign-up/sign-in; require email verification by code.
   - Email-based password recovery and device verification.
   - Google as the only social connection; enable sign-ups.
   - No required username, first/last name, phone, organization selection, or other
     session tasks. Unsupported account requirements are blocked safely in the app.
   - Enable the Native API for native clients. Keep Clerk's applicable bot protection;
     the web registration screen provides the CAPTCHA mount point.
3. Copy `.env.example` to `.env.local` and set your real
   `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` from Clerk's API Keys page. Restart Metro.
   Missing/malformed keys show a setup screen; authentication hooks never run outside
   a configured provider. A key alone cannot enable Google if its connection is disabled.
4. Enable the Google connection in Clerk. For production, configure the Google OAuth
   credentials and consent screen as instructed by Clerk. Put any Google client secret
   in Clerk's dashboard only, never in Expo public configuration.
5. Register the native redirect URL `keesha://sso-callback` in Clerk's allowed redirect
   URLs. The app uses its existing `keesha` scheme with Expo AuthSession and Clerk's
   browser OAuth helper; it does not use the native Google SDK.
6. For web, allow your actual development/production origin and its
   `/sso-callback` URL. Example when using port 8082:
   `http://localhost:8082/sso-callback`. Keep the same hostname and port throughout
   the flow. Clerk/Expo WebBrowser completes the popup callback; cancellation returns
   to the original form. Do not bypass browser popup or origin protections.
7. Start with `npx expo start --web --port 8082`. A blocked/unreachable Clerk service
   cannot authenticate users. Check connection and provider configuration when testing.

Never place a Clerk secret key, Google client secret, or Neon database URL in the app
bundle. Clerk's supported token cache uses SecureStore on native and its web session
mechanism on web. Passwords and codes exist only in transient form state; they are
never placed in navigation parameters, logs, AsyncStorage, or application databases.

## Native builds

Before creating a development or production build, the owner must choose the final
Android package and iOS bundle identifier, register those apps in Clerk, and verify
the native redirect allowlist. Build through EAS using `npx eas-cli@latest build`
with an appropriate development profile and credentials. Native generated directories
must not be hand-edited.

Test browser OAuth in Android and iOS development builds. Expo Go and a successful
JavaScript bundle do not prove that signed native deep-link return works.

## Architecture

- Expo Router protects the sign-in, sign-up, and home routes using Clerk state.
  Home access requires an active session, no pending session tasks, and a
  verified primary email. Root routing and session loss follow the same access policy.
- `src/lib/auth.ts` contains validation, curated errors, and auth-flow orchestration.
  Clerk's current email/password resources and its compatible experimental SSO helper
  are used together; no legacy resource/session activation calls are mixed in.
- Google supports both new and existing Clerk users. Identity linking is managed by
  Clerk; the app never merges users by comparing email addresses.
- Password recovery opens within sign-in. Settings shows the signed-in profile,
  the appearance toggle, and sign-out.
- Shared fields, buttons, verification form, auth shell, and theme avoid duplicated
  layout/state frameworks. All backend authorization remains future work: client
  navigation protection is not an API security boundary.

## Checks

```sh
npm test
npx expo lint
npx tsc --noEmit
```

Focused tests cover registration verification, incorrect/expired codes, device
verification, safe errors, resend timing, duplicate requests, recovery requests,
OAuth cancellation, and session access/sign-out transitions.

Live QA requires a real Clerk development instance: register and verify email,
test wrong/expired codes and resend, sign in/out, recover a password, use Google
with new/existing accounts, cancel OAuth, reload sessions, and open protected deep
links while signed out. Verify both themes, keyboard behavior, screen readers, and
Google return on native devices. Do not use production credentials or real financial data
for testing. Without a real configured development key these live checks remain unverified.

Full product requirements and future Neon/Drizzle backend architecture are in `SPEC.md`.
