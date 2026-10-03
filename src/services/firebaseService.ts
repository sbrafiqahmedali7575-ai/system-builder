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
} from './desktopFirestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { recordFirestoreWrite } from './firestoreWriteDiagnostics';
import { DailyRecord, HabitItem, TaskItem } from '../types';
import { INITIAL_RECORDS, INITIAL_TASKS } from '../data/initialData';
import { standardizeDate } from '../utils/dateUtils';
import {
  CONFIGURED_TIMEZONE,
  getIsoDateKeyInTimezone,
} from '../utils/taskDateUtils';

export const db = getFirestore();
export const auth = { currentUser: null };

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

let quotaExhaustedMemory = false;

export function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false;
  const anyErr = error as any;
  if (anyErr?.code === 'resource-exhausted') return true;
  const msg = String(anyErr?.message || anyErr || '').toLowerCase();
  return (
    msg.includes('quota limit exceeded') ||
    msg.includes('quota exceeded') ||
    msg.includes('resource-exhausted')
  );
}

export function isFirestoreWriteQuotaExhausted(): boolean {
  if (quotaExhaustedMemory) return true;
  if (typeof sessionStorage !== 'undefined') {
    return sessionStorage.getItem('FIRESTORE_WRITE_QUOTA_EXHAUSTED') === 'true';
  }
  return false;
}

export function markFirestoreWriteQuotaExhausted(): void {
  if (quotaExhaustedMemory) return;
  quotaExhaustedMemory = true;
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('FIRESTORE_WRITE_QUOTA_EXHAUSTED', 'true');
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('system-builder:quota-exceeded'));
  }
}

function assertFirestoreWritesAvailable(): void {
  if (!isFirestoreWriteQuotaExhausted()) return;
  const error = new Error('Firestore writes are temporarily paused because the daily write quota is exhausted.');
  (error as Error & { code?: string }).code = 'resource-exhausted';
  throw error;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  if (isQuotaExceededError(error)) {
    markFirestoreWriteQuotaExhausted();
  }
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
    sortOrder: Number.isInteger(task.taskOrder) && Number(task.taskOrder) > 0
      ? Number(task.taskOrder)
      : 1,
    notes: task.notes || '',
    EstimationTime: task.EstimationTime ?? task.timeEstimate ?? '',
    ActualTime: task.ActualTime ?? '',
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

function habitLogDocumentId(habitId: string, dateKey: string): string {
  return `${habitId}_${dateKey}`;
}

function firestoreValueEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => firestoreValueEqual(value, b[index]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const aa = a as Record<string, unknown>;
    const bb = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(aa), ...Object.keys(bb)]);
    return [...keys].every((key) => firestoreValueEqual(aa[key], bb[key]));
  }
  return a === b;
}

function storedFieldsMatch(
  stored: Record<string, unknown>,
  desired: Record<string, unknown>
): boolean {
  return Object.entries(desired).every(([key, value]) =>
    firestoreValueEqual(stored[key], value)
  );
}

async function commitBatchedMutations(
  writes: Array<{
    ref: DocumentReference<DocumentData>;
    data?: Record<string, unknown>;
    delete?: boolean;
  }>
): Promise<void> {
  if (isFirestoreWriteQuotaExhausted()) return;
  for (let index = 0; index < writes.length; index += 400) {
    const batch = writeBatch(db);
    writes.slice(index, index + 400).forEach((write) => {
      if (write.delete) {
        batch.delete(write.ref);
      } else {
        batch.set(write.ref, write.data || {}, { merge: true });
      }
    });
    try {
      await batch.commit();
      recordFirestoreWrite('Firestore.batchMutation', 'mixed', 'batch', writes.slice(index, index + 400).length);
    } catch (err: unknown) {
      if (isQuotaExceededError(err)) {
        markFirestoreWriteQuotaExhausted();
        console.warn('Firestore write quota limit reached during batch commit.');
        return;
      }
      throw err;
    }
  }
}

