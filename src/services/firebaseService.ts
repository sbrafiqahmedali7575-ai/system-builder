import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  getDocs,
  getDoc,
  getDocFromServer,
  writeBatch,
  runTransaction,
  Unsubscribe,
  type QuerySnapshot,
  type DocumentData,
  type DocumentReference,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { DailyRecord, HabitItem, TaskItem } from '../types';
import { INITIAL_RECORDS, INITIAL_TASKS } from '../data/initialData';
import { standardizeDate } from '../utils/dateUtils';
import {
  CONFIGURED_TIMEZONE,
  getIsoDateKeyInTimezone,
} from '../utils/taskDateUtils';

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
const TASK_UNIQUE_KEYS_COLLECTION = 'taskUniqueKeys';
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

function normalizedTaskTitleKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

function taskLogicalKey(dateValue: unknown, titleValue: unknown): string {
  return `${normalizeModelDateKey(dateValue)}::${normalizedTaskTitleKey(titleValue)}`;
}

function normalizedTaskLogicalKey(task: TaskItem): string {
  return taskLogicalKey(task.taskKey, task.taskOfTheDay);
}

function taskUniqueKeyDocumentId(logicalKey: string): string {
  // 64-bit FNV-1a keeps the Firestore document ID short even for long/Unicode titles.
  let hash = 0xcbf29ce484222325n;
  for (const character of logicalKey) {
    hash ^= BigInt(character.codePointAt(0) || 0);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

function taskUniqueKeyRef(dateValue: unknown, titleValue: unknown) {
  const logicalKey = taskLogicalKey(dateValue, titleValue);
  return {
    logicalKey,
    ref: doc(db, TASK_UNIQUE_KEYS_COLLECTION, taskUniqueKeyDocumentId(logicalKey)),
  };
}

function preferTaskCopy(current: TaskItem, candidate: TaskItem): TaskItem {
  const currentCanonical = /^T[1-9]\d*$/i.test(current.id);
  const candidateCanonical = /^T[1-9]\d*$/i.test(candidate.id);

  if (candidateCanonical !== currentCanonical) {
    return candidateCanonical ? candidate : current;
  }

  if ((candidate.updatedAt || '') !== (current.updatedAt || '')) {
    return (candidate.updatedAt || '') > (current.updatedAt || '')
      ? candidate
      : current;
  }

  return candidate.id.localeCompare(current.id, undefined, {
    numeric: true,
    sensitivity: 'base',
  }) < 0
    ? candidate
    : current;
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

function normalizeInactivePeriods(value: unknown): Array<{ from: string; to?: string | null }> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const from = normalizeModelDateKey(row.from);
      const to = row.to ? normalizeModelDateKey(row.to) : null;
      if (!from) return null;
      return { from, to: to || null };
    })
    .filter((item): item is { from: string; to: string | null } => Boolean(item))
    .sort((a, b) => a.from.localeCompare(b.from));
}

