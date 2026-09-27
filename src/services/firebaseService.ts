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

const RECORDS_COLLECTION = 'records';
const TASKS_COLLECTION = 'tasks';
const HABITS_COLLECTION = 'habits';
const HABIT_LOGS_COLLECTION = 'habitLogs';
const DAYS_COLLECTION = 'days';
const COUNTDOWNS_COLLECTION = 'countdowns';
const SETTINGS_COLLECTION = 'notification_settings';
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
    // Canonical single-user model fields.
    taskId: task.id,
    title: task.taskOfTheDay.trim(),
    quadrant: matrixQuadrantToRoman(task.matrixQuadrant),
    scheduledDate: task.taskKey,
    sortOrder: Number.isInteger(task.sortOrder) && Number(task.sortOrder) >= 0
      ? Number(task.sortOrder)
      : 0,
    notes: task.notes || '',
    Iscompleted: task.isCompleted,

    // Legacy compatibility fields retained until every consumer is migrated.
    id: task.id,
    taskKey: task.taskKey,
    taskOfTheDay: task.taskOfTheDay.trim(),
    isCompleted: task.isCompleted,
    priority: task.priority || 'Normal',
    timeEstimate: task.timeEstimate || '',
    category: task.category || 'General',
    updatedAt: new Date().toISOString(),
    completedAt: task.completedAt || null,
    matrixQuadrant: task.matrixQuadrant || null,
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
    // Canonical single-user model fields.
    habitId: habit.id,
    name: habit.name.trim(),
    repeatDays: habitRepeatDays(habit),
    activeFrom: habitActiveFrom(habit),
    isActive: habit.isActive !== false,
    color: habitColorToHex(habit.color),

    // Legacy compatibility fields retained during migration.
    id: habit.id,
    emoji: habit.emoji,
    frequency: habit.frequency,
    skippedDates: habit.skippedDates || [],
    extraDates: habit.extraDates || [],
    checkIns: habit.checkIns || [],
    createdAt: habit.createdAt,
    updatedAt: new Date().toISOString(),
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
    const habitLogId = `${habit.id}_${dateKey}`;
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

  const activeFrom =
    normalizeModelDateKey(data.activeFrom) ||
    normalizeModelDateKey(data.createdAt) ||
    '1970-01-01';

  if (dateKey < activeFrom) return false;

  const skippedDates = new Set(
    Array.isArray(data.skippedDates)
      ? data.skippedDates.map((value) => String(value))
      : []
  );
  const extraDates = new Set(
    Array.isArray(data.extraDates)
      ? data.extraDates.map((value) => String(value))
      : []
  );

  if (extraDates.has(dateKey)) return true;
  if (skippedDates.has(dateKey)) return false;

  const repeatDays = Array.isArray(data.repeatDays)
    ? data.repeatDays
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    : [];

  const frequency = storedHabitFrequency(data);
  const effectiveDays =
    frequency === 'daily'
      ? [0, 1, 2, 3, 4, 5, 6]
      : frequency === 'weekdays'
      ? [1, 2, 3, 4, 5]
      : repeatDays;

  const [year, month, day] = dateKey.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return effectiveDays.includes(weekday);
}

async function rebuildDaySummary(dateKey: string): Promise<void> {
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
    const taskDate = normalizeModelDateKey(data.scheduledDate || data.taskKey);
    if (taskDate !== dateKey) return;

    taskTotal += 1;
    const completed =
      typeof data.Iscompleted === 'boolean'
        ? data.Iscompleted
        : Boolean(data.isCompleted);
    if (completed) tasksCompleted += 1;
  });

  const completedHabitIds = new Set<string>();
  logsSnap.forEach((logDoc) => {
    const data = logDoc.data();
    if (
      String(data.dateKey || '') === dateKey &&
      data.Iscompleted === true &&
      data.habitId
    ) {
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
    const legacyCheckIns = Array.isArray(data.checkIns)
      ? data.checkIns.map((value) => String(value))
      : [];

    if (completedHabitIds.has(habitId) || legacyCheckIns.includes(dateKey)) {
      habitsCompleted += 1;
    }
  });

  const taskCompletionRate =
    taskTotal > 0 ? Math.round((tasksCompleted / taskTotal) * 10000) / 100 : 0;
  const habitCompletionRate =
    habitTotal > 0 ? Math.round((habitsCompleted / habitTotal) * 10000) / 100 : 0;

  await setDoc(
    doc(db, DAYS_COLLECTION, dateKey),
    {
      dateKey,
      tasksCompleted,
      taskTotal,
      taskCompletionRate,
      habitsCompleted,
      habitTotal,
      habitCompletionRate,
      IsdayCompleted: taskCompletionRate === 100,
    },
    { merge: true }
  );
}

