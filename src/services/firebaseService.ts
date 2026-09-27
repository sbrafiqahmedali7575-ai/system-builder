import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDocFromServer,
  writeBatch,
  Unsubscribe,
  type QuerySnapshot,
  type DocumentData,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { DailyRecord, HabitItem, TaskItem } from '../types';
import { INITIAL_RECORDS, INITIAL_TASKS } from '../data/initialData';
import { standardizeDate } from '../utils/dateUtils';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Target specific Firestore Database ID if configured
export const db =
  firebaseConfig.firestoreDatabaseId &&
  firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

export const auth = getAuth(app);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const TASKS_COLLECTION = 'tasks';
const HABITS_COLLECTION = 'habits';
const HABIT_LOGS_COLLECTION = 'habitLogs';
const DAYS_COLLECTION = 'days';
const COUNTDOWNS_COLLECTION = 'countdowns';
const COUNTDOWN_SETTINGS_DOC = 'system_builder_countdown';

function matrixQuadrantToRoman(
  quadrant?: TaskItem['matrixQuadrant']
): 'I' | 'II' | 'III' | 'IV' | null {
  if (quadrant === 'urgent-important') return 'I';
  if (quadrant === 'important') return 'II';
  if (quadrant === 'urgent') return 'III';
  if (quadrant === 'neither') return 'IV';
  return null;
}

function storedQuadrantToMatrix(value: unknown): TaskItem['matrixQuadrant'] | undefined {
  const raw = String(value ?? '');
  if (raw === 'I' || raw === 'urgent-important') return 'urgent-important';
  if (raw === 'II' || raw === 'important') return 'important';
  if (raw === 'III' || raw === 'urgent') return 'urgent';
  if (raw === 'IV' || raw === 'neither') return 'neither';
  return undefined;
}

function taskStoragePayload(task: TaskItem): Record<string, unknown> {
  return {
    taskId: task.id,
    title: task.taskOfTheDay.trim(),
    quadrant: matrixQuadrantToRoman(task.matrixQuadrant),
    scheduledDate: normalizeModelDateKey(task.taskKey) || task.taskKey,
    taskOrder: Number.isInteger(task.taskOrder) && Number(task.taskOrder) > 0
      ? Number(task.taskOrder)
      : 1,
    notes: task.notes || '',
    Iscompleted: task.isCompleted,
  };
}

function habitRepeatDays(habit: HabitItem): number[] {
  if (habit.frequency === 'daily') return [0, 1, 2, 3, 4, 5, 6];
  if (habit.frequency === 'weekdays') return [1, 2, 3, 4, 5];
  return [...new Set(
    (habit.repeatDays || []).filter(
      (day) => Number.isInteger(day) && day >= 0 && day <= 6
    )
  )];
}

function habitActiveFrom(habit: HabitItem): string {
  if (habit.activeFrom) return habit.activeFrom;

  const date = new Date(habit.createdAt);
  if (Number.isNaN(date.getTime())) return '1970-01-01';

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function habitColorToHex(color: HabitItem['color']): string {
  const colors: Record<HabitItem['color'], string> = {
    blue: '#3B82F6',
    emerald: '#10B981',
    amber: '#F59E0B',
    rose: '#F43F5E',
    violet: '#8B5CF6',
  };
  return colors[color];
}

function storedHabitColor(value: unknown): HabitItem['color'] {
  const raw = String(value ?? '').toLowerCase();
  const map: Record<string, HabitItem['color']> = {
    blue: 'blue',
    '#3b82f6': 'blue',
    emerald: 'emerald',
    '#10b981': 'emerald',
    amber: 'amber',
    '#f59e0b': 'amber',
    rose: 'rose',
    '#f43f5e': 'rose',
    violet: 'violet',
    '#8b5cf6': 'violet',
  };
  return map[raw] || 'blue';
}

function storedHabitFrequency(data: Record<string, unknown>): HabitItem['frequency'] {
  if (data.frequency === 'daily' || data.frequency === 'weekdays' || data.frequency === 'custom') {
    return data.frequency;
  }

  const days = Array.isArray(data.repeatDays)
    ? [...new Set(
        data.repeatDays
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
      )].sort()
    : [];

  if (days.length === 7) return 'daily';
  if (days.join(',') === '1,2,3,4,5') return 'weekdays';
  return 'custom';
}

function habitStoragePayload(habit: HabitItem): Record<string, unknown> {
  return {
    habitId: habit.id,
    name: habit.name.trim(),
    repeatDays: habitRepeatDays(habit),
    activeFrom: habitActiveFrom(habit),
    isActive: habit.isActive !== false,
    color: habitColorToHex(habit.color),
  };
}

async function syncHabitLogsFromHabit(habit: HabitItem): Promise<void> {
  const snapshot = await getDocs(collection(db, HABIT_LOGS_COLLECTION));
  const checkedDates = new Set(habit.checkIns || []);
  const batch = writeBatch(db);

  snapshot.forEach((logDoc) => {
    const data = logDoc.data();
    if (String(data.habitId || '') !== habit.id) return;

    const dateKey = String(data.dateKey || '');
    if (dateKey && !checkedDates.has(dateKey)) {
      batch.set(
        logDoc.ref,
        {
          habitLogId: logDoc.id,
          habitId: habit.id,
          dateKey,
          Iscompleted: false,
        },
        { merge: true }
      );
    }
  });

  for (const dateKey of checkedDates) {
    const habitLogId = `HL-${habit.id}-${dateKey.replace(/-/g, '')}`;
    batch.set(
      doc(db, HABIT_LOGS_COLLECTION, habitLogId),
      {
        habitLogId,
        habitId: habit.id,
        dateKey,
        Iscompleted: true,
      },
      { merge: true }
    );
  }

  await batch.commit();
}

function normalizeModelDateKey(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }

  const standardized = standardizeDate(raw);
  const named = standardized.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (!named) return '';

  const monthMap: Record<string, string> = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12',
  };

  const month = monthMap[named[2]];
  return month ? `${named[3]}-${month}-${named[1]}` : '';
}

