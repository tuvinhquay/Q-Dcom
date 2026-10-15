import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
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

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/drive.appdata");
googleProvider.addScope("https://www.googleapis.com/auth/drive.metadata.readonly");
googleProvider.setCustomParameters({ prompt: "select_account" });

export interface GoogleAuthSession {
  user: User;
  accessToken: string;
}

export async function signInWithGooglePopup(): Promise<GoogleAuthSession> {
  const result = await signInWithPopup(getFirebaseAuth(), googleProvider);
  const user = result.user;
  if (user.isAnonymous || !user.providerData.some(({ providerId }) => providerId === GoogleAuthProvider.PROVIDER_ID)) {
    await signOut(getFirebaseAuth());
    throw new Error("Q-Dcom chỉ cho phép đăng nhập bằng tài khoản Google.");
  }

  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    await signOut(getFirebaseAuth());
    throw new Error("Firebase không trả về Google OAuth access token cho Google Drive.");
  }
  return { user, accessToken: credential.accessToken };
}

export async function signOutFirebaseUser(): Promise<void> {
  if (!isFirebaseConfigured || !getApps().length) return;
  await signOut(getFirebaseAuth());
}