async function rebuildAllDaySummaries(): Promise<void> {
  const [daysSnap, recordsSnap, tasksSnap, habitsSnap] = await Promise.all([
    getDocs(collection(db, DAYS_COLLECTION)),
    getDocs(collection(db, RECORDS_COLLECTION)),
    getDocs(collection(db, TASKS_COLLECTION)),
    getDocs(collection(db, HABITS_COLLECTION)),
  ]);

  const dateKeys = new Set<string>();

  daysSnap.forEach((dayDoc) => {
    const key = normalizeModelDateKey(dayDoc.data().dateKey || dayDoc.id);
    if (key) dateKeys.add(key);
  });

  recordsSnap.forEach((recordDoc) => {
    const key = normalizeModelDateKey(recordDoc.data().date);
    if (key) dateKeys.add(key);
  });

  tasksSnap.forEach((taskDoc) => {
    const data = taskDoc.data();
    const key = normalizeModelDateKey(data.scheduledDate || data.taskKey);
    if (key) dateKeys.add(key);
  });

  habitsSnap.forEach((habitDoc) => {
    const data = habitDoc.data();
    if (Array.isArray(data.checkIns)) {
      data.checkIns.forEach((value: unknown) => {
        const key = normalizeModelDateKey(value);
        if (key) dateKeys.add(key);
      });
    }
  });

  for (const dateKey of [...dateKeys].sort()) {
    await rebuildDaySummary(dateKey);
  }
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
    doc(db, SETTINGS_COLLECTION, COUNTDOWN_SETTINGS_DOC),
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(null);
        return;
      }

      const data = snapshot.data();
      onUpdate({
        targetDate: String(data.targetDate ?? ''),
        reason: String(data.reason ?? ''),
        updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
      });
    },
    (err) => {
      console.error('Firestore countdown settings subscription error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveCountdownSettings(
  settings: Pick<CountdownSettings, 'targetDate' | 'reason'>
): Promise<void> {
  const updatedAt = new Date().toISOString();

  await Promise.all([
    setDoc(
      doc(db, SETTINGS_COLLECTION, COUNTDOWN_SETTINGS_DOC),
      {
        targetDate: settings.targetDate,
        reason: settings.reason,
        updatedAt,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, COUNTDOWNS_COLLECTION, COUNTDOWN_SETTINGS_DOC),
      {
        countdownId: COUNTDOWN_SETTINGS_DOC,
        title: settings.reason || 'Countdown',
        targetDate: settings.targetDate,
        isActive: Boolean(settings.targetDate),
      },
      { merge: true }
    ),
  ]);
}

/**
 * Subscribe to real-time updates from Firestore.
 * Automatically initializes initial sample data if the collection is empty.
 */
export function subscribeToRecords(
  onUpdate: (records: DailyRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const recordsCol = collection(db, RECORDS_COLLECTION);

  return onSnapshot(
    recordsCol,
    async (snapshot) => {
      if (snapshot.empty) {
        // Seed default template data if remote database is empty
        try {
          await seedInitialData(INITIAL_RECORDS);
        } catch (e) {
          console.error('Error seeding initial records to Firestore:', e);
          onUpdate(INITIAL_RECORDS);
        }
        return;
      }

      const fetchedRecords: DailyRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const rawDate = String(data.date ?? '');
        fetchedRecords.push({
          id: docSnap.id,
          day: Number(data.day ?? 0),
          date: standardizeDate(rawDate) || rawDate,
          isCompleted: Boolean(data.isCompleted),
          result: data.isCompleted ? 'TRUE' : 'FALSE',
          change: Number(data.change ?? 0),
          skill: String(data.skill ?? 'Power BI'),
          summary: String(data.summary ?? ''),
          notes: data.notes ? String(data.notes) : '',
          responseSubmittedAt: data.responseSubmittedAt ? String(data.responseSubmittedAt) : undefined,
          responseSource: data.responseSource
            ? (String(data.responseSource) as DailyRecord['responseSource'])
            : undefined,
          updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
        });
      });

      // Sort sequentially by Day number
      fetchedRecords.sort((a, b) => a.day - b.day);

      // Deduplicate to guarantee strictly unique day values across all records in the Tasks table
      const seenDays = new Set<number>();
      const dedupedRecords: DailyRecord[] = [];
      for (const rec of fetchedRecords) {
        let safeDay = rec.day;
        if (seenDays.has(safeDay) || safeDay <= 0) {
          safeDay = 1;
          while (seenDays.has(safeDay)) {
            safeDay++;
          }
        }
        seenDays.add(safeDay);
        dedupedRecords.push(safeDay === rec.day ? rec : { ...rec, day: safeDay });
      }

      onUpdate(dedupedRecords);
    },
    (err) => {
      console.error('Firestore real-time subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Seed initial records into Firestore using batch operations
 */
export async function seedInitialData(records: DailyRecord[]): Promise<void> {
  const batch = writeBatch(db);
  for (const r of records) {
    const docRef = doc(db, RECORDS_COLLECTION, r.id);
    batch.set(docRef, {
      id: r.id,
      day: r.day,
      date: r.date,
      isCompleted: r.isCompleted,
      result: r.result,
      change: r.change,
      skill: r.skill || '',
      summary: r.summary || '',
      notes: r.notes || '',
      updatedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
}

/**
 * Add a single record to Firestore with strict duplicate validation
 */
export async function addRecordToCloud(record: DailyRecord): Promise<void> {
  const recordsSnap = await getDocs(collection(db, RECORDS_COLLECTION));
  const existingRecords = recordsSnap.docs.map((d) => d.data());

  const formattedDate = standardizeDate(record.date) || record.date;

  // Prevent duplicate day in Tasks table
  const duplicateDay = existingRecords.find(
    (r) => r.id !== record.id && Number(r.day) === Number(record.day)
  );
  if (duplicateDay) {
    throw new Error(`Duplicate value rejected: Day ${record.day} already exists in Tasks table.`);
  }

  // Prevent duplicate date in Tasks table
  const duplicateDate = existingRecords.find(
    (r) =>
      r.id !== record.id &&
      (standardizeDate(r.date) === formattedDate ||
        String(r.date || '').toLowerCase() === formattedDate.toLowerCase())
  );
  if (duplicateDate) {
    throw new Error(`Duplicate value rejected: A task for date ${formattedDate} already exists in Tasks table.`);
  }

  const docRef = doc(db, RECORDS_COLLECTION, record.id);
  await setDoc(docRef, {
    id: record.id,
    day: record.day,
    date: formattedDate,
    isCompleted: record.isCompleted,
    result: record.result,
    change: record.change,
    skill: record.skill || '',
    summary: record.summary || '',
    notes: record.notes || '',
    ...(record.responseSubmittedAt ? { responseSubmittedAt: record.responseSubmittedAt } : {}),
    ...(record.responseSource ? { responseSource: record.responseSource } : {}),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Update an existing record in Firestore with duplicate prevention
 */
export async function updateRecordInCloud(record: DailyRecord): Promise<void> {
  const recordsSnap = await getDocs(collection(db, RECORDS_COLLECTION));
  const existingRecords = recordsSnap.docs.map((d) => d.data());

  const formattedDate = standardizeDate(record.date) || record.date;

  // Prevent assigning an existing day number of another task
  const duplicateDay = existingRecords.find(
    (r) => r.id !== record.id && Number(r.day) === Number(record.day)
  );
  if (duplicateDay) {
    throw new Error(`Duplicate value rejected: Day ${record.day} is already assigned to another task.`);
  }

  // Prevent assigning an existing date of another task
  const duplicateDate = existingRecords.find(
    (r) =>
      r.id !== record.id &&
      (standardizeDate(r.date) === formattedDate ||
        String(r.date || '').toLowerCase() === formattedDate.toLowerCase())
  );
  if (duplicateDate) {
    throw new Error(`Duplicate value rejected: A task for date ${formattedDate} already exists in Tasks table.`);
  }

  const docRef = doc(db, RECORDS_COLLECTION, record.id);
  await setDoc(
    docRef,
    {
      id: record.id,
      day: record.day,
      date: formattedDate,
      isCompleted: record.isCompleted,
      result: record.result,
      change: record.change,
      skill: record.skill || '',
      summary: record.summary || '',
      notes: record.notes || '',
      ...(record.responseSubmittedAt ? { responseSubmittedAt: record.responseSubmittedAt } : {}),
      ...(record.responseSource ? { responseSource: record.responseSource } : {}),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * Delete a record from Firestore
 */
export async function deleteRecordFromCloud(recordId: string): Promise<void> {
  const docRef = doc(db, RECORDS_COLLECTION, recordId);
  await deleteDoc(docRef);
}

/**
 * Bulk add or import records to Firestore
 */
export async function bulkAddRecordsToCloud(records: DailyRecord[]): Promise<void> {
  const batch = writeBatch(db);
  for (const r of records) {
    const docRef = doc(db, RECORDS_COLLECTION, r.id);
    batch.set(
      docRef,
      {
        id: r.id,
        day: r.day,
        date: r.date,
        isCompleted: r.isCompleted,
        result: r.result,
        change: r.change,
        skill: r.skill || '',
        summary: r.summary || '',
        notes: r.notes || '',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }
  await batch.commit();
}

/**
 * Reset all records in Firestore to the initial template dataset
 */
export async function resetRecordsInCloud(initialRecords: DailyRecord[]): Promise<void> {
  const snapshot = await getDocs(collection(db, RECORDS_COLLECTION));
  const batch = writeBatch(db);
  snapshot.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });
  for (const r of initialRecords) {
    const docRef = doc(db, RECORDS_COLLECTION, r.id);
    batch.set(docRef, {
      id: r.id,
      day: r.day,
      date: r.date,
      isCompleted: r.isCompleted,
      result: r.result,
      change: r.change,
      skill: r.skill || '',
      summary: r.summary || '',
      notes: r.notes || '',
      updatedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
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
          taskKey: String(data.scheduledDate ?? data.taskKey ?? ''),
          taskOfTheDay: String(data.title ?? data.taskOfTheDay ?? ''),
          isCompleted:
            typeof data.Iscompleted === 'boolean'
              ? data.Iscompleted
              : Boolean(data.isCompleted),
          priority: data.priority ? (data.priority as 'High' | 'Medium' | 'Normal') : 'Normal',
          timeEstimate: data.timeEstimate ? String(data.timeEstimate) : '',
          category: data.category ? String(data.category) : '',
          notes: data.notes ? String(data.notes) : '',
          updatedAt: data.updatedAt ? String(data.updatedAt) : '',
          completedAt: data.completedAt ? String(data.completedAt) : undefined,
          matrixQuadrant: storedQuadrantToMatrix(data.quadrant ?? data.matrixQuadrant),
          sortOrder:
            Number.isInteger(Number(data.sortOrder)) && Number(data.sortOrder) >= 0
              ? Number(data.sortOrder)
              : 0,
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

/**
 * Add a new task with duplicate prevention on the same date
 */
export async function addTaskToCloud(task: TaskItem): Promise<void> {
  const tasksSnap = await getDocs(collection(db, TASKS_COLLECTION));
  const existingTasks = tasksSnap.docs.map((d) => d.data());

  const normKey = standardizeDate(task.taskKey) || task.taskKey;

  // Prevent duplicate task ID
  const duplicateId = existingTasks.find((t) => String(t.taskId || t.id || '') === task.id);
  if (duplicateId) {
    throw new Error(`Duplicate task rejected: A task with ID ${task.id} already exists.`);
  }

  // Prevent duplicate task with identical title on the same date
  const duplicateName = existingTasks.find(
    (t) =>
      String(t.taskId || t.id || '') !== task.id &&
      (standardizeDate(String(t.scheduledDate || t.taskKey || '')) === normKey ||
        String(t.scheduledDate || t.taskKey || '') === task.taskKey) &&
      (t.title || t.taskOfTheDay) &&
      task.taskOfTheDay &&
      String(t.title || t.taskOfTheDay).trim().toLowerCase() ===
        String(task.taskOfTheDay).trim().toLowerCase()
  );
  if (duplicateName) {
    throw new Error(`Duplicate task rejected: A task named "${task.taskOfTheDay}" already exists for this date.`);
  }

  const docRef = doc(db, TASKS_COLLECTION, task.id);
  await setDoc(docRef, taskStoragePayload(task));
  await rebuildDaySummary(normalizeModelDateKey(task.taskKey));
}

/**
 * Update an existing task with duplicate prevention
 */
export async function updateTaskInCloud(task: TaskItem): Promise<void> {
  const tasksSnap = await getDocs(collection(db, TASKS_COLLECTION));
  const existingTasks = tasksSnap.docs.map((d) => d.data());
  const previousTask = existingTasks.find(
    (stored) => String(stored.taskId || stored.id || '') === task.id
  );
  const previousDateKey = normalizeModelDateKey(
    previousTask?.scheduledDate || previousTask?.taskKey
  );

  const normKey = standardizeDate(task.taskKey) || task.taskKey;

  // Prevent duplicate task with identical title on the same date (excluding self)
  const duplicateName = existingTasks.find(
    (t) =>
      t.id !== task.id &&
      (standardizeDate(t.taskKey) === normKey || t.taskKey === task.taskKey) &&
      t.taskOfTheDay &&
      task.taskOfTheDay &&
      String(t.taskOfTheDay).trim().toLowerCase() === String(task.taskOfTheDay).trim().toLowerCase()
  );
  if (duplicateName) {
    throw new Error(`Another task named "${task.taskOfTheDay}" already exists for this date.`);
  }

  const docRef = doc(db, TASKS_COLLECTION, task.id);
  await setDoc(docRef, taskStoragePayload(task), { merge: true });

  const nextDateKey = normalizeModelDateKey(task.taskKey);
  await rebuildDaySummary(nextDateKey);
  if (previousDateKey && previousDateKey !== nextDateKey) {
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
    ? normalizeModelDateKey(existing.data().scheduledDate || existing.data().taskKey)
    : '';

  const docRef = doc(db, TASKS_COLLECTION, taskId);
  await deleteDoc(docRef);

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
      const legacyCheckIns = Array.isArray(data.checkIns)
        ? data.checkIns.map((value: unknown) => String(value))
        : [];
      const migratedCheckIns = completedDatesByHabit.get(habitId) || new Set<string>();
      const checkIns = [...new Set([...legacyCheckIns, ...migratedCheckIns])].sort();

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
      // During rollout, older deployed rules may not allow habitLogs yet.
      // Legacy checkIns remain authoritative until the new rules are deployed.
      console.warn('HabitLogs are not available yet; using legacy habit check-ins:', err);
      habitLogsSnapshot = null;
      emit();
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
  records: DailyRecord[],
  tasks: TaskItem[]
): Promise<void> {
  const batch = writeBatch(db);

  for (const r of records) {
    const docRef = doc(db, RECORDS_COLLECTION, r.id);
    batch.set(
      docRef,
      {
        id: r.id,
        day: r.day,
        date: r.date,
        isCompleted: r.isCompleted,
        result: r.result,
        change: r.change,
        skill: r.skill,
        summary: r.summary,
        notes: r.notes || '',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  for (const t of tasks) {
    const docRef = doc(db, TASKS_COLLECTION, t.id);
    batch.set(
      docRef,
      taskStoragePayload(t),
      { merge: true }
    );
  }

  await batch.commit();
}