async function syncHabitLogsFromHabit(habit: HabitItem): Promise<void> {
  // Pausing preserves all existing history, including today, and creates no rows.
  if (habit.isActive === false) return;
  // Enforce one row per (habitId, dateKey) before applying today's state.
  // This also repairs duplicate historical rows left by older clients.
  await deduplicateHabitLogsForAllDates();
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
    recordFirestoreWrite('HabitTracker.syncTodayLog', HABIT_LOGS_COLLECTION, 'create');
    return;
  }

  // Existing today's row is updated in place; no additional row is created.
  const primary = todayLogs.find((logDoc) =>
    /^HL\d+$/i.test(String(logDoc.data().habitLogId || logDoc.id))
  ) || todayLogs[0];

  const desiredLog = {
    habitLogId: String(primary.data().habitLogId || primary.id),
    habitId: habit.id,
    dateKey: today,
    Iscompleted: checkedToday,
  };
  if (!storedFieldsMatch(primary.data() as Record<string, unknown>, desiredLog)) {
    await setDoc(primary.ref, desiredLog, { merge: true });
    recordFirestoreWrite('HabitTracker.syncTodayLog', HABIT_LOGS_COLLECTION, 'update');
  }

  // Remove duplicate rows for the same habit/today.
  const duplicates = todayLogs.filter((logDoc) => logDoc.id !== primary.id);
  if (duplicates.length > 0) {
    const batch = writeBatch(db);
    duplicates.forEach((logDoc) => batch.delete(logDoc.ref));
    await batch.commit();
    recordFirestoreWrite('HabitTracker.removeDuplicateLogs', HABIT_LOGS_COLLECTION, 'delete', duplicates.length);
  }
}

async function deduplicateHabitLogsForAllDates(): Promise<void> {
  const snapshot = await getDocs(collection(db, HABIT_LOGS_COLLECTION));
  const groups = new Map<string, Array<typeof snapshot.docs[number]>>();

  snapshot.docs.forEach((logDoc) => {
    const data = logDoc.data();
    const habitId = String(data.habitId || '').trim();
    const dateKey = normalizeModelDateKey(data.dateKey);
    if (!habitId || !dateKey) return;
    const key = `${habitId}::${dateKey}`;
    groups.set(key, [...(groups.get(key) || []), logDoc]);
  });

  const writes: Array<{
    ref: DocumentReference<DocumentData>;
    data?: Record<string, unknown>;
    delete?: boolean;
  }> = [];

  groups.forEach((logs) => {
    if (logs.length <= 1) return;
    const sorted = [...logs].sort((a, b) => {
      const aId = String(a.data().habitLogId || a.id);
      const bId = String(b.data().habitLogId || b.id);
      return aId.localeCompare(bId, undefined, { numeric: true });
    });
    const primary = sorted[0];
    const primaryData = primary.data();
    writes.push({
      ref: primary.ref,
      data: {
        habitLogId: String(primaryData.habitLogId || primary.id),
        habitId: String(primaryData.habitId || '').trim(),
        dateKey: normalizeModelDateKey(primaryData.dateKey),
        Iscompleted: sorted.some((logDoc) => logDoc.data().Iscompleted === true),
      },
    });
    sorted.slice(1).forEach((duplicate) =>
      writes.push({ ref: duplicate.ref, delete: true })
    );
  });

  if (writes.length > 0) await commitBatchedMutations(writes);

  // Safety rule: never renumber surviving HabitLogs during normal runtime.
  // IDs are immutable once created. Deduplication may merge completion state
  // into the retained row and delete only true duplicates for the same
  // (habitId, dateKey). This avoids copy/delete/recreate data-loss windows.

}