function storedHabitIsDue(data: Record<string, unknown>, dateKey: string): boolean {
  if (data.isActive === false) return false;

  const activeFrom = normalizeModelDateKey(data.activeFrom) || '1970-01-01';

  if (dateKey < activeFrom) return false;

  const repeatDays = Array.isArray(data.repeatDays)
    ? data.repeatDays
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    : [];

  const effectiveDays = repeatDays;

  const [year, month, day] = dateKey.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return effectiveDays.includes(weekday);
}

export async function rebuildDaySummary(dateKey: string): Promise<void> {
  if (!dateKey) return;

  const [tasksSnap, habitsSnap, logsSnap] = await Promise.all([
    getDocs(collection(db, TASKS_COLLECTION)),
    getDocs(collection(db, HABITS_COLLECTION)),
    getDocs(collection(db, HABIT_LOGS_COLLECTION)),
  ]);

  let taskTotal = 0;
  let tasksCompleted = 0;
  tasksSnap.forEach((taskDoc) => {
    const data = taskDoc.data();
    if (normalizeModelDateKey(data.scheduledDate) !== dateKey) return;
    taskTotal += 1;
    if (data.Iscompleted === true) tasksCompleted += 1;
  });

  const completedHabitIds = new Set<string>();
  logsSnap.forEach((logDoc) => {
    const data = logDoc.data();
    if (String(data.dateKey || '') === dateKey && data.Iscompleted === true && data.habitId) {
      completedHabitIds.add(String(data.habitId));
    }
  });

  let habitTotal = 0;
  let habitsCompleted = 0;
  habitsSnap.forEach((habitDoc) => {
    const data = habitDoc.data() as Record<string, unknown>;
    if (!storedHabitIsDue(data, dateKey)) return;
    habitTotal += 1;
    const habitId = String(data.habitId || habitDoc.id);
    if (completedHabitIds.has(habitId)) habitsCompleted += 1;
  });

  const taskCompletionRate =
    taskTotal > 0 ? Math.round((tasksCompleted / taskTotal) * 10000) / 100 : 0;
  const habitCompletionRate =
    habitTotal > 0 ? Math.round((habitsCompleted / habitTotal) * 10000) / 100 : 0;

  await setDoc(doc(db, DAYS_COLLECTION, dateKey), {
    dateKey,
    tasksCompleted,
    taskTotal,
    taskCompletionRate,
    habitsCompleted,
    habitTotal,
    habitCompletionRate,
    IsdayCompleted: taskCompletionRate === 100,
  });
}

