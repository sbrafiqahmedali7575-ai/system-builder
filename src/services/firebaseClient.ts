import firebaseConfig from '../../firebase-applet-config.json';

type FirebaseRuntime = {
  app: any;
  auth: any;
  firestore: any;
  googleProvider: any;
  authSdk: any;
  firestoreSdk: any;
};

let runtimePromise: Promise<FirebaseRuntime> | null = null;

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

export async function getFirebaseRuntime(): Promise<FirebaseRuntime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const [appSdk, authSdk, firestoreSdk] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);

      const app =
        appSdk.getApps().length > 0
          ? appSdk.getApp()
          : appSdk.initializeApp({
              apiKey: requiredConfigValue('apiKey'),
              authDomain: requiredConfigValue('authDomain'),
              projectId: requiredConfigValue('projectId'),
              appId: requiredConfigValue('appId'),
              messagingSenderId: requiredConfigValue('messagingSenderId'),
            });

      const auth = authSdk.getAuth(app);
      const firestore = firestoreSdk.getFirestore(
        app,
        requiredConfigValue('firestoreDatabaseId')
      );
      const googleProvider = new authSdk.GoogleAuthProvider();
      googleProvider.setCustomParameters({ prompt: 'select_account' });

      return {
        app,
        auth,
        firestore,
        googleProvider,
        authSdk,
        firestoreSdk,
      };
    })().catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }

  return runtimePromise;
}

export interface FirebaseOwnerStatus {
  signedIn: boolean;
  authorized: boolean;
  email?: string | null;
  user?: any;
}

function isPermissionDenied(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  return code === 'permission-denied' || code === 'firestore/permission-denied';
}

export async function waitForFirebaseAuthReady(): Promise<void> {
  const { auth, authSdk } = await getFirebaseRuntime();

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
    let unsubscribe = () => {};
    const timeout = window.setTimeout(() => {
      unsubscribe();
      reject(
        new Error(
          'Firebase Authentication did not initialize in this preview.'
        )
      );
    }, 8000);

    unsubscribe = authSdk.onAuthStateChanged(
      auth,
      () => {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve();
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        unsubscribe();
        reject(error);
      }
    );
  });
}

export async function getFirebaseOwnerStatus(): Promise<FirebaseOwnerStatus> {
  await waitForFirebaseAuthReady();

  const { auth, firestore, firestoreSdk } = await getFirebaseRuntime();
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
    const settings = await firestoreSdk.getDoc(
      firestoreSdk.doc(
        firestore,
        'notification_settings',
        'daily-settings'
      )
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
  const { auth, googleProvider, authSdk } = await getFirebaseRuntime();

  try {
    await authSdk.signInWithPopup(auth, googleProvider);
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';

    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      await authSdk.signInWithRedirect(auth, googleProvider);
      return;
    }

    throw error;
  }
}

export async function signOutFirebaseOwner(): Promise<void> {
  const { auth, authSdk } = await getFirebaseRuntime();
  await authSdk.signOut(auth);
}

export function onFirebaseOwnerAuthChanged(
  callback: (user: any | null) => void
): () => void {
  let active = true;
  let unsubscribe = () => {};

  void getFirebaseRuntime()
    .then(({ auth, authSdk }) => {
      if (!active) return;
      unsubscribe = authSdk.onAuthStateChanged(auth, callback);
    })
    .catch((error) => {
      console.error('Firebase owner auth listener unavailable:', error);
    });

  return () => {
    active = false;
    unsubscribe();
  };
}