async function ensureCurrentDayHabitLogs(): Promise<void> {
  await deduplicateHabitLogsForAllDates();
  const [habitsSnapshot, logsSnapshot] = await Promise.all([
    getDocs(collection(db, HABITS_COLLECTION)),
    getDocs(collection(db, HABIT_LOGS_COLLECTION)),
  ]);
  const today = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
  const existingToday = new Set<string>();
  let highestNumber = 0;

  logsSnapshot.docs.forEach((logDoc) => {
    const data = logDoc.data();
    const storedId = String(data.habitLogId || logDoc.id);
    const match = /^HL(\d+)$/i.exec(storedId);
    if (match) highestNumber = Math.max(highestNumber, Number(match[1]));

    if (normalizeModelDateKey(data.dateKey) === today) {
      const habitId = String(data.habitId || '').trim();
      if (habitId) existingToday.add(habitId);
    }
  });

  const dueHabitIds = habitsSnapshot.docs
    .map((habitDoc) => {
      const data = habitDoc.data() as Record<string, unknown>;
      return {
        data,
        habitId: String(data.habitId || habitDoc.id).trim(),
      };
    })
    .filter(({ data, habitId }) =>
      Boolean(habitId) &&
      !existingToday.has(habitId) &&
      data.isActive !== false &&
      storedHabitIsDue(data, today)
    )
    .map(({ habitId }) => habitId);

  let candidateNumber = highestNumber + 1;
  for (const habitId of dueHabitIds) {
    let created = false;
    while (!created) {
      const habitLogId = `HL${candidateNumber++}`;
      const logRef = doc(db, HABIT_LOGS_COLLECTION, habitLogId);

      created = await runTransaction(db, async (transaction) => {
        const candidate = await transaction.get(logRef);
        if (candidate.exists()) return false;

        transaction.set(logRef, {
          habitLogId,
          habitId,
          dateKey: today,
          Iscompleted: false,
        });
        return true;
      });
    }
  }

  // A second client can legitimately reserve a different HL ID for the same
  // habit/date at the same instant. Merge only that proven duplicate pair;
  // surviving IDs are never renumbered.
  if (dueHabitIds.length > 0) await deduplicateHabitLogsForAllDates();
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
  const today = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
  if (!normalizedDateKey || normalizedDateKey !== today) return;

  // Current-day creation uses sequential HL IDs and the same uniqueness repair
  // as check-in writes. Never create a second row for an existing habit/day.
  await ensureCurrentDayHabitLogs();
}

export async function rebuildDaySummary(dateKey: string): Promise<void> {
  if (isFirestoreWriteQuotaExhausted()) return;
  const normalizedDateKey = normalizeModelDateKey(dateKey);
  if (!normalizedDateKey) return;

  dateKey = normalizedDateKey;
  // HabitLog creation remains current-day only, but Days summaries must be
  // rebuildable for every historical date affected by task edits/moves/deletes.
  const today = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
  if (dateKey === today) {
    try {
      await ensureHabitLogsForDate(dateKey);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('quota') || msg.includes('resource-exhausted')) {
        console.warn('Firestore write quota limit reached during ensureHabitLogsForDate.');
      } else {
        throw err;
      }
    }
  }

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
  const taskCompletionRate = tasksCompleted;
  const habitCompletionRate = habitsCompleted;
  const DayCompletion =
    Math.round((taskCompletionRate * 0.67 + habitCompletionRate * 0.33) * 10) / 10;

  try {
    const dayRef = doc(db, DAYS_COLLECTION, dateKey);
    const existingDay = await getDoc(dayRef);
    const desiredDay = {
      dateKey,
      tasksCompleted: tasksDone,
      taskTotal: tasks,
      taskCompletionRate,
      habitsCompleted: habitsDone,
      habitTotal: Habits,
      habitCompletionRate,
      DayCompletion,
      IsdayCompleted: DayCompletion >= 80,
    };
    const existingData = existingDay.exists()
      ? (existingDay.data() as Record<string, unknown>)
      : null;
    const hasLegacyFields = Boolean(
      existingData &&
      ['tasksDone', 'tasks', 'habitsDone', 'Habits', 'dayCompleted'].some((key) => key in existingData)
    );
    if (!existingData || !storedFieldsMatch(existingData, desiredDay) || hasLegacyFields) {
      await setDoc(dayRef, {
        ...desiredDay,
        tasksDone: deleteField(),
        tasks: deleteField(),
        habitsDone: deleteField(),
        Habits: deleteField(),
        dayCompleted: deleteField(),
      }, { merge: true });
      recordFirestoreWrite('Days.rebuildSummary', DAYS_COLLECTION, existingData ? 'update' : 'create');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('quota') || msg.includes('resource-exhausted')) {
      console.warn('Firestore write quota limit reached during rebuildDaySummary.');
      return;
    }
    throw err;
  }

  // Keep dateKey as the single canonical Days document ID. Remove any
  // duplicate document whose stored dateKey represents today's same date.
  const daysSnapshot = await getDocs(collection(db, DAYS_COLLECTION));
  const duplicateDeletes: Array<{ ref: DocumentReference<DocumentData>; delete: true }> = [];
  daysSnapshot.docs.forEach((dayDoc) => {
    if (dayDoc.id === dateKey) return;
    const storedDateKey = normalizeModelDateKey(dayDoc.data().dateKey || dayDoc.id);
    if (storedDateKey === dateKey) {
      duplicateDeletes.push({ ref: dayDoc.ref, delete: true });
    }
  });
  if (duplicateDeletes.length > 0) await commitBatchedMutations(duplicateDeletes);
}

