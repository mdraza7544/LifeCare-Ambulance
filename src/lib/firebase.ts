// Firebase client bootstrap — replaces the previous Supabase client.
// Config comes from Vite env vars (VITE_FIREBASE_*). The web API key is a
// public identifier and is safe to expose in the browser bundle; sensitive
// credentials (Twilio, EmailJS private key) live only in Cloud Functions.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(firebaseApp);
export const db: Firestore = getFirestore(firebaseApp);
/** Cloud Functions client — region matches `setGlobalOptions` in functions/src. */
export const functions: Functions = getFunctions(firebaseApp, 'us-central1');

/** Access to the shared Firebase app (e.g. for Cloud Functions entry point). */
export function getFirebaseApp(): FirebaseApp {
  return firebaseApp;
}