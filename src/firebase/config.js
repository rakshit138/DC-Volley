// TODO: Add your Firebase credentials here
// 1. Go to Firebase Console (https://console.firebase.google.com)
// 2. Create a new project or select existing one
// 3. Go to Project Settings > General > Your apps
// 4. Click on the web icon (</>) to add a web app
// 5. Copy the config object and replace the values below
// 6. Create a .env file in the root directory with:
//    VITE_FIREBASE_API_KEY=your_api_key
//    VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
//    VITE_FIREBASE_PROJECT_ID=your_project_id
//    VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
//    VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
//    VITE_FIREBASE_APP_ID=your_app_id

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
// TODO: Enable Firestore in Firebase Console
// 1. Go to Firebase Console > Build > Firestore Database
// 2. Click "Create database"
// 3. Start in test mode (we'll update security rules later)
// 4. Choose a location for your database
export const db = getFirestore(app);

// Initialize Auth (optional - for anonymous auth if needed)
// TODO: Enable Authentication in Firebase Console
// 1. Go to Firebase Console > Build > Authentication
// 2. Click "Get started"
// 3. Enable "Anonymous" sign-in method if you want to use it
export const auth = getAuth(app);

export default app;