export async function initializeDayHabitStatus(dateKey: string): Promise<void> {
  if (isFirestoreWriteQuotaExhausted()) return;
  const normalizedDateKey = normalizeModelDateKey(dateKey);
  if (!normalizedDateKey) return;
  // rebuildDaySummary already ensures today's HabitLogs.
  try {
    await rebuildDaySummary(normalizedDateKey);
  } catch (err: unknown) {
    if (isQuotaExceededError(err)) {
      markFirestoreWriteQuotaExhausted();
      console.warn('Firestore write quota limit reached during initializeDayHabitStatus.');
      return;
    }
    throw err;
  }
}

async function rebuildAllDaySummaries(): Promise<void> {
  const today = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
  await rebuildDaySummary(today);
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
  assertFirestoreWritesAvailable();
  await setDoc(doc(db, COUNTDOWNS_COLLECTION, COUNTDOWN_SETTINGS_DOC), {
    countdownId: COUNTDOWN_SETTINGS_DOC,
    title: settings.reason || 'Countdown',
    targetDate: settings.targetDate,
    isActive: Boolean(settings.targetDate),
  });
  recordFirestoreWrite('Countdown.save', COUNTDOWNS_COLLECTION, 'update');
}

/**
 * Subscribe to real-time updates from Firestore.
 * Automatically initializes initial sample data if the collection is empty.
 */

export type CanonicalCollectionName = 'users' | 'days' | 'tasks' | 'habits' | 'habitLogs' | 'countdowns';
export type CanonicalDataRow = { id: string; [key: string]: unknown };

const CANONICAL_IMPORT_PRIMARY_KEYS: Record<CanonicalCollectionName, string> = {
  users: 'userId',
  days: 'dateKey',
  tasks: 'taskId',
  habits: 'habitId',
  habitLogs: 'habitLogId',
  countdowns: 'countdownId',
};

function normalizeCanonicalImportDate(
  value: unknown,
  field: string,
  required = true
): string {
  const raw = String(value ?? '').trim();
  if (!raw && !required) return '';
  const normalized = normalizeModelDateKey(raw);
  if (!normalized) {
    throw new Error(`${field} must be a valid date.`);
  }
  return normalized;
}

function buildCanonicalImportWrite(
  collectionName: CanonicalCollectionName,
  row: CanonicalDataRow
): {
  ref: DocumentReference<DocumentData>;
  data: Record<string, unknown>;
  dateKey?: string;
} {
  const primaryKey = CANONICAL_IMPORT_PRIMARY_KEYS[collectionName];
  const rawPrimaryValue = String(row[primaryKey] ?? row.id ?? '').trim();
  if (!rawPrimaryValue) {
    throw new Error(`Missing required ${primaryKey}.`);
  }
  if (rawPrimaryValue.includes('/')) {
    throw new Error(`${primaryKey} cannot contain "/".`);
  }

  const payload = Object.fromEntries(
    Object.entries(row).filter(
      ([key, value]) => key !== 'id' && value !== undefined
    )
  ) as Record<string, unknown>;

  let documentId = rawPrimaryValue;
  let affectedDateKey: string | undefined;

  if (collectionName === 'days') {
    documentId = normalizeCanonicalImportDate(rawPrimaryValue, 'dateKey');
    payload.dateKey = documentId;
  } else {
    payload[primaryKey] = rawPrimaryValue;
  }

  if (collectionName === 'tasks') {
    const scheduledDate = normalizeCanonicalImportDate(
      payload.scheduledDate,
      'scheduledDate'
    );
    payload.scheduledDate = scheduledDate;
    affectedDateKey = scheduledDate;
    if (payload.taskOrder !== undefined) {
      const taskOrder = Number(payload.taskOrder);
      if (!Number.isInteger(taskOrder) || taskOrder < 1) {
        throw new Error('taskOrder must be a positive whole number.');
      }
      payload.sortOrder = taskOrder;
      delete payload.taskOrder;
    }
  }

  if (collectionName === 'habitLogs') {
    const dateKey = normalizeCanonicalImportDate(payload.dateKey, 'dateKey');
    payload.dateKey = dateKey;
    affectedDateKey = dateKey;
  }

  if (collectionName === 'habits' && payload.activeFrom) {
    payload.activeFrom = normalizeCanonicalImportDate(
      payload.activeFrom,
      'activeFrom'
    );
  }

  if (collectionName === 'countdowns' && payload.targetDate) {
    payload.targetDate = normalizeCanonicalImportDate(
      payload.targetDate,
      'targetDate'
    );
  }

  return {
    ref: doc(db, collectionName, documentId),
    data: payload,
    dateKey: affectedDateKey,
  };
}

