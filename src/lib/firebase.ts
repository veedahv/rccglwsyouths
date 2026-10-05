import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Populate these from your Firebase project settings > General > Your apps.
// Store the real values in .env.local (see .env.local.example) — never commit them.
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Avoid re-initializing during Next.js hot reload / multiple imports
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Explicit local persistence: the signed-in session survives a full
// browser close/reopen, not just client-side navigation. This is the
// Firebase Auth default anyway, but setting it explicitly avoids relying
// on that default silently — and it's what "fix the session not
// sticking" usually turns out to be missing, alongside the login-page
// redirect (see app/login/page.tsx).
if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    // If this fails (e.g. storage blocked), Firebase falls back to
    // in-memory persistence — the app still works, just re-prompts
    // sign-in on refresh. Not worth surfacing to the user as an error.
  });
}
