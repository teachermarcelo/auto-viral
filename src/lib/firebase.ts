import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Firebase Web configuration for AutoViral Data Core.
 *
 * These values identify the Firebase project; they are not Admin credentials.
 * Access control is enforced by Firebase Authentication and firestore.rules.
 * Never put a service-account JSON or Admin SDK private key in this file.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyAxEgQ-YJX2uTXlitq673kHd1T6lrRxS1Q',
  authDomain: 'autoviral-data-core.firebaseapp.com',
  projectId: 'autoviral-data-core',
  storageBucket: 'autoviral-data-core.firebasestorage.app',
  messagingSenderId: '1041668180974',
  appId: '1:1041668180974:web:875559e301292c9705dcff',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);
