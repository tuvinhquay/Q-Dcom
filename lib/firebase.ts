import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId,
);

let auth: Auth | undefined;
let firestore: Firestore | undefined;

function getFirebaseApp() {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase chưa được cấu hình đầy đủ. Hãy kiểm tra các biến NEXT_PUBLIC_FIREBASE_*.");
  }
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  auth ??= getAuth(getFirebaseApp());
  return auth;
}

export function getFirebaseFirestore(): Firestore {
  firestore ??= getFirestore(getFirebaseApp());
  return firestore;
}

// Google identity authentication deliberately requests no Google Drive scopes.
const googleSignInProvider = new GoogleAuthProvider();
googleSignInProvider.setCustomParameters({ prompt: "select_account" });

const googleDriveProvider = new GoogleAuthProvider();
googleDriveProvider.addScope("https://www.googleapis.com/auth/drive.appdata");
googleDriveProvider.addScope("https://www.googleapis.com/auth/drive.metadata.readonly");
googleDriveProvider.setCustomParameters({ prompt: "consent select_account" });

export interface GoogleAuthSession {
  user: User;
}

export interface GoogleDriveSession {
  user: User;
  accessToken: string;
}

function isGoogleUser(user: User): boolean {
  return !user.isAnonymous && user.providerData.some(
    ({ providerId }) => providerId === GoogleAuthProvider.PROVIDER_ID,
  );
}

/** Authenticate identity only. Drive access is requested separately by the user. */
export async function signInWithGooglePopup(): Promise<GoogleAuthSession> {
  const result = await signInWithPopup(getFirebaseAuth(), googleSignInProvider);
  if (!isGoogleUser(result.user)) {
    await signOut(getFirebaseAuth());
    throw new Error("Q-Dcom chỉ cho phép đăng nhập bằng tài khoản Google.");
  }
  return { user: result.user };
}

/** Request optional Drive permission for the already authenticated Google identity. */
export async function requestGoogleDriveAccess(): Promise<GoogleDriveSession> {
  const authInstance = getFirebaseAuth();
  const currentUser = authInstance.currentUser;
  if (!currentUser || !isGoogleUser(currentUser)) {
    throw new Error("Hãy đăng nhập Google trước khi kết nối Google Drive.");
  }

  const result = await reauthenticateWithPopup(currentUser, googleDriveProvider);
  if (result.user.uid !== currentUser.uid || !isGoogleUser(result.user)) {
    throw new Error("Tài khoản Google xác thực Drive không khớp với tài khoản Q-Dcom hiện tại.");
  }

  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error("Google chưa cấp quyền Drive. Bạn có thể tiếp tục dùng Q-Dcom mà không cần Drive.");
  }
  return { user: result.user, accessToken: credential.accessToken };
}

export async function signOutFirebaseUser(): Promise<void> {
  if (!isFirebaseConfigured || !getApps().length) return;
  await signOut(getFirebaseAuth());
}
