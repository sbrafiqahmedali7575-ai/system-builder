import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import {
  Firestore,
  doc,
  getDoc,
  getFirestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

interface FirebaseRuntime {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  googleProvider: GoogleAuthProvider;
}

let runtime: FirebaseRuntime | null = null;

function requiredConfigValue(
  key:
    | 'apiKey'
    | 'authDomain'
    | 'projectId'
    | 'appId'
    | 'messagingSenderId'
    | 'firestoreDatabaseId'
): string {
  const value = String(firebaseConfig[key] || '').trim();
  if (!value) {
    throw new Error(
      `Firebase configuration is missing ${key}. Refresh the AI Studio project from the latest repository revision.`
    );
  }
  return value;
}

export function getFirebaseRuntime(): FirebaseRuntime {
  if (runtime) return runtime;

  const app =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          apiKey: requiredConfigValue('apiKey'),
          authDomain: requiredConfigValue('authDomain'),
          projectId: requiredConfigValue('projectId'),
          appId: requiredConfigValue('appId'),
          messagingSenderId: requiredConfigValue('messagingSenderId'),
        });

  const auth = getAuth(app);
  const firestore = getFirestore(
    app,
    requiredConfigValue('firestoreDatabaseId')
  );
  const googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });

  runtime = {
    app,
    auth,
    firestore,
    googleProvider,
  };

  return runtime;
}

export function getFirestoreDb(): Firestore {
  return getFirebaseRuntime().firestore;
}

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
  const { auth } = getFirebaseRuntime();

  if (typeof auth.authStateReady === 'function') {
    await Promise.race([
      auth.authStateReady(),
      new Promise<void>((_, reject) =>
        window.setTimeout(
          () =>
            reject(
              new Error(
                'Firebase Authentication did not initialize in this preview.'
              )
            ),
          8000
        )
      ),
    ]);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      reject(
        new Error(
          'Firebase Authentication did not initialize in this preview.'
        )
      );
    }, 8000);

    const unsubscribe = onAuthStateChanged(
      auth,
      () => {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve();
      },
      (error) => {
        window.clearTimeout(timeout);
        unsubscribe();
        reject(error);
      }
    );
  });
}

export async function getFirebaseOwnerStatus(): Promise<FirebaseOwnerStatus> {
  await waitForFirebaseAuthReady();

  const { auth, firestore } = getFirebaseRuntime();
  const user = auth.currentUser;

  if (!user) {
    return {
      signedIn: false,
      authorized: false,
      user: null,
      email: null,
    };
  }

  try {
    const settings = await getDoc(
      doc(firestore, 'notification_settings', 'daily-settings')
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
  const { auth, googleProvider } = getFirebaseRuntime();

  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';

    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      await signInWithRedirect(auth, googleProvider);
      return;
    }

    throw error;
  }
}

export async function signOutFirebaseOwner(): Promise<void> {
  const { auth } = getFirebaseRuntime();
  await signOut(auth);
}

export function onFirebaseOwnerAuthChanged(
  callback: (user: User | null) => void
): () => void {
  try {
    const { auth } = getFirebaseRuntime();
    return onAuthStateChanged(auth, callback);
  } catch (error) {
    console.error('Firebase owner auth listener unavailable:', error);
    return () => {};
  }
}