async function rebuildAllDaySummaries(): Promise<void> {
  const [daysSnap, tasksSnap, logsSnap] = await Promise.all([
    getDocs(collection(db, DAYS_COLLECTION)),
    getDocs(collection(db, TASKS_COLLECTION)),
    getDocs(collection(db, HABIT_LOGS_COLLECTION)),
  ]);
  const dateKeys = new Set<string>();
  daysSnap.forEach((d) => {
    const key = normalizeModelDateKey(d.data().dateKey || d.id);
    if (key) dateKeys.add(key);
  });
  tasksSnap.forEach((d) => {
    const key = normalizeModelDateKey(d.data().scheduledDate);
    if (key) dateKeys.add(key);
  });
  logsSnap.forEach((d) => {
    const key = normalizeModelDateKey(d.data().dateKey);
    if (key) dateKeys.add(key);
  });
  for (const key of [...dateKeys].sort()) await rebuildDaySummary(key);
}

export interface CountdownSettings {
  targetDate: string;
  reason: string;
  updatedAt?: string;
}

export function subscribeToCountdownSettings(
  onUpdate: (settings: CountdownSettings | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, COUNTDOWNS_COLLECTION, COUNTDOWN_SETTINGS_DOC),
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(null);
        return;
      }
      const data = snapshot.data();
      onUpdate({
        targetDate: String(data.targetDate ?? ''),
        reason: String(data.title ?? ''),
      });
    },
    (err) => {
      console.error('Firestore countdown subscription error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveCountdownSettings(
  settings: Pick<CountdownSettings, 'targetDate' | 'reason'>
): Promise<void> {
  await setDoc(doc(db, COUNTDOWNS_COLLECTION, COUNTDOWN_SETTINGS_DOC), {
    countdownId: COUNTDOWN_SETTINGS_DOC,
    title: settings.reason || 'Countdown',
    targetDate: settings.targetDate,
    isActive: Boolean(settings.targetDate),
  });
}

/**
 * Subscribe to real-time updates from Firestore.
 * Automatically initializes initial sample data if the collection is empty.
 */

export type CanonicalCollectionName = 'users' | 'days' | 'tasks' | 'habits' | 'habitLogs' | 'countdowns';
export type CanonicalDataRow = { id: string; [key: string]: unknown };

export function subscribeToCanonicalData(
  onUpdate: (data: Record<CanonicalCollectionName, CanonicalDataRow[]>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const names: CanonicalCollectionName[] = ['users', 'days', 'tasks', 'habits', 'habitLogs', 'countdowns'];
  const state = Object.fromEntries(names.map((name) => [name, []])) as Record<CanonicalCollectionName, CanonicalDataRow[]>;
  const unsubs = names.map((name) => onSnapshot(
    collection(db, name),
    (snapshot) => {
      state[name] = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      onUpdate({ ...state });
    },
    (err) => onError?.(err)
  ));
  return () => unsubs.forEach((unsubscribe) => unsubscribe());
}

export function subscribeToRecords(
  onUpdate: (records: DailyRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, DAYS_COLLECTION),
    (snapshot) => {
      const rows = snapshot.docs
        .map((dayDoc) => {
          const data = dayDoc.data();
          const dateKey = String(data.dateKey || dayDoc.id);
          return { dateKey, data };
        })
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

      const records: DailyRecord[] = rows.map(({ dateKey, data }, index) => ({
        id: dateKey,
        day: index + 1,
        date: dateKey,
        isCompleted: data.IsdayCompleted === true,
        result: data.IsdayCompleted === true ? 'TRUE' : 'FALSE',
        change: 0,
        skill: 'Daily Review',
        summary: `${Number(data.tasksCompleted || 0)}/${Number(data.taskTotal || 0)} tasks • ${Number(data.habitsCompleted || 0)}/${Number(data.habitTotal || 0)} habits`,
        notes: '',
      }));
      onUpdate(records);
    },
    (err) => {
      console.error('Firestore days real-time subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Seed initial records into Firestore using batch operations
 */
export async function seedInitialData(_records: DailyRecord[]): Promise<void> {
  // Legacy API retained for UI compatibility. Days are derived from Tasks + HabitLogs.
}

export async function addRecordToCloud(record: DailyRecord): Promise<void> {
  const dateKey = normalizeModelDateKey(record.date);
  if (dateKey) await rebuildDaySummary(dateKey);
}

export async function updateRecordInCloud(record: DailyRecord): Promise<void> {
  const dateKey = normalizeModelDateKey(record.date);
  if (dateKey) await rebuildDaySummary(dateKey);
}

export async function deleteRecordFromCloud(recordId: string): Promise<void> {
  const dateKey = normalizeModelDateKey(recordId);
  if (dateKey) await deleteDoc(doc(db, DAYS_COLLECTION, dateKey));
}

export async function bulkAddRecordsToCloud(records: DailyRecord[]): Promise<void> {
  for (const record of records) {
    const dateKey = normalizeModelDateKey(record.date);
    if (dateKey) await rebuildDaySummary(dateKey);
  }
}

export async function resetRecordsInCloud(_initialRecords: DailyRecord[]): Promise<void> {
  await rebuildAllDaySummaries();
}

/**
 * Subscribe to real-time updates for tasks collection
 */
export function subscribeToTasks(
  onUpdate: (tasks: TaskItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const tasksCol = collection(db, TASKS_COLLECTION);

  return onSnapshot(
    tasksCol,
    async (snapshot) => {
      if (snapshot.empty) {
        onUpdate([]);
        return;
      }

      const fetchedTasks: TaskItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedTasks.push({
          id: String(data.taskId || docSnap.id),
          taskKey: String(data.scheduledDate ?? ''),
          taskOfTheDay: String(data.title ?? ''),
          isCompleted: data.Iscompleted === true,
          priority: data.priority ? (data.priority as 'High' | 'Medium' | 'Normal') : 'Normal',
          timeEstimate: data.timeEstimate ? String(data.timeEstimate) : '',
          category: data.category ? String(data.category) : '',
          notes: data.notes ? String(data.notes) : '',
          updatedAt: data.updatedAt ? String(data.updatedAt) : '',
          completedAt: data.completedAt ? String(data.completedAt) : undefined,
          matrixQuadrant: storedQuadrantToMatrix(data.quadrant),
          taskOrder:
            Number.isInteger(Number(data.taskOrder)) && Number(data.taskOrder) > 0
              ? Number(data.taskOrder)
              : 1,
        });
      });

      // Sort by taskKey descending so newest/today is first
      fetchedTasks.sort((a, b) => (b.taskKey || '').localeCompare(a.taskKey || ''));
      onUpdate(fetchedTasks);
    },
    (err) => {
      console.error('Firestore tasks real-time subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Seed initial tasks
 */
export async function seedInitialTasks(tasks: TaskItem[]): Promise<void> {
  const batch = writeBatch(db);
  for (const t of tasks) {
    const docRef = doc(db, TASKS_COLLECTION, t.id);
    batch.set(docRef, taskStoragePayload(t));
  }
  await batch.commit();
}

async function normalizeTaskOrderForDate(dateKey: string): Promise<void> {
  if (!dateKey) return;
  const snapshot = await getDocs(collection(db, TASKS_COLLECTION));
  const matching = snapshot.docs
    .filter((d) => normalizeModelDateKey(d.data().scheduledDate) === dateKey)
    .sort((a, b) => {
      const aTaskId = String(a.data().taskId || a.id);
      const bTaskId = String(b.data().taskId || b.id);
      return aTaskId.localeCompare(bTaskId, undefined, { numeric: true, sensitivity: 'base' });
    });
  if (!matching.length) return;
  const batch = writeBatch(db);
  matching.forEach((d, index) => {
    batch.set(d.ref, { taskOrder: index + 1, sortOrder: deleteField() }, { merge: true });
  });
  await batch.commit();
}

/**
 * Add a new task with duplicate prevention on the same date
 */
export async function addTaskToCloud(task: TaskItem): Promise<void> {
  const tasksSnap = await getDocs(collection(db, TASKS_COLLECTION));
  const existingTasks = tasksSnap.docs.map((d) => d.data());

  const normKey = standardizeDate(task.taskKey) || task.taskKey;

  // Prevent duplicate task ID
  const duplicateId = existingTasks.find((t) => String(t.taskId || '') === task.id);
  if (duplicateId) {
    throw new Error(`Duplicate task rejected: A task with ID ${task.id} already exists.`);
  }

  // Prevent duplicate task with identical title on the same date
  const duplicateName = existingTasks.find(
    (t) =>
      String(t.taskId || '') !== task.id &&
      (standardizeDate(String(t.scheduledDate || '')) === normKey ||
        String(t.scheduledDate || '') === task.taskKey) &&
      t.title &&
      task.taskOfTheDay &&
      String(t.title).trim().toLowerCase() ===
        String(task.taskOfTheDay).trim().toLowerCase()
  );
  if (duplicateName) {
    throw new Error(`Duplicate task rejected: A task named "${task.taskOfTheDay}" already exists for this date.`);
  }

  const docRef = doc(db, TASKS_COLLECTION, task.id);
  const sameDateCount = existingTasks.filter((t) => normalizeModelDateKey(t.scheduledDate) === normalizeModelDateKey(task.taskKey)).length;
  await setDoc(docRef, { ...taskStoragePayload(task), taskOrder: sameDateCount + 1 });
  await normalizeTaskOrderForDate(normalizeModelDateKey(task.taskKey));
  await rebuildDaySummary(normalizeModelDateKey(task.taskKey));
}

/**
 * Update an existing task with duplicate prevention
 */
export async function updateTaskInCloud(task: TaskItem): Promise<void> {
  const tasksSnap = await getDocs(collection(db, TASKS_COLLECTION));
  const existingTasks = tasksSnap.docs.map((d) => d.data());
  const previousTask = existingTasks.find(
    (stored) => String(stored.taskId || '') === task.id
  );
  const previousDateKey = normalizeModelDateKey(
    previousTask?.scheduledDate
  );

  const normKey = standardizeDate(task.taskKey) || task.taskKey;

  // Prevent duplicate task with identical title on the same date (excluding self)
  const duplicateName = existingTasks.find(
    (t) =>
      String(t.taskId || '') !== task.id &&
      (standardizeDate(String(t.scheduledDate || '')) === normKey ||
        String(t.scheduledDate || '') === task.taskKey) &&
      t.title &&
      task.taskOfTheDay &&
      String(t.title).trim().toLowerCase() === String(task.taskOfTheDay).trim().toLowerCase()
  );
  if (duplicateName) {
    throw new Error(`Another task named "${task.taskOfTheDay}" already exists for this date.`);
  }

  const docRef = doc(db, TASKS_COLLECTION, task.id);
  await setDoc(docRef, taskStoragePayload(task), { merge: true });

  const nextDateKey = normalizeModelDateKey(task.taskKey);
  await normalizeTaskOrderForDate(nextDateKey);
  await rebuildDaySummary(nextDateKey);
  if (previousDateKey && previousDateKey !== nextDateKey) {
    await normalizeTaskOrderForDate(previousDateKey);
    await rebuildDaySummary(previousDateKey);
  }
}

/**
 * Delete a task
 */
export async function deleteTaskFromCloud(taskId: string): Promise<void> {
  const snapshot = await getDocs(collection(db, TASKS_COLLECTION));
  const existing = snapshot.docs.find(
    (taskDoc) => String(taskDoc.data().taskId || taskDoc.data().id || taskDoc.id) === taskId
  );
  const dateKey = existing
    ? normalizeModelDateKey(existing.data().scheduledDate)
    : '';

  if (!existing) {
    // Idempotent delete: nothing remains to delete or renumber.
    return;
  }

  // Delete and renumber the affected date atomically so subscribers never
  // observe a post-delete gap in taskOrder.
  const batch = writeBatch(db);
  batch.delete(existing.ref);

  if (dateKey) {
    const remainingForDate = snapshot.docs
      .filter(
        (taskDoc) =>
          taskDoc.ref.path !== existing.ref.path &&
          normalizeModelDateKey(taskDoc.data().scheduledDate) === dateKey
      )
      .sort((a, b) => {
        const aTaskId = String(a.data().taskId || a.id);
        const bTaskId = String(b.data().taskId || b.id);
        return aTaskId.localeCompare(bTaskId, undefined, { numeric: true, sensitivity: 'base' });
      });

    remainingForDate.forEach((taskDoc, index) => {
      batch.set(
        taskDoc.ref,
        { taskOrder: index + 1, sortOrder: deleteField() },
        { merge: true }
      );
    });
  }

  await batch.commit();

  if (dateKey) {
    await rebuildDaySummary(dateKey);
  }
}

/**
 * Reset tasks to initial set
 */
export async function resetTasksInCloud(initialTasks: TaskItem[]): Promise<void> {
  const snapshot = await getDocs(collection(db, TASKS_COLLECTION));
  const batch = writeBatch(db);
  snapshot.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });
  for (const t of initialTasks) {
    const docRef = doc(db, TASKS_COLLECTION, t.id);
    batch.set(docRef, taskStoragePayload(t));
  }
  await batch.commit();
}

/**
 * Subscribe to real-time habit updates.
 */
export function subscribeToHabits(
  onUpdate: (habits: HabitItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  let habitsSnapshot: QuerySnapshot<DocumentData> | null = null;
  let habitLogsSnapshot: QuerySnapshot<DocumentData> | null = null;

  const emit = () => {
    if (!habitsSnapshot) return;

    const completedDatesByHabit = new Map<string, Set<string>>();

    if (habitLogsSnapshot) {
      habitLogsSnapshot.forEach((logDoc) => {
        const data = logDoc.data();
        if (data.Iscompleted !== true) return;

        const habitId = String(data.habitId || '');
        const dateKey = String(data.dateKey || '');
        if (!habitId || !dateKey) return;

        if (!completedDatesByHabit.has(habitId)) {
          completedDatesByHabit.set(habitId, new Set());
        }
        completedDatesByHabit.get(habitId)!.add(dateKey);
      });
    }

    const habits: HabitItem[] = [];

    habitsSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const habitId = String(data.habitId || docSnap.id);
      const migratedCheckIns = completedDatesByHabit.get(habitId) || new Set<string>();
      const checkIns = [...migratedCheckIns].sort();

      const activeFrom = data.activeFrom ? String(data.activeFrom) : undefined;
      const fallbackCreatedAt = activeFrom
        ? `${activeFrom}T00:00:00.000Z`
        : new Date().toISOString();

      habits.push({
        id: habitId,
        name: String(data.name ?? ''),
        emoji: String(data.emoji ?? '✓'),
        frequency: storedHabitFrequency(data),
        repeatDays: Array.isArray(data.repeatDays)
          ? data.repeatDays
              .map((value: unknown) => Number(value))
              .filter((value: number) => Number.isInteger(value) && value >= 0 && value <= 6)
          : undefined,
        skippedDates: Array.isArray(data.skippedDates)
          ? data.skippedDates.map((value: unknown) => String(value))
          : [],
        extraDates: Array.isArray(data.extraDates)
          ? data.extraDates.map((value: unknown) => String(value))
          : [],
        color: storedHabitColor(data.color),
        checkIns,
        createdAt: String(data.createdAt ?? fallbackCreatedAt),
        updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
        activeFrom,
        isActive: data.isActive !== false,
      });
    });

    habits.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    onUpdate(habits);
  };

  const unsubscribeHabits = onSnapshot(
    collection(db, HABITS_COLLECTION),
    (snapshot) => {
      habitsSnapshot = snapshot;
      emit();
    },
    (err) => {
      console.error('Firestore habits real-time subscription error:', err);
      try {
        handleFirestoreError(err, OperationType.GET, HABITS_COLLECTION);
      } catch (wrapped) {
        if (onError) onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const unsubscribeHabitLogs = onSnapshot(
    collection(db, HABIT_LOGS_COLLECTION),
    (snapshot) => {
      habitLogsSnapshot = snapshot;
      emit();
    },
    (err) => {
      console.error('Firestore habitLogs subscription error:', err);
      if (onError) onError(err);
    }
  );

  return () => {
    unsubscribeHabits();
    unsubscribeHabitLogs();
  };
}

export async function addHabitToCloud(habit: HabitItem): Promise<void> {
  try {
    await setDoc(doc(db, HABITS_COLLECTION, habit.id), habitStoragePayload(habit));
    await syncHabitLogsFromHabit(habit);
    await rebuildAllDaySummaries();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${HABITS_COLLECTION}/${habit.id}`);
  }
}

export async function updateHabitInCloud(habit: HabitItem): Promise<void> {
  try {
    await setDoc(
      doc(db, HABITS_COLLECTION, habit.id),
      habitStoragePayload(habit),
      { merge: true }
    );
    await syncHabitLogsFromHabit(habit);
    await rebuildAllDaySummaries();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${HABITS_COLLECTION}/${habit.id}`);
  }
}

export async function deleteHabitFromCloud(habitId: string): Promise<void> {
  try {
    const logsSnapshot = await getDocs(collection(db, HABIT_LOGS_COLLECTION));
    const batch = writeBatch(db);

    logsSnapshot.forEach((logDoc) => {
      if (String(logDoc.data().habitId || '') === habitId) {
        batch.delete(logDoc.ref);
      }
    });

    batch.delete(doc(db, HABITS_COLLECTION, habitId));
    await batch.commit();
    await rebuildAllDaySummaries();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${HABITS_COLLECTION}/${habitId}`);
  }
}

/**
 * Synchronize all records and tasks in Firestore (Task of the Day = Summary)
 */
export async function syncAllDataInCloud(
  _records: DailyRecord[],
  tasks: TaskItem[]
): Promise<void> {
  const batch = writeBatch(db);
  for (const t of tasks) {
    batch.set(doc(db, TASKS_COLLECTION, t.id), taskStoragePayload(t));
  }
  await batch.commit();
  await rebuildAllDaySummaries();
}

