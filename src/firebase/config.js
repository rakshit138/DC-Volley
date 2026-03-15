import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
  throw new Error(
    'Firebase API key is missing or invalid (auth/invalid-api-key).\n\n' +
    '1. Copy .env.example to .env in the project root.\n' +
    '2. Open Firebase Console → Project Settings → Your apps → Web app.\n' +
    '3. Copy the config values into .env (VITE_FIREBASE_API_KEY, etc.).\n' +
    '4. Restart the dev server (npm run dev).'
  );
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

// Analytics only in browser and when measurementId is set
export const analytics = typeof window !== 'undefined' && import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
  ? getAnalytics(app)
  : null;

export default app;
