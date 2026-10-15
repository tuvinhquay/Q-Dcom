# Q-Dcom authentication and registration handoff

This guide records the current authentication contract and registration UI.

## Current flow

- The auth screen is rendered by `components/qdcom-app.tsx` before the inventory workspace.
- Firebase Auth signs in only with a Google popup and requests the `drive.appdata` backup scope plus the read-only `drive.metadata.readonly` quota scope. Anonymous Auth is not used and Firestore rules reject anonymous sessions.
- Submitting member ID, name, specialty, and an optional avatar saves the profile under `qdcom.local_members.v1` and `qdcom.user_profile.v1` in `localStorage`, then opens the workspace immediately without requiring Google OAuth.
- Returning local members can enter their ID in login mode. Signing out removes only the active profile; locally registered profiles stay on the device for later ID sign-in.
- Local ID entry is device-local convenience, not secure authentication: there is no server-side verification, password, or cross-device identity. Do not treat the browser-stored profile as authorization for protected data.
- Avatar images must be image files no larger than 700 KB and are stored as data URLs with the local profile.
- Google sign-in uses Firebase `signInWithPopup`, requires a Google provider account, saves a minimal public directory record (`memberId`, `fullName`) to Firestore, and opens the inventory workspace. The Firebase UID is the community identity; the OAuth access token is held in memory for Drive backup.
- Once Google is connected, changes to products, bot vocabulary, or the Q-dcom member list are debounced, compressed with Gzip, and synchronized to `Q-Dcom_Backup.json.gz` in the account's private Drive `appDataFolder`. Settings displays Drive quota. Sign-out waits for a final backup and stays signed in if that backup fails.
- Products, inventory, and bot vocabulary remain in IndexedDB. Firestore stores public identity fields, group/chat room metadata, join requests, and chat text only. An `@q` query is shared as a chat message; each participant builds any product result card from their own local IndexedDB.
- A device-local ID profile cannot access Firebase community data. Logging out or leaving the app prompts local-ID users to export a backup first.
- OAuth access tokens remain in memory and are not stored in browser storage. After a page reload or token expiration, reconnect Google Drive from Settings before expecting more automatic backups or signing out.

## Google OAuth configuration

- Set the `NEXT_PUBLIC_FIREBASE_*` values in `.env.local` and the deployment environment from the Firebase Web App configuration. `.env.example` lists the required variable names.
- `NEXT_PUBLIC_` values are embedded in client bundles at build time. Restart the development server after changing the local value and rebuild/redeploy after changing a production value.
- Enable only the Google provider in Firebase Console > Authentication > Sign-in method, and add the app's domains (including localhost and deployed Vercel domains) to Authorized domains. Do not enable Anonymous as an application sign-in path.
- Enable the Google Drive API and allow the Firebase Google provider to request `https://www.googleapis.com/auth/drive.appdata` and `https://www.googleapis.com/auth/drive.metadata.readonly`. Google's consent-screen verification requirements may apply before enabling these scopes for users outside the test-user list.
- While the consent screen is in Testing mode, add every account that needs to sign in to the Test users list. Otherwise Google may reject the OAuth request with `access_denied`.
- Firebase web configuration values are public client configuration, not secrets. Never put OAuth client secrets or access tokens in `NEXT_PUBLIC_` variables or commit them.

## Relevant implementation files

- `lib/firebase.ts`: Firebase app/Auth/Firestore configuration and Google popup with the Drive scope.
- `lib/services/gatekeeperService.ts`: public user directory, group approvals, chat rooms, and text-message operations.
- `components/community-chat.tsx`: Telegram-style community interface and local-only @q result cards.
- `components/qdcom-app.tsx`: local registration/ID sign-in, Google credential handling, Drive backup/quota, and device-local profile persistence.
- `app/globals.css`: translucent glass registration/login styling and responsive breakpoints.
- `.env.example`: Firebase client configuration variable names.

## Deployment notes

- Deploy `firestore.rules` with `firebase deploy --only firestore:rules`; `firebase.json` maps the Firestore deployment to this rules file.
- Validate sign-in and group/chat rules in the Firebase Emulator before production rollout.
- LocalStorage ID profiles are device-local convenience only. Firebase rules, not browser profile data, authorize community operations.
- Add browser-level tests for registration, Google OAuth, group approvals, chat membership, and Drive sync when the project has an end-to-end test setup.
