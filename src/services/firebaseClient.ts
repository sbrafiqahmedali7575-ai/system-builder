import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp({
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  appId: firebaseConfig.appId,
  messagingSenderId: firebaseConfig.messagingSenderId,
});

export const firebaseAuth = getAuth(app);
export const firestoreDb = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId
);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export interface FirebaseOwnerStatus {
  signedIn: boolean;
  authorized: boolean;
  email?: string | null;
  user?: User | null;
}

function isPermissionDenied(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  return code === 'permission-denied' || code === 'firestore/permission-denied';
}

export async function waitForFirebaseAuthReady(): Promise<void> {
  if (typeof firebaseAuth.authStateReady === 'function') {
    await firebaseAuth.authStateReady();
    return;
  }

  await new Promise<void>((resolve) => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, () => {
      unsubscribe();
      resolve();
    });
  });
}

export async function getFirebaseOwnerStatus(): Promise<FirebaseOwnerStatus> {
  await waitForFirebaseAuthReady();

  const user = firebaseAuth.currentUser;
  if (!user) {
    return {
      signedIn: false,
      authorized: false,
      user: null,
      email: null,
    };
  }

  try {
    // The Security Rules only allow this read when the signed-in Google
    // account matches the existing owner email in the settings document.
    const settings = await getDoc(
      doc(firestoreDb, 'notification_settings', 'daily-settings')
    );

    return {
      signedIn: true,
      authorized: settings.exists(),
      user,
      email: user.email,
    };
  } catch (error) {
    if (isPermissionDenied(error)) {
      return {
        signedIn: true,
        authorized: false,
        user,
        email: user.email,
      };
    }
    throw error;
  }
}

export async function signInFirebaseOwner(): Promise<void> {
  try {
    await signInWithPopup(firebaseAuth, googleProvider);
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';

    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      await signInWithRedirect(firebaseAuth, googleProvider);
      return;
    }

    throw error;
  }
}

export async function signOutFirebaseOwner(): Promise<void> {
  await signOut(firebaseAuth);
}

export function onFirebaseOwnerAuthChanged(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(firebaseAuth, callback);
}