function shiftModelDateKey(dateKey: string, amount: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function applyHabitActivationTransition(
  previous: Record<string, unknown> | null,
  habit: HabitItem
): HabitItem {
  const today = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
  const previousIsActive = previous ? previous.isActive !== false : true;
  const nextIsActive = habit.isActive !== false;
  const periods = normalizeInactivePeriods(
    habit.inactivePeriods ?? previous?.inactivePeriods
  );

  if (previousIsActive && !nextIsActive) {
    const hasOpenPeriod = periods.some((period) => !period.to);
    if (!hasOpenPeriod) {
      periods.push({ from: today, to: null });
    }
  } else if (!previousIsActive && nextIsActive) {
    const openIndex = periods.findIndex((period) => !period.to);
    if (openIndex >= 0) {
      const open = periods[openIndex];
      if (open.from === today) {
        // Disabled and re-enabled on the same date: no full inactive day elapsed.
        periods.splice(openIndex, 1);
      } else {
        periods[openIndex] = {
          ...open,
          to: shiftModelDateKey(today, -1),
        };
      }
    }
  }

  return {
    ...habit,
    isActive: nextIsActive,
    inactivePeriods: periods,
  };
}

function habitStoragePayload(habit: HabitItem): Record<string, unknown> {
  return {
    habitId: habit.id,
    name: habit.name.trim(),
    repeatDays: habitRepeatDays(habit),
    activeFrom: habitActiveFrom(habit),
    isActive: habit.isActive !== false,
    inactivePeriods: normalizeInactivePeriods(habit.inactivePeriods),
    color: habitColorToHex(habit.color),
  };
}

async function syncHabitLogsFromHabit(habit: HabitItem): Promise<void> {
  const logsSnapshot = await getDocs(collection(db, HABIT_LOGS_COLLECTION));
  const today = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
  const checkedToday = (habit.checkIns || [])
    .map((value) => normalizeModelDateKey(value))
    .includes(today);

  const usedNumbers = new Set<number>();
  const todayLogs: Array<typeof logsSnapshot.docs[number]> = [];

  logsSnapshot.docs.forEach((logDoc) => {
    const data = logDoc.data();
    const storedId = String(data.habitLogId || logDoc.id);
    const match = /^HL(\d+)$/i.exec(storedId);
    if (match) usedNumbers.add(Number(match[1]));

    if (
      String(data.habitId || '') === habit.id &&
      normalizeModelDateKey(data.dateKey) === today
    ) {
      todayLogs.push(logDoc);
    }
  });

  // Do not create HabitLogs in advance. A new row is eligible only for today.
  if (todayLogs.length === 0) {
    if (!storedHabitIsDue(habitStoragePayload(habit), today) && !checkedToday) return;

    let nextNumber = 1;
    while (usedNumbers.has(nextNumber)) nextNumber += 1;
    const habitLogId = `HL${nextNumber}`;

    await setDoc(doc(db, HABIT_LOGS_COLLECTION, habitLogId), {
      habitLogId,
      habitId: habit.id,
      dateKey: today,
      Iscompleted: checkedToday,
    });
    return;
  }

  // Existing today's row is updated in place; no additional row is created.
  const primary = todayLogs.find((logDoc) =>
    /^HL\d+$/i.test(String(logDoc.data().habitLogId || logDoc.id))
  ) || todayLogs[0];

  await setDoc(
    primary.ref,
    {
      habitLogId: String(primary.data().habitLogId || primary.id),
      habitId: habit.id,
      dateKey: today,
      Iscompleted: checkedToday,
    },
    { merge: true }
  );

  // Remove duplicate rows for the same habit/today.
  const duplicates = todayLogs.filter((logDoc) => logDoc.id !== primary.id);
  if (duplicates.length > 0) {
    const batch = writeBatch(db);
    duplicates.forEach((logDoc) => batch.delete(logDoc.ref));
    await batch.commit();
  }
}

async function getCompletedHabitDates(habitId: string): Promise<Set<string>> {
  const snapshot = await getDocs(collection(db, HABIT_LOGS_COLLECTION));
  const dates = new Set<string>();

  snapshot.forEach((logDoc) => {
    const data = logDoc.data();
    if (
      String(data.habitId || '') === habitId &&
      data.Iscompleted === true
    ) {
      const dateKey = normalizeModelDateKey(data.dateKey);
      if (dateKey) dates.add(dateKey);
    }
  });

  return dates;
}

function sameNumberSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const aa = [...a].sort((x, y) => x - y);
  const bb = [...b].sort((x, y) => x - y);
  return aa.every((value, index) => value === bb[index]);
}

function habitScheduleChanged(
  previous: Record<string, unknown> | null,
  nextHabit: HabitItem
): boolean {
  if (!previous) return true;

  const previousDays = Array.isArray(previous.repeatDays)
    ? previous.repeatDays
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    : [];

  const nextDays = habitRepeatDays(nextHabit);
  const previousActiveFrom =
    normalizeModelDateKey(previous.activeFrom) || '1970-01-01';
  const nextActiveFrom = habitActiveFrom(nextHabit);
  const previousIsActive = previous.isActive !== false;
  const nextIsActive = nextHabit.isActive !== false;

  return (
    !sameNumberSet(previousDays, nextDays) ||
    previousActiveFrom !== nextActiveFrom ||
    previousIsActive !== nextIsActive
  );
}

