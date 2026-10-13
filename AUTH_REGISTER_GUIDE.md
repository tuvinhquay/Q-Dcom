# Q-Dcom authentication and registration handoff

This guide records the current authentication contract and registration UI.

## Current flow

- The auth screen is rendered by `components/qdcom-app.tsx` before the inventory workspace.
- Firebase Auth signs in with a Google popup and requests the restricted-to-app-data `drive.appdata` scope. The resulting Google OAuth access token is passed to the existing Drive backup flow. Anonymous visitors can use Firebase Anonymous Auth.
- Submitting member ID, name, specialty, and an optional avatar saves the profile under `qdcom.local_members.v1` and `qdcom.user_profile.v1` in `localStorage`, then opens the workspace immediately without requiring Google OAuth.
- Returning local members can enter their ID in login mode. Signing out removes only the active profile; locally registered profiles stay on the device for later ID sign-in.
- Local ID entry is device-local convenience, not secure authentication: there is no server-side verification, password, or cross-device identity. Do not treat the browser-stored profile as authorization for protected data.
- Avatar images must be image files no larger than 700 KB and are stored as data URLs with the local profile.
- Google sign-in uses Firebase `signInWithPopup`, verifies the user's email through Google's user-info endpoint, saves the active profile in `qdcom.user_profile.v1`, and opens the inventory workspace. The Firebase Google credential's access token is passed unchanged to the existing Drive sync logic.
- Guest sign-in uses `signInAnonymously` and saves a device-local guest profile. Firebase Anonymous Auth must be enabled in the Firebase project.
- Once Google is connected, changes to products, bot vocabulary, or the Q-Dcom member list are debounced and synchronized to `Q-Dcom_Backup.json` in the account's private Drive `appDataFolder`. Sign-out waits for a final backup and stays signed in if that backup fails.
- OAuth access tokens remain in memory and are not stored in browser storage. After a page reload or token expiration, reconnect Google Drive from Settings before expecting more automatic backups or signing out.

## Google OAuth configuration

- Set the `NEXT_PUBLIC_FIREBASE_*` values in `.env.local` and the deployment environment from the Firebase Web App configuration. `.env.example` lists the required variable names.
- `NEXT_PUBLIC_` values are embedded in client bundles at build time. Restart the development server after changing the local value and rebuild/redeploy after changing a production value.
- Enable Google and Anonymous providers in Firebase Console > Authentication > Sign-in method, and add the app's domains (including localhost and deployed Vercel domains) to Authorized domains.
- Enable the Google Drive API and allow the Firebase Google provider to request `https://www.googleapis.com/auth/drive.appdata`. Google's consent-screen verification requirements may apply before enabling this scope for users outside the test-user list.
- While the consent screen is in Testing mode, add every account that needs to sign in to the Test users list. Otherwise Google may reject the OAuth request with `access_denied`.
- Firebase web configuration values are public client configuration, not secrets. Never put OAuth client secrets or access tokens in `NEXT_PUBLIC_` variables or commit them.

## Relevant implementation files

- `lib/firebase.ts`: Firebase app/Auth configuration, Google popup with the Drive scope, and anonymous sign-in.
- `components/qdcom-app.tsx`: local registration/ID sign-in, guest profile handling, Google credential handling, and device-local profile persistence.
- `app/globals.css`: translucent glass registration/login styling and responsive breakpoints.
- `.env.example`: Firebase client configuration variable names.

## Follow-up work before expanding account features

1. Choose an authoritative backend and employee directory before enabling workplace lookup or cross-device member profiles.
2. Implement server-side identity verification and authorization before treating a browser-stored profile as a secure account.
3. If secure accounts are required, add a backend with identity verification, authorization, and session management; do not rely on localStorage as an authentication boundary.
4. Add browser-level tests for registration validation, Google sign-in, mobile layout, and OAuth configuration once the project has an end-to-end test setup.
