import { GoogleAuth } from 'google-auth-library';
import firebaseConfig from '../firebase-applet-config.json';

type PlainObject = Record<string, any>;

type RestDocument = {
  name: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
};

type FirestoreValue =
  | { nullValue: 'NULL_VALUE' }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

export interface RestDocumentReference {
  path: string;
  id: string;
  name: string;
}

export interface RestCollectionReference {
  path: string;
}

export interface SetOptions {
  merge?: boolean;
}

class RestDocumentSnapshot {
  readonly id: string;
  readonly ref: RestDocumentReference;

  constructor(
    ref: RestDocumentReference,
    private readonly document: RestDocument | null
  ) {
    this.ref = ref;
    this.id = ref.id;
  }

  exists(): boolean {
    return Boolean(this.document);
  }

  data(): PlainObject {
    return this.document ? decodeFields(this.document.fields || {}) : {};
  }
}

class RestQuerySnapshot {
  readonly docs: RestDocumentSnapshot[];
  readonly empty: boolean;
  readonly size: number;

  constructor(documents: RestDocumentSnapshot[]) {
    this.docs = documents;
    this.empty = documents.length === 0;
    this.size = documents.length;
  }

  forEach(
    callback: (snapshot: RestDocumentSnapshot) => void
  ): void {
    this.docs.forEach(callback);
  }
}

const projectId = String(firebaseConfig.projectId || '').trim();
const databaseId = String(
  firebaseConfig.firestoreDatabaseId || '(default)'
).trim();

if (!projectId) {
  throw new Error('Firebase projectId is missing from firebase-applet-config.json.');
}

const encodedProjectId = encodeURIComponent(projectId);
const encodedDatabaseId = encodeURIComponent(databaseId);
const databaseRoot =
  `https://firestore.googleapis.com/v1/projects/${encodedProjectId}/databases/${encodedDatabaseId}`;
const documentsRoot = `${databaseRoot}/documents`;

function loadExplicitCredentials(): PlainObject | undefined {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return undefined;

  try {
    return JSON.parse(raw) as PlainObject;
  } catch {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Refusing to initialize privileged Firestore access.'
    );
  }
}

const googleAuth = new GoogleAuth({
  ...(loadExplicitCredentials()
    ? { credentials: loadExplicitCredentials() }
    : {}),
  scopes: [
    'https://www.googleapis.com/auth/datastore',
    'https://www.googleapis.com/auth/cloud-platform',
  ],
});

async function getAccessToken(): Promise<string> {
  const token = await googleAuth.getAccessToken();
  if (!token) {
    throw new Error(
      'Unable to obtain Google Application Default Credentials for Firestore.'
    );
  }
  return token;
}

async function firestoreRequest<T>(
  url: string,
  init: RequestInit = {},
  allowNotFound = false
): Promise<T | null> {
  const token = await getAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  if (allowNotFound && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = (await response.text()).slice(0, 1200);
    throw new Error(
      `Privileged Firestore request failed (${response.status} ${response.statusText}): ${body}`
    );
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : null;
}

function encodePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function documentName(path: string): string {
  return `projects/${projectId}/databases/${databaseId}/documents/${path}`;
}

function encodeValue(value: any): FirestoreValue {
  if (value === null || value === undefined) {
    return { nullValue: 'NULL_VALUE' };
  }

  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }

  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    }
    return { doubleValue: value };
  }

  if (typeof value === 'string') {
    return { stringValue: value };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => encodeValue(item)),
      },
    };
  }

  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: encodeFields(value),
      },
    };
  }

  return { stringValue: String(value) };
}

function encodeFields(value: PlainObject): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};

  for (const [key, item] of Object.entries(value || {})) {
    if (item === undefined) continue;
    fields[key] = encodeValue(item);
  }

  return fields;
}

function decodeValue(value: FirestoreValue | undefined): any {
  if (!value) return undefined;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('stringValue' in value) return value.stringValue;
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map((item) => decodeValue(item));
  }
  if ('mapValue' in value) {
    return decodeFields(value.mapValue.fields || {});
  }
  return undefined;
}

function decodeFields(
  fields: Record<string, FirestoreValue>
): PlainObject {
  const result: PlainObject = {};
  for (const [key, value] of Object.entries(fields || {})) {
    result[key] = decodeValue(value);
  }
  return result;
}

function makeDocumentReference(
  collectionPath: string,
  documentId: string
): RestDocumentReference {
  const path = [collectionPath, documentId].filter(Boolean).join('/');
  return {
    path,
    id: documentId,
    name: documentName(path),
  };
}

