import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';

function getAdminCredential() {
  const rawServiceAccount = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();

  if (rawServiceAccount) {
    const parsed = JSON.parse(rawServiceAccount);
    return cert({
      projectId: parsed.project_id || parsed.projectId,
      clientEmail: parsed.client_email || parsed.clientEmail,
      privateKey: String(parsed.private_key || parsed.privateKey || '').replace(/\\n/g, '\n'),
    });
  }

  return applicationDefault();
}

const adminApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: getAdminCredential(),
        projectId: firebaseConfig.projectId,
      });

export const db =
  firebaseConfig.firestoreDatabaseId &&
  firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(adminApp, firebaseConfig.firestoreDatabaseId)
    : getFirestore(adminApp);

function wrapDocumentSnapshot(snapshot: any) {
  return {
    id: snapshot.id,
    ref: snapshot.ref,
    exists: () => Boolean(snapshot.exists),
    data: () => snapshot.data(),
  };
}

export function collection(_database: any, ...segments: string[]) {
  return db.collection(segments.join('/'));
}

export function doc(_database: any, ...segments: string[]) {
  return db.doc(segments.join('/'));
}

export async function getDoc(ref: any) {
  return wrapDocumentSnapshot(await ref.get());
}

export async function getDocs(ref: any) {
  return await ref.get();
}

export async function setDoc(ref: any, data: any, options?: any) {
  if (options) {
    await ref.set(data, options);
  } else {
    await ref.set(data);
  }
}

export async function updateDoc(ref: any, data: any) {
  await ref.update(data);
}

export async function deleteDoc(ref: any) {
  await ref.delete();
}

export async function runTransaction<T>(
  _database: any,
  callback: (transaction: any) => Promise<T>
): Promise<T> {
  return db.runTransaction(async (adminTransaction: any) => {
    const wrappedTransaction: any = {
      get: async (ref: any) => wrapDocumentSnapshot(await adminTransaction.get(ref)),
      set: (ref: any, data: any, options?: any) => {
        if (options) {
          adminTransaction.set(ref, data, options);
        } else {
          adminTransaction.set(ref, data);
        }
        return wrappedTransaction;
      },
      update: (ref: any, data: any) => {
        adminTransaction.update(ref, data);
        return wrappedTransaction;
      },
      delete: (ref: any) => {
        adminTransaction.delete(ref);
        return wrappedTransaction;
      },
    };

    return callback(wrappedTransaction);
  });
}