function symmetricDifferenceDates(
  previousDates: Set<string>,
  nextDates: Set<string>
): string[] {
  const changed = new Set<string>();

  previousDates.forEach((dateKey) => {
    if (!nextDates.has(dateKey)) changed.add(dateKey);
  });
  nextDates.forEach((dateKey) => {
    if (!previousDates.has(dateKey)) changed.add(dateKey);
  });

  return [...changed].sort();
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
  const activeFrom = normalizeModelDateKey(data.activeFrom) || '1970-01-01';
  if (dateKey < activeFrom) return false;

  const inactivePeriods = normalizeInactivePeriods(data.inactivePeriods);
  const inactiveForDate = inactivePeriods.some((period) => {
    if (dateKey < period.from) return false;
    return !period.to || dateKey <= period.to;
  });
  if (inactiveForDate) return false;

  // Backward compatibility for an old inactive document created before pause
  // periods were tracked.
  if (data.isActive === false && inactivePeriods.length === 0) return false;

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

export async function ensureHabitLogsForDate(dateKey: string): Promise<void> {
  const normalizedDateKey = normalizeModelDateKey(dateKey);
  if (!normalizedDateKey) return;

  const [habitsSnap, logsSnap] = await Promise.all([
    getDocs(collection(db, HABITS_COLLECTION)),
    getDocs(collection(db, HABIT_LOGS_COLLECTION)),
  ]);

  const logsByHabit = new Map<string, Array<typeof logsSnap.docs[number]>>();
  logsSnap.docs.forEach((logDoc) => {
    const data = logDoc.data();
    if (normalizeModelDateKey(data.dateKey) !== normalizedDateKey) return;

    const habitId = String(data.habitId || '');
    if (!habitId) return;

    const rows = logsByHabit.get(habitId) || [];
    rows.push(logDoc);
    logsByHabit.set(habitId, rows);
  });

  const writes: Array<{
    ref: DocumentReference<DocumentData>;
    data?: Record<string, unknown>;
    delete?: boolean;
  }> = [];

  habitsSnap.docs.forEach((habitDoc) => {
    const data = habitDoc.data() as Record<string, unknown>;
    if (!storedHabitIsDue(data, normalizedDateKey)) return;

    const habitId = String(data.habitId || habitDoc.id);
    const existing = logsByHabit.get(habitId) || [];
    const canonicalId = habitLogDocumentId(habitId, normalizedDateKey);
    const anyCompleted = existing.some(
      (logDoc) => logDoc.data().Iscompleted === true
    );

    writes.push({
      ref: doc(db, HABIT_LOGS_COLLECTION, canonicalId),
      data: {
        habitLogId: canonicalId,
        habitId,
        dateKey: normalizedDateKey,
        Iscompleted: anyCompleted,
      },
    });

    existing.forEach((logDoc) => {
      if (logDoc.id !== canonicalId) {
        writes.push({ ref: logDoc.ref, delete: true });
      }
    });
  });

  await commitBatchedMutations(writes);
}

export async function rebuildDaySummary(dateKey: string): Promise<void> {
  if (!dateKey) return;

  await ensureHabitLogsForDate(dateKey);

  const [tasksSnap, habitsSnap, logsSnap] = await Promise.all([
    getDocs(collection(db, TASKS_COLLECTION)),
    getDocs(collection(db, HABITS_COLLECTION)),
    getDocs(collection(db, HABIT_LOGS_COLLECTION)),
  ]);

  let tasks = 0;
  let tasksDone = 0;
  tasksSnap.forEach((taskDoc) => {
    const data = taskDoc.data();
    if (normalizeModelDateKey(data.scheduledDate) !== dateKey) return;
    tasks += 1;
    if (data.Iscompleted === true) tasksDone += 1;
  });

  const completedHabitIds = new Set<string>();
  logsSnap.forEach((logDoc) => {
    const data = logDoc.data();
    if (String(data.dateKey || '') === dateKey && data.Iscompleted === true && data.habitId) {
      completedHabitIds.add(String(data.habitId));
    }
  });

  let Habits = 0;
  let habitsDone = 0;
  habitsSnap.forEach((habitDoc) => {
    const data = habitDoc.data() as Record<string, unknown>;
    if (!storedHabitIsDue(data, dateKey)) return;
    Habits += 1;
    const habitId = String(data.habitId || habitDoc.id);
    if (completedHabitIds.has(habitId)) habitsDone += 1;
  });

  const tasksCompleted =
    tasks > 0 ? Math.round((tasksDone / tasks) * 100) : 0;
  const habitsCompleted =
    Habits > 0 ? Math.round((habitsDone / Habits) * 100) : 0;
  const dayCompleted = Math.round(tasksCompleted * 0.8 + habitsCompleted * 0.2);

  await setDoc(doc(db, DAYS_COLLECTION, dateKey), {
    dateKey,
    tasksDone,
    tasks,
    tasksCompleted,
    habitsDone,
    Habits,
    habitsCompleted,
    dayCompleted,
    IsdayCompleted: dayCompleted >= 80,
  });
}

export async function initializeDayHabitStatus(dateKey: string): Promise<void> {
  const normalizedDateKey = normalizeModelDateKey(dateKey);
  if (!normalizedDateKey) return;
  await ensureHabitLogsForDate(normalizedDateKey);
  await rebuildDaySummary(normalizedDateKey);
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
      const rows: CanonicalDataRow[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Record<string, unknown>),
      }));
      if (name === 'tasks') {
        const byDate = new Map<string, CanonicalDataRow[]>();
        rows.forEach((row) => {
          const dateKey = normalizeModelDateKey(row.scheduledDate);
          if (!dateKey) return;
          const group = byDate.get(dateKey) || [];
          group.push(row);
          byDate.set(dateKey, group);
        });
        byDate.forEach((tasksForDate) => {
          tasksForDate
            .sort((a, b) =>
              String(a.taskId || a.id).localeCompare(
                String(b.taskId || b.id),
                undefined,
                { numeric: true, sensitivity: 'base' }
              )
            )
            .forEach((row, index) => {
              row.taskOrder = index + 1;
            });
        });
      }
      state[name] = rows;
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
        summary: `${Number(data.tasksDone || 0)}/${Number(data.tasks || 0)} tasks • ${Number(data.habitsDone || 0)}/${Number(data.Habits || 0)} habits`,
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

      // Collapse stale duplicate documents by logical identity (date + title)
      // before anything reaches the UI. The V7 migration removes the extra
      // documents from Firestore; this keeps the dashboard clean immediately.
      const dedupedByLogicalKey = new Map<string, TaskItem>();
      fetchedTasks.forEach((task) => {
        const key = normalizedTaskLogicalKey(task);
        const existing = dedupedByLogicalKey.get(key);
        dedupedByLogicalKey.set(
          key,
          existing ? preferTaskCopy(existing, task) : task
        );
      });
      const visibleTasks = Array.from(dedupedByLogicalKey.values());

      // Normalize taskOrder in memory first so the UI never renders gaps.
      // Persist any differences to Firestore in parallel.
      const taskById = new Map(visibleTasks.map((task) => [task.id, task]));
      const byDate = new Map<string, typeof snapshot.docs>();
      snapshot.docs.forEach((taskDoc) => {
        const dateKey = normalizeModelDateKey(taskDoc.data().scheduledDate);
        if (!dateKey) return;
        const group = byDate.get(dateKey) || [];
        group.push(taskDoc);
        byDate.set(dateKey, group);
      });

      const repairBatch = writeBatch(db);
      let needsRepair = false;
      byDate.forEach((taskDocs) => {
        taskDocs.sort((a, b) => {
          const aTaskId = String(a.data().taskId || a.id);
          const bTaskId = String(b.data().taskId || b.id);
          return aTaskId.localeCompare(bTaskId, undefined, { numeric: true, sensitivity: 'base' });
        });

        taskDocs.forEach((taskDoc, index) => {
          const expectedOrder = index + 1;
          const taskId = String(taskDoc.data().taskId || taskDoc.id);
          const loadedTask = taskById.get(taskId);
          if (loadedTask) loadedTask.taskOrder = expectedOrder;

          if (Number(taskDoc.data().taskOrder) !== expectedOrder || taskDoc.data().sortOrder !== undefined) {
            repairBatch.set(
              taskDoc.ref,
              { taskOrder: expectedOrder, sortOrder: deleteField() },
              { merge: true }
            );
            needsRepair = true;
          }
        });
      });

      // Newest scheduledDate first; taskId DESC inside the same date.
      visibleTasks.sort((a, b) => {
        const dateComparison = (b.taskKey || '').localeCompare(a.taskKey || '');
        if (dateComparison !== 0) return dateComparison;
        return b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' });
      });
      onUpdate(visibleTasks);

      if (needsRepair) {
        await repairBatch.commit();
      }
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
  const targetDateKey = normalizeModelDateKey(task.taskKey);
  const { logicalKey, ref: uniqueKeyRef } = taskUniqueKeyRef(
    task.taskKey,
    task.taskOfTheDay
  );
  const taskRef = doc(db, TASKS_COLLECTION, task.id);

  // Keep the friendly validation before the transaction, but the transaction
  // below is the actual uniqueness guarantee across tabs/devices.
  const duplicateName = existingTasks.find(
    (stored) =>
      String(stored.taskId || '') !== task.id &&
      taskLogicalKey(stored.scheduledDate, stored.title) === logicalKey
  );
  if (duplicateName) {
    throw new Error(
      `Duplicate task rejected: A task named "${task.taskOfTheDay}" already exists for this date.`
    );
  }

  const sameDateCount = existingTasks.filter(
    (stored) => normalizeModelDateKey(stored.scheduledDate) === targetDateKey
  ).length;

  await runTransaction(db, async (transaction) => {
    const [uniqueSnapshot, taskSnapshot] = await Promise.all([
      transaction.get(uniqueKeyRef),
      transaction.get(taskRef),
    ]);

    if (taskSnapshot.exists()) {
      throw new Error(
        `Duplicate task rejected: A task with ID ${task.id} already exists.`
      );
    }

    if (uniqueSnapshot.exists()) {
      const ownerTaskId = String(uniqueSnapshot.data().taskId || '');
      if (ownerTaskId !== task.id) {
        throw new Error(
          `Duplicate task rejected: A task named "${task.taskOfTheDay}" already exists for this date.`
        );
      }
    }

    transaction.set(taskRef, {
      ...taskStoragePayload(task),
      taskOrder: sameDateCount + 1,
    });
    transaction.set(uniqueKeyRef, {
      logicalKey,
      taskId: task.id,
      scheduledDate: targetDateKey,
      normalizedTitle: normalizedTaskTitleKey(task.taskOfTheDay),
      updatedAt: new Date().toISOString(),
    });
  });

  await normalizeTaskOrderForDate(targetDateKey);
  await rebuildDaySummary(targetDateKey);
}