export async function importCanonicalDataRows(
  collectionName: CanonicalCollectionName,
  rows: CanonicalDataRow[]
): Promise<{ imported: number }> {
  assertFirestoreWritesAvailable();
  if (rows.length === 0) return { imported: 0 };

  const writes = rows.map((row, index) => {
    try {
      return buildCanonicalImportWrite(collectionName, row);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Row ${index + 1}: ${message}`);
    }
  });

  await commitBatchedMutations(
    writes.map(({ ref, data }) => ({ ref, data }))
  );

  const affectedDates = [...new Set(
    writes.map((write) => write.dateKey).filter((value): value is string => Boolean(value))
  )];

  if (collectionName === 'tasks') {
    for (const dateKey of affectedDates) {
      await normalizeTaskOrderForDate(dateKey);
      await rebuildDaySummary(dateKey);
    }
  } else if (collectionName === 'habitLogs') {
    await deduplicateHabitLogsForAllDates();
    for (const dateKey of affectedDates) {
      await rebuildDaySummary(dateKey);
    }
  } else if (collectionName === 'habits') {
    await rebuildAllDaySummaries();
  }

  return { imported: rows.length };
}

export function subscribeToCanonicalData(
  onUpdate: (data: Record<CanonicalCollectionName, CanonicalDataRow[]>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const names: CanonicalCollectionName[] = ['users', 'days', 'tasks', 'habits', 'habitLogs', 'countdowns'];
  const state = Object.fromEntries(names.map((name) => [name, []])) as Record<CanonicalCollectionName, CanonicalDataRow[]>;
  const unsubs = names.map((name) => onSnapshot(
    collection(db, name),
    (snapshot) => {
      const rows: CanonicalDataRow[] = snapshot.docs.map((d) => {
        const row: CanonicalDataRow = {
          id: d.id,
          ...(d.data() as Record<string, unknown>),
        };
        if (name === 'days') {
          const taskRate = Number(row.taskCompletionRate ?? 0);
          const habitRate = Number(row.habitCompletionRate ?? 0);
          row.DayCompletion =
            Math.round((taskRate * 0.67 + habitRate * 0.33) * 10) / 10;
        }
        return row;
      });
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
        isCompleted: Math.round((Number(data.taskCompletionRate ?? 0) * 0.67 + Number(data.habitCompletionRate ?? 0) * 0.33) * 10) / 10 >= 80,
        result: Math.round((Number(data.taskCompletionRate ?? 0) * 0.67 + Number(data.habitCompletionRate ?? 0) * 0.33) * 10) / 10 >= 80 ? 'TRUE' : 'FALSE',
        change: 0,
        skill: 'Daily Review',
        summary: `${Number(data.tasksCompleted ?? data.tasksDone ?? 0)}/${Number(data.taskTotal ?? data.tasks ?? 0)} tasks • ${Number(data.habitsCompleted ?? data.habitsDone ?? 0)}/${Number(data.habitTotal ?? data.Habits ?? 0)} habits`,
        notes: '',
        dayCompletion:
          Math.round((Number(data.taskCompletionRate ?? 0) * 0.67 + Number(data.habitCompletionRate ?? 0) * 0.33) * 10) / 10,
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
  assertFirestoreWritesAvailable();
  const dateKey = normalizeModelDateKey(record.date);
  if (dateKey) await rebuildDaySummary(dateKey);
}

export async function updateRecordInCloud(record: DailyRecord): Promise<void> {
  assertFirestoreWritesAvailable();
  const dateKey = normalizeModelDateKey(record.date);
  if (dateKey) await rebuildDaySummary(dateKey);
}

export async function deleteRecordFromCloud(recordId: string): Promise<void> {
  assertFirestoreWritesAvailable();
  const dateKey = normalizeModelDateKey(recordId);
  if (dateKey) await deleteDoc(doc(db, DAYS_COLLECTION, dateKey));
}

export async function bulkAddRecordsToCloud(records: DailyRecord[]): Promise<void> {
  assertFirestoreWritesAvailable();
  for (const record of records) {
    const dateKey = normalizeModelDateKey(record.date);
    if (dateKey) await rebuildDaySummary(dateKey);
  }
}

export async function resetRecordsInCloud(_initialRecords: DailyRecord[]): Promise<void> {
  assertFirestoreWritesAvailable();
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
    (snapshot) => {
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
          timeEstimate: data.EstimationTime ? String(data.EstimationTime) : (data.timeEstimate ? String(data.timeEstimate) : ''),
          EstimationTime: data.EstimationTime ? String(data.EstimationTime) : (data.timeEstimate ? String(data.timeEstimate) : ''),
          ActualTime: data.ActualTime ? String(data.ActualTime) : '',
          category: data.category ? String(data.category) : '',
          notes: data.notes ? String(data.notes) : '',
          updatedAt: data.updatedAt ? String(data.updatedAt) : '',
          completedAt: data.completedAt ? String(data.completedAt) : undefined,
          matrixQuadrant: storedQuadrantToMatrix(data.quadrant),
          taskOrder:
            Number.isInteger(Number(data.sortOrder ?? data.taskOrder)) && Number(data.sortOrder ?? data.taskOrder) > 0
              ? Number(data.sortOrder ?? data.taskOrder)
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

      // Normalize taskOrder in memory only. Subscriptions are deliberately read-only;
      // persistence normalization happens in explicit task mutations/migrations.
      const taskById = new Map(visibleTasks.map((task) => [task.id, task]));
      const byDate = new Map<string, typeof snapshot.docs>();
      snapshot.docs.forEach((taskDoc) => {
        const dateKey = normalizeModelDateKey(taskDoc.data().scheduledDate);
        if (!dateKey) return;
        const group = byDate.get(dateKey) || [];
        group.push(taskDoc);
        byDate.set(dateKey, group);
      });
      byDate.forEach((taskDocs) => {
        taskDocs.sort((left, right) => {
          const leftId = String(left.data().taskId || left.id);
          const rightId = String(right.data().taskId || right.id);
          return leftId.localeCompare(rightId, undefined, { numeric: true, sensitivity: 'base' });
        });
        taskDocs.forEach((taskDoc, index) => {
          const taskId = String(taskDoc.data().taskId || taskDoc.id);
          const loadedTask = taskById.get(taskId);
          if (loadedTask) loadedTask.taskOrder = index + 1;
        });
      });

      // Newest scheduledDate first; taskId DESC inside the same date.
      visibleTasks.sort((a, b) => {
        const dateComparison = (b.taskKey || '').localeCompare(a.taskKey || '');
        if (dateComparison !== 0) return dateComparison;
        return b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' });
      });
      onUpdate(visibleTasks);

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
  assertFirestoreWritesAvailable();
  const batch = writeBatch(db);
  for (const t of tasks) {
    const docRef = doc(db, TASKS_COLLECTION, t.id);
    batch.set(docRef, taskStoragePayload(t));
  }
  await batch.commit();
  recordFirestoreWrite('Tasks.seed', TASKS_COLLECTION, 'batch', tasks.length);
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
    const data = d.data();
    const expectedOrder = index + 1;
    if (Number(data.sortOrder ?? data.taskOrder) !== expectedOrder || data.taskOrder !== undefined) {
      batch.set(d.ref, { sortOrder: expectedOrder, taskOrder: deleteField() }, { merge: true });
    }
  });
  // Commit only when at least one document actually needs repair.
  const needsWrite = matching.some((d, index) => {
    const data = d.data();
    return Number(data.sortOrder ?? data.taskOrder) !== index + 1 || data.taskOrder !== undefined;
  });
  if (needsWrite) {
    await batch.commit();
    recordFirestoreWrite('Tasks.normalizeOrder', TASKS_COLLECTION, 'batch', matching.filter((d, index) => { const data = d.data(); return Number(data.sortOrder ?? data.taskOrder) !== index + 1 || data.taskOrder !== undefined; }).length);
  }
}

/**
 * Add a new task with duplicate prevention on the same date
 */
export async function addTaskToCloud(task: TaskItem): Promise<void> {
  assertFirestoreWritesAvailable();
  const tasksSnap = await getDocs(collection(db, TASKS_COLLECTION));
  const existingTasks = tasksSnap.docs.map((d) => d.data());
  const targetDateKey = normalizeModelDateKey(task.taskKey);
  const logicalKey = taskLogicalKey(task.taskKey, task.taskOfTheDay);
  const taskRef = doc(db, TASKS_COLLECTION, task.id);

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
    const taskSnapshot = await transaction.get(taskRef);
    if (taskSnapshot.exists()) {
      throw new Error(`Duplicate task rejected: A task with ID ${task.id} already exists.`);
    }
    transaction.set(taskRef, {
      ...taskStoragePayload(task),
      sortOrder: sameDateCount + 1,
    });
  });
  recordFirestoreWrite('TaskTracker.addTask', TASKS_COLLECTION, 'transaction');

  await normalizeTaskOrderForDate(targetDateKey);
  if (targetDateKey) await rebuildDaySummary(targetDateKey);
}

/**
 * Update an existing task with same-date/title duplicate prevention.
 */
export async function updateTaskInCloud(task: TaskItem): Promise<void> {
  assertFirestoreWritesAvailable();
  const tasksSnap = await getDocs(collection(db, TASKS_COLLECTION));
  const existingTaskDoc = tasksSnap.docs.find(
    (stored) => String(stored.data().taskId || stored.id) === task.id
  );
  if (!existingTaskDoc) throw new Error(`Task ${task.id} no longer exists.`);

  const previousDateKey = normalizeModelDateKey(existingTaskDoc.data().scheduledDate);
  const nextDateKey = normalizeModelDateKey(task.taskKey);
  const nextLogicalKey = taskLogicalKey(task.taskKey, task.taskOfTheDay);
  const duplicate = tasksSnap.docs.find(
    (stored) =>
      stored.id !== existingTaskDoc.id &&
      String(stored.data().taskId || stored.id) !== task.id &&
      taskLogicalKey(stored.data().scheduledDate, stored.data().title) === nextLogicalKey
  );
  if (duplicate) {
    throw new Error(`Another task named "${task.taskOfTheDay}" already exists for this date.`);
  }

  await setDoc(existingTaskDoc.ref, taskStoragePayload(task), { merge: true });
  recordFirestoreWrite('TaskTracker.updateTask', TASKS_COLLECTION, 'update');
  await normalizeTaskOrderForDate(nextDateKey);

  if (nextDateKey) await rebuildDaySummary(nextDateKey);

  if (previousDateKey && previousDateKey !== nextDateKey) {
    await normalizeTaskOrderForDate(previousDateKey);
    await rebuildDaySummary(previousDateKey);
  }
}

/**
 * Delete a task
 */
export async function deleteTaskFromCloud(taskId: string): Promise<void> {
  assertFirestoreWritesAvailable();
  const snapshot = await getDocs(collection(db, TASKS_COLLECTION));
  const existing = snapshot.docs.find(
    (taskDoc) => String(taskDoc.data().taskId || taskDoc.id) === taskId
  );
  if (!existing) return;

  const dateKey = normalizeModelDateKey(existing.data().scheduledDate);
  await deleteDoc(existing.ref);
  recordFirestoreWrite('TaskTracker.deleteTask', TASKS_COLLECTION, 'delete');

  if (dateKey) {
    await normalizeTaskOrderForDate(dateKey);
    await rebuildDaySummary(dateKey);
  }
}

/**
 * Reset tasks to initial set
 */
export async function resetTasksInCloud(initialTasks: TaskItem[]): Promise<void> {
  assertFirestoreWritesAvailable();
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
    // Do not emit until both streams have delivered their initial snapshot.
    // Otherwise habits briefly render with empty checkIns before HabitLogs load.
    if (!habitsSnapshot || !habitLogsSnapshot) return;

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
  assertFirestoreWritesAvailable();
  try {
    const normalizedName = habit.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    if (!normalizedName) throw new Error('Habit name cannot be empty.');
    const habitForStorage = applyHabitActivationTransition(null, habit);
    const habitRef = doc(db, HABITS_COLLECTION, habit.id);
    const snapshot = await getDocs(collection(db, HABITS_COLLECTION));
    const duplicateName = snapshot.docs.some((stored) =>
      stored.id !== habit.id &&
      String(stored.data().name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase() === normalizedName
    );
    if (duplicateName) {
      throw new Error(`Duplicate habit rejected: A habit named "${habit.name.trim()}" already exists.`);
    }
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(habitRef);
      if (existing.exists()) {
        throw new Error(`Duplicate habit rejected: Habit ID ${habit.id} already exists.`);
      }
      transaction.set(habitRef, habitStoragePayload(habitForStorage));
    });
    recordFirestoreWrite('HabitTracker.addHabit', HABITS_COLLECTION, 'transaction');
    await syncHabitLogsFromHabit(habitForStorage);
    await rebuildAllDaySummaries();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${HABITS_COLLECTION}/${habit.id}`);
  }
}

export async function setTodayHabitCheckIn(habit: HabitItem, isCompleted: boolean): Promise<void> {
  assertFirestoreWritesAvailable();
  const today = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
  const checkIns = new Set(
    (habit.checkIns || []).map((value) => normalizeModelDateKey(value)).filter(Boolean)
  );
  if (isCompleted) checkIns.add(today);
  else checkIns.delete(today);

  // updateHabitInCloud writes the HabitLog and synchronizes today's Day summary.
  await updateHabitInCloud({ ...habit, checkIns: [...checkIns].sort() });
}

export async function updateHabitInCloud(habit: HabitItem): Promise<void> {
  assertFirestoreWritesAvailable();
  try {
    const habitRef = doc(db, HABITS_COLLECTION, habit.id);
    const [previousHabitSnapshot, previousCompletedDates] = await Promise.all([
      getDoc(habitRef),
      getCompletedHabitDates(habit.id),
    ]);

    const previousHabit = previousHabitSnapshot.exists()
      ? (previousHabitSnapshot.data() as Record<string, unknown>)
      : null;
    const today = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
    const requestedCheckIns = new Set(
      (habit.checkIns || []).map((value) => normalizeModelDateKey(value)).filter(Boolean)
    );
    const todayChecked = requestedCheckIns.has(today);
    const protectedCheckIns = [...previousCompletedDates].filter((dateKey) => dateKey !== today);
    if (todayChecked) protectedCheckIns.push(today);

    // Habit Tracker completion is mutable only for the current date.
    // Historical/future check-in state from the UI cannot be added or removed here.
    const currentDayOnlyHabit = { ...habit, checkIns: protectedCheckIns.sort() };
    const habitForStorage = applyHabitActivationTransition(previousHabit, currentDayOnlyHabit);
    const scheduleChanged = habitScheduleChanged(previousHabit, habitForStorage);

    const desiredHabit = habitStoragePayload(habitForStorage);
    if (!previousHabit || !storedFieldsMatch(previousHabit, desiredHabit)) {
      await setDoc(habitRef, desiredHabit, { merge: true });
      recordFirestoreWrite('HabitTracker.updateHabit', HABITS_COLLECTION, previousHabit ? 'update' : 'create');
    }
    await syncHabitLogsFromHabit(habitForStorage);

    if (scheduleChanged) {
      // Current model maintains only today's derived Day summary.
      await rebuildDaySummary(today);
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

    // rebuildDaySummary is current-day only; avoid repeated no-op calls for
    // protected historical dates.
    if (changedDates.includes(today)) {
      await rebuildDaySummary(today);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${HABITS_COLLECTION}/${habit.id}`);
  }
}

export async function deleteHabitFromCloud(habitId: string): Promise<void> {
  assertFirestoreWritesAvailable();
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
  assertFirestoreWritesAvailable();
  const batch = writeBatch(db);
  for (const t of tasks) {
    batch.set(doc(db, TASKS_COLLECTION, t.id), taskStoragePayload(t));
  }
  await batch.commit();
  await rebuildAllDaySummaries();
}