function writeForSet(
  ref: RestDocumentReference,
  data: PlainObject,
  options?: SetOptions,
  requireExisting = false
): PlainObject {
  const fields = encodeFields(data);
  const write: PlainObject = {
    update: {
      name: ref.name,
      fields,
    },
  };

  if (options?.merge) {
    write.updateMask = {
      fieldPaths: Object.keys(fields),
    };
  }

  if (requireExisting) {
    write.currentDocument = { exists: true };
  }

  return write;
}

async function commitWrites(
  writes: PlainObject[],
  transaction?: string
): Promise<void> {
  if (writes.length === 0) return;

  await firestoreRequest(
    `${documentsRoot}:commit`,
    {
      method: 'POST',
      body: JSON.stringify({
        writes,
        ...(transaction ? { transaction } : {}),
      }),
    }
  );
}

export const db = {
  projectId,
  databaseId,
};

export function collection(
  _db: typeof db,
  path: string
): RestCollectionReference {
  return { path };
}

export function doc(
  _db: typeof db,
  collectionPath: string,
  documentId: string
): RestDocumentReference {
  return makeDocumentReference(collectionPath, documentId);
}

export async function getDoc(
  ref: RestDocumentReference
): Promise<RestDocumentSnapshot> {
  const document = await firestoreRequest<RestDocument>(
    `${documentsRoot}/${encodePath(ref.path)}`,
    { method: 'GET' },
    true
  );

  return new RestDocumentSnapshot(ref, document);
}

export async function getDocs(
  ref: RestCollectionReference
): Promise<RestQuerySnapshot> {
  const documents: RestDocumentSnapshot[] = [];
  let pageToken = '';

  do {
    const query = new URLSearchParams({
      pageSize: '1000',
      ...(pageToken ? { pageToken } : {}),
    });

    const response =
      (await firestoreRequest<{
        documents?: RestDocument[];
        nextPageToken?: string;
      }>(
        `${documentsRoot}/${encodePath(ref.path)}?${query.toString()}`,
        { method: 'GET' }
      )) || {};

    for (const document of response.documents || []) {
      const id = document.name.split('/').pop() || '';
      const docRef = makeDocumentReference(ref.path, id);
      documents.push(new RestDocumentSnapshot(docRef, document));
    }

    pageToken = response.nextPageToken || '';
  } while (pageToken);

  return new RestQuerySnapshot(documents);
}

export async function setDoc(
  ref: RestDocumentReference,
  data: PlainObject,
  options?: SetOptions
): Promise<void> {
  await commitWrites([writeForSet(ref, data, options)]);
}

export async function updateDoc(
  ref: RestDocumentReference,
  data: PlainObject
): Promise<void> {
  await commitWrites([
    writeForSet(ref, data, { merge: true }, true),
  ]);
}

export async function deleteDoc(
  ref: RestDocumentReference
): Promise<void> {
  await commitWrites([{ delete: ref.name }]);
}

export async function runTransaction<T>(
  _db: typeof db,
  callback: (transaction: {
    get: (ref: RestDocumentReference) => Promise<RestDocumentSnapshot>;
    set: (
      ref: RestDocumentReference,
      data: PlainObject,
      options?: SetOptions
    ) => void;
  }) => Promise<T>
): Promise<T> {
  const begin =
    (await firestoreRequest<{ transaction?: string }>(
      `${documentsRoot}:beginTransaction`,
      {
        method: 'POST',
        body: JSON.stringify({ options: { readWrite: {} } }),
      }
    )) || {};

  const transactionId = begin.transaction;
  if (!transactionId) {
    throw new Error('Firestore did not return a transaction identifier.');
  }

  const writes: PlainObject[] = [];
  const transaction = {
    get: async (ref: RestDocumentReference) => {
      const query = new URLSearchParams({ transaction: transactionId });
      const document = await firestoreRequest<RestDocument>(
        `${documentsRoot}/${encodePath(
          ref.path
        )}?${query.toString()}`,
        { method: 'GET' },
        true
      );
      return new RestDocumentSnapshot(ref, document);
    },
    set: (
      ref: RestDocumentReference,
      data: PlainObject,
      options?: SetOptions
    ) => {
      writes.push(writeForSet(ref, data, options));
    },
  };

  try {
    const result = await callback(transaction);
    await firestoreRequest(
      `${documentsRoot}:commit`,
      {
        method: 'POST',
        body: JSON.stringify({
          writes,
          transaction: transactionId,
        }),
      }
    );
    return result;
  } catch (error) {
    try {
      await firestoreRequest(
        `${documentsRoot}:rollback`,
        {
          method: 'POST',
          body: JSON.stringify({ transaction: transactionId }),
        }
      );
    } catch {
      // Preserve the original transaction error.
    }
    throw error;
  }
}

export async function verifyPrivilegedFirestoreAccess(): Promise<void> {
  await getAccessToken();
}
