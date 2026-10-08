# Q-Dcom authentication and registration handoff

This guide records the current authentication contract and the registration UI so future agents can extend it without accidentally implying that unsupported password authentication exists.

## Current flow

- The auth screen is rendered by `components/qdcom-app.tsx` before the inventory workspace.
- Google Identity Services, through `@react-oauth/google`, is the only authentication provider. The shared provider lives in `components/google-auth-provider.tsx`.
- A successful Google sign-in creates a device-local profile in `localStorage` under `qdcom.user_profile.v1`. Signing out removes that profile from the device.
- The registration form gathers member ID, name, specialty, and password confirmation. Submitting valid details changes the screen to a review/confirmation step and scrolls to Google sign-in; Google sign-in is still required to authenticate, save the profile, and enter the app.
- Password values are only used for client-side length and confirmation checks. They are cleared after the registration form is submitted and are never saved or sent to a server. Do not add password login or password persistence without first designing a real server-side authentication system.
- The workplace select is intentionally disabled. This project has no employee directory or member-ID-to-workplace lookup yet, so do not claim that it autofills until that integration exists.
- Registration profile metadata is local to the current browser/device. It is not synced to a server or other members.

## Google OAuth configuration

- Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in the local `.env.local` and deployment environment. `.env.example` contains the currently requested public client ID as a setup example.
- `NEXT_PUBLIC_` values are embedded in client bundles at build time. Restart the development server after changing the local value and rebuild/redeploy after changing a production value.
- Add each app origin (including localhost and production domains) to the authorized JavaScript origins for the corresponding OAuth client in Google Cloud Console.
- The client ID is public configuration, not a client secret. Never put OAuth client secrets in `NEXT_PUBLIC_` variables or commit them.

## Relevant implementation files

- `components/qdcom-app.tsx`: auth mode, registration validation, Google credential handling, and device-local profile persistence.
- `components/google-auth-provider.tsx`: Google OAuth provider and Vietnamese button locale.
- `app/globals.css`: metallic dark registration/login styling and responsive breakpoints.
- `.env.example`: safe-to-copy public OAuth configuration example.

## Follow-up work before expanding account features

1. Choose an authoritative backend and employee directory before enabling workplace lookup or cross-device member profiles.
2. Implement server-side identity verification and authorization before treating a browser-stored profile as a secure account.
3. If password authentication is ever required, add a backend with password hashing, recovery, rate limiting, and session management; do not reuse or persist the current form's password fields.
4. Add browser-level tests for registration validation, Google sign-in, mobile layout, and OAuth configuration once the project has an end-to-end test setup.
