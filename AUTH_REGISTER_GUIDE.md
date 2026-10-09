# Q-Dcom authentication and registration handoff

This guide records the current authentication contract and registration UI.

## Current flow

- The auth screen is rendered by `components/qdcom-app.tsx` before the inventory workspace.
- Google Identity Services, through `@react-oauth/google`, requests the user's Google identity plus the restricted-to-app-data `drive.appdata` scope. The shared provider lives in `components/google-auth-provider.tsx`; the scoped login button is in `components/google-drive-login-button.tsx`.
- Submitting member ID, name, specialty, and an optional avatar saves the profile under `qdcom.local_members.v1` and `qdcom.user_profile.v1` in `localStorage`, then opens the workspace immediately without requiring Google OAuth.
- Returning local members can enter their ID in login mode. Signing out removes only the active profile; locally registered profiles stay on the device for later ID sign-in.
- Local ID entry is device-local convenience, not secure authentication: there is no server-side verification, password, or cross-device identity. Do not treat the browser-stored profile as authorization for protected data.
- Avatar images must be image files no larger than 700 KB and are stored as data URLs with the local profile.
- Google sign-in verifies the user's email through Google's user-info endpoint, saves the active profile in `qdcom.user_profile.v1`, and opens the inventory workspace.
- Once Google is connected, changes to products, bot vocabulary, or the Q-Dcom member list are debounced and synchronized to `Q-Dcom_Backup.json` in the account's private Drive `appDataFolder`. Sign-out waits for a final backup and stays signed in if that backup fails.
- OAuth access tokens remain in memory and are not stored in browser storage. After a page reload or token expiration, reconnect Google Drive from Settings before expecting more automatic backups or signing out.

## Google OAuth configuration

- Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in the local `.env.local` and deployment environment. `.env.example` contains the currently requested public client ID as a setup example.
- `NEXT_PUBLIC_` values are embedded in client bundles at build time. Restart the development server after changing the local value and rebuild/redeploy after changing a production value.
- Add each app origin (including localhost and production domains) to the authorized JavaScript origins for the corresponding OAuth client in Google Cloud Console.
- Enable the Google Drive API and configure the OAuth consent screen for `https://www.googleapis.com/auth/drive.appdata`. Google's consent-screen verification requirements may apply before enabling this scope for users outside the test-user list.
- The client ID is public configuration, not a client secret. Never put OAuth client secrets in `NEXT_PUBLIC_` variables or commit them.

## Relevant implementation files

- `components/qdcom-app.tsx`: local registration/ID sign-in, Google credential handling, and device-local profile persistence.
- `components/google-auth-provider.tsx`: Google OAuth provider and Vietnamese button locale.
- `app/globals.css`: translucent glass registration/login styling and responsive breakpoints.
- `.env.example`: safe-to-copy public OAuth configuration example.

## Follow-up work before expanding account features

1. Choose an authoritative backend and employee directory before enabling workplace lookup or cross-device member profiles.
2. Implement server-side identity verification and authorization before treating a browser-stored profile as a secure account.
3. If secure accounts are required, add a backend with identity verification, authorization, and session management; do not rely on localStorage as an authentication boundary.
4. Add browser-level tests for registration validation, Google sign-in, mobile layout, and OAuth configuration once the project has an end-to-end test setup.
