import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
} from 'firebase/firestore';
import { DailyRecord, HabitItem, TaskItem } from '../types';
import { INITIAL_RECORDS } from '../data/initialData';
import { standardizeDate } from '../utils/dateUtils';
import { getFirestoreDb } from './firebaseClient';

export type Unsubscribe = () => void;

export interface CountdownSettings {
  targetDate: string;
  reason: string;
  updatedAt?: string;
}

export class ApiRequestError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

function notifyFirebaseAuthRequired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('system-builder-firebase-auth-required')
    );
  }
}

function firebaseErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code || '');
  }
  return '';
}

function normalizeFirebaseError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) return error;

  const code = firebaseErrorCode(error);
  const message =
    error instanceof Error ? error.message : String(error || 'Firebase request failed.');

  if (
    code.includes('permission-denied') ||
    code.includes('unauthenticated')
  ) {
    notifyFirebaseAuthRequired();
    return new ApiRequestError(
      'Firebase owner authentication is required for this data.',
      403
    );
  }

  if (code.includes('resource-exhausted')) {
    return new ApiRequestError(message, 429);
  }

  if (
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    code.includes('internal') ||
    code.includes('network')
  ) {
    return new ApiRequestError(message, 503);
  }

  if (
    code.includes('already-exists') ||
    code.includes('failed-precondition') ||
    code.includes('aborted')
  ) {
    return new ApiRequestError(message, 409);
  }

  return new ApiRequestError(message);
}

function cleanForFirestore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function serverTimestampIso(): string {
  return new Date().toISOString();
}

async function writeWithConflictCheck(
  collectionName: string,
  id: string,
  value: Record<string, unknown>,
  clientMutationAt?: number
): Promise<void> {
  const ref = doc(getFirestoreDb(), collectionName, id);
  const payload = cleanForFirestore({
    ...value,
    updatedAt: serverTimestampIso(),
  });

  try {
    if (!Number.isFinite(clientMutationAt) || Number(clientMutationAt) <= 0) {
      await setDoc(ref, payload, { merge: true });
      return;
    }

    await runTransaction(getFirestoreDb(), async (transaction) => {
      const snapshot = await transaction.get(ref);

      if (snapshot.exists()) {
        const serverUpdatedAt = Date.parse(
          String(snapshot.data().updatedAt || '')
        );

        if (
          Number.isFinite(serverUpdatedAt) &&
          serverUpdatedAt > Number(clientMutationAt)
        ) {
          throw new ApiRequestError(
            'A newer cloud change exists. The stale offline mutation was not applied.',
            409
          );
        }
      }

      transaction.set(ref, payload, { merge: true });
    });
  } catch (error) {
    throw normalizeFirebaseError(error);
  }
}

async function deleteWithConflictCheck(
  collectionName: string,
  id: string,
  clientMutationAt?: number
): Promise<void> {
  const ref = doc(getFirestoreDb(), collectionName, id);

  try {
    if (!Number.isFinite(clientMutationAt) || Number(clientMutationAt) <= 0) {
      await deleteDoc(ref);
      return;
    }

    await runTransaction(getFirestoreDb(), async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) return;

      const serverUpdatedAt = Date.parse(
        String(snapshot.data().updatedAt || '')
      );

      if (
        Number.isFinite(serverUpdatedAt) &&
        serverUpdatedAt > Number(clientMutationAt)
      ) {
        throw new ApiRequestError(
          'A newer cloud change exists. The stale offline delete was not applied.',
          409
        );
      }

      transaction.delete(ref);
    });
  } catch (error) {
    throw normalizeFirebaseError(error);
  }
}