/**
 * Update an existing task with duplicate prevention.
 * A transaction moves the uniqueness reservation when date/title changes.
 */
export async function updateTaskInCloud(task: TaskItem): Promise<void> {
  const tasksSnap = await getDocs(collection(db, TASKS_COLLECTION));
  const existingTaskDoc = tasksSnap.docs.find(
    (stored) => String(stored.data().taskId || stored.id) === task.id
  );

  if (!existingTaskDoc) {
    throw new Error(`Task ${task.id} no longer exists.`);
  }

  const previousData = existingTaskDoc.data();
  const previousDateKey = normalizeModelDateKey(previousData.scheduledDate);
  const nextDateKey = normalizeModelDateKey(task.taskKey);

  const previousUnique = taskUniqueKeyRef(
    previousData.scheduledDate,
    previousData.title
  );
  const nextUnique = taskUniqueKeyRef(task.taskKey, task.taskOfTheDay);
  const taskRef = existingTaskDoc.ref;

  await runTransaction(db, async (transaction) => {
    const keysChanged = previousUnique.ref.path !== nextUnique.ref.path;
    const [nextUniqueSnapshot, previousUniqueSnapshot] = await Promise.all([
      transaction.get(nextUnique.ref),
      keysChanged ? transaction.get(previousUnique.ref) : Promise.resolve(null),
    ]);

    if (nextUniqueSnapshot.exists()) {
      const ownerTaskId = String(nextUniqueSnapshot.data().taskId || '');
      if (ownerTaskId && ownerTaskId !== task.id) {
        throw new Error(
          `Another task named "${task.taskOfTheDay}" already exists for this date.`
        );
      }
    }

    transaction.set(taskRef, taskStoragePayload(task), { merge: true });
    transaction.set(nextUnique.ref, {
      logicalKey: nextUnique.logicalKey,
      taskId: task.id,
      scheduledDate: nextDateKey,
      normalizedTitle: normalizedTaskTitleKey(task.taskOfTheDay),
      updatedAt: new Date().toISOString(),
    });

    if (
      keysChanged &&
      previousUniqueSnapshot?.exists() &&
      String(previousUniqueSnapshot.data().taskId || '') === task.id
    ) {
      transaction.delete(previousUnique.ref);
    }
  });

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
    (taskDoc) => String(taskDoc.data().taskId || taskDoc.id) === taskId
  );

  if (!existing) {
    return;
  }

  const data = existing.data();
  const dateKey = normalizeModelDateKey(data.scheduledDate);
  const unique = taskUniqueKeyRef(data.scheduledDate, data.title);

  await runTransaction(db, async (transaction) => {
    const uniqueSnapshot = await transaction.get(unique.ref);
    transaction.delete(existing.ref);

    if (
      uniqueSnapshot.exists() &&
      String(uniqueSnapshot.data().taskId || '') === taskId
    ) {
      transaction.delete(unique.ref);
    }
  });

  if (dateKey) {
    await normalizeTaskOrderForDate(dateKey);
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
        inactivePeriods: normalizeInactivePeriods(data.inactivePeriods),
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
    const habitRef = doc(db, HABITS_COLLECTION, habit.id);
    const [previousHabitSnapshot, previousCompletedDates] = await Promise.all([
      getDoc(habitRef),
      getCompletedHabitDates(habit.id),
    ]);

    const previousHabit = previousHabitSnapshot.exists()
      ? (previousHabitSnapshot.data() as Record<string, unknown>)
      : null;
    const habitForStorage = applyHabitActivationTransition(previousHabit, habit);
    const scheduleChanged = habitScheduleChanged(previousHabit, habitForStorage);

    await setDoc(habitRef, habitStoragePayload(habitForStorage), { merge: true });
    await syncHabitLogsFromHabit(habitForStorage);

    if (scheduleChanged) {
      // Repeat-day/active-date changes can affect many historical Day rows.
      await rebuildAllDaySummaries();
      return;
    }

    // Normal Habit Tracker check/uncheck: recalculate only the dates whose
    // completion state changed. This keeps Days.habitsDone and
    // Days.habitsCompleted in sync immediately.
    const nextCompletedDates = new Set(
      (habitForStorage.checkIns || [])
        .map((value) => normalizeModelDateKey(value))
        .filter(Boolean)
    );
    const changedDates = symmetricDifferenceDates(
      previousCompletedDates,
      nextCompletedDates
    );

    for (const dateKey of changedDates) {
      await rebuildDaySummary(dateKey);
    }
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