function normalizeRecords(records: DailyRecord[]): DailyRecord[] {
  const fetched = records.map((record) => {
    const rawDate = String(record.date || '');
    return {
      ...record,
      date: standardizeDate(rawDate) || rawDate,
      result: record.isCompleted ? 'TRUE' : 'FALSE',
      day: Number(record.day || 0),
      change: Number(record.change || 0),
    } as DailyRecord;
  });

  fetched.sort((a, b) => a.day - b.day);

  const seenDays = new Set<number>();
  return fetched.map((record) => {
    let safeDay = record.day;
    if (safeDay <= 0 || seenDays.has(safeDay)) {
      safeDay = 1;
      while (seenDays.has(safeDay)) safeDay += 1;
    }
    seenDays.add(safeDay);
    return safeDay === record.day ? record : { ...record, day: safeDay };
  });
}

async function loadRecords(): Promise<DailyRecord[]> {
  try {
    const snapshot = await getDocs(collection(getFirestoreDb(), 'records'));
    return normalizeRecords(
      snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as DailyRecord[]
    );
  } catch (error) {
    throw normalizeFirebaseError(error);
  }
}

export function subscribeToRecords(
  onUpdate: (records: DailyRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  let seeded = false;

  return onSnapshot(
    collection(getFirestoreDb(), 'records'),
    (snapshot) => {
      const records = normalizeRecords(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as DailyRecord[]
      );

      if (records.length === 0 && !seeded) {
        seeded = true;
        void seedInitialData(INITIAL_RECORDS).catch((error) => {
          onError?.(normalizeFirebaseError(error));
        });
        return;
      }

      onUpdate(records);
    },
    (error) => onError?.(normalizeFirebaseError(error))
  );
}

export async function seedInitialData(
  records: DailyRecord[]
): Promise<void> {
  for (const record of records) {
    await updateRecordInCloud(record);
  }
}

export async function addRecordToCloud(
  record: DailyRecord,
  clientMutationAt?: number
): Promise<void> {
  await writeWithConflictCheck(
    'records',
    record.id,
    record as unknown as Record<string, unknown>,
    clientMutationAt
  );
}

export async function updateRecordInCloud(
  record: DailyRecord,
  clientMutationAt?: number
): Promise<void> {
  await addRecordToCloud(record, clientMutationAt);
}

export async function deleteRecordFromCloud(
  recordId: string,
  clientMutationAt?: number
): Promise<void> {
  await deleteWithConflictCheck('records', recordId, clientMutationAt);
}

export async function bulkAddRecordsToCloud(
  records: DailyRecord[]
): Promise<void> {
  for (const record of records) {
    await updateRecordInCloud(record);
  }
}

export async function resetRecordsInCloud(
  initialRecords: DailyRecord[]
): Promise<void> {
  const existing = await loadRecords();
  for (const record of existing) {
    await deleteRecordFromCloud(record.id);
  }
  await seedInitialData(initialRecords);
}

function normalizeTasks(tasks: TaskItem[]): TaskItem[] {
  const normalized = tasks.map((task) => ({
    ...task,
    priority: task.priority || 'Normal',
    timeEstimate: task.timeEstimate || '',
    category: task.category || '',
    notes: task.notes || '',
    completedAt: task.completedAt || undefined,
    matrixQuadrant: task.matrixQuadrant || undefined,
  }));

  normalized.sort((a, b) =>
    String(b.taskKey || '').localeCompare(String(a.taskKey || ''))
  );

  return normalized;
}

async function loadTasks(): Promise<TaskItem[]> {
  try {
    const snapshot = await getDocs(collection(getFirestoreDb(), 'tasks'));
    return normalizeTasks(
      snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as TaskItem[]
    );
  } catch (error) {
    throw normalizeFirebaseError(error);
  }
}

export function subscribeToTasks(
  onUpdate: (tasks: TaskItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(getFirestoreDb(), 'tasks'),
    (snapshot) => {
      onUpdate(
        normalizeTasks(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as TaskItem[]
        )
      );
    },
    (error) => onError?.(normalizeFirebaseError(error))
  );
}

export async function seedInitialTasks(
  tasks: TaskItem[]
): Promise<void> {
  for (const task of tasks) {
    await updateTaskInCloud(task);
  }
}

export async function addTaskToCloud(
  task: TaskItem,
  clientMutationAt?: number
): Promise<void> {
  await writeWithConflictCheck(
    'tasks',
    task.id,
    task as unknown as Record<string, unknown>,
    clientMutationAt
  );
}

export async function updateTaskInCloud(
  task: TaskItem,
  clientMutationAt?: number
): Promise<void> {
  await addTaskToCloud(task, clientMutationAt);
}

export async function deleteTaskFromCloud(
  taskId: string,
  clientMutationAt?: number
): Promise<void> {
  await deleteWithConflictCheck('tasks', taskId, clientMutationAt);
}

export async function resetTasksInCloud(
  initialTasks: TaskItem[]
): Promise<void> {
  const existing = await loadTasks();
  for (const task of existing) {
    await deleteTaskFromCloud(task.id);
  }
  await seedInitialTasks(initialTasks);
}

function normalizeHabits(habits: HabitItem[]): HabitItem[] {
  const normalized = habits.map((habit) => ({
    ...habit,
    emoji: habit.emoji || '✓',
    frequency: (
      habit.frequency === 'custom'
        ? 'custom'
        : habit.frequency === 'weekdays'
        ? 'weekdays'
        : 'daily'
    ) as HabitItem['frequency'],
    repeatDays: Array.isArray(habit.repeatDays) ? habit.repeatDays : [],
    skippedDates: Array.isArray(habit.skippedDates)
      ? habit.skippedDates
      : [],
    extraDates: Array.isArray(habit.extraDates) ? habit.extraDates : [],
    checkIns: Array.isArray(habit.checkIns) ? habit.checkIns : [],
  }));

  normalized.sort((a, b) =>
    String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
  );

  return normalized;
}

export function subscribeToHabits(
  onUpdate: (habits: HabitItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(getFirestoreDb(), 'habits'),
    (snapshot) => {
      onUpdate(
        normalizeHabits(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as HabitItem[]
        )
      );
    },
    (error) => onError?.(normalizeFirebaseError(error))
  );
}

export async function addHabitToCloud(
  habit: HabitItem,
  clientMutationAt?: number
): Promise<void> {
  await writeWithConflictCheck(
    'habits',
    habit.id,
    habit as unknown as Record<string, unknown>,
    clientMutationAt
  );
}

export async function updateHabitInCloud(
  habit: HabitItem,
  clientMutationAt?: number
): Promise<void> {
  await addHabitToCloud(habit, clientMutationAt);
}

export async function deleteHabitFromCloud(
  habitId: string,
  clientMutationAt?: number
): Promise<void> {
  await deleteWithConflictCheck('habits', habitId, clientMutationAt);
}

export function subscribeToCountdownSettings(
  onUpdate: (settings: CountdownSettings | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = doc(
    getFirestoreDb(),
    'notification_settings',
    'system_builder_countdown'
  );

  return onSnapshot(
    ref,
    (snapshot) => {
      onUpdate(
        snapshot.exists()
          ? ({
              ...snapshot.data(),
            } as CountdownSettings)
          : null
      );
    },
    (error) => onError?.(normalizeFirebaseError(error))
  );
}

export async function saveCountdownSettings(
  settings: Pick<CountdownSettings, 'targetDate' | 'reason'>
): Promise<void> {
  try {
    await setDoc(
      doc(
        getFirestoreDb(),
        'notification_settings',
        'system_builder_countdown'
      ),
      {
        ...cleanForFirestore(settings),
        updatedAt: serverTimestampIso(),
      },
      { merge: true }
    );
  } catch (error) {
    throw normalizeFirebaseError(error);
  }
}

export async function syncAllDataInCloud(
  records: DailyRecord[],
  tasks: TaskItem[]
): Promise<void> {
  for (const record of records) {
    await updateRecordInCloud(record);
  }

  for (const task of tasks) {
    await updateTaskInCloud(task);
  }
}
