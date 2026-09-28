import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  type DocumentReference,
  type WriteBatch,
} from 'firebase/firestore';
import { db } from './firebaseService';
import { MONTH_MAP } from '../utils/dateUtils';
import {
  CONFIGURED_TIMEZONE,
  getIsoDateKeyInTimezone,
} from '../utils/taskDateUtils';

const MIGRATION_BATCH_LIMIT = 400;

export interface DataModelMigrationResult {
  users: number;
  days: number;
  tasks: number;
  habits: number;
  habitLogs: number;
  countdowns: number;
}

type QueuedWrite = {
  ref: DocumentReference;
  data: Record<string, unknown>;
};

function toDateKey(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }

  const named = raw.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{2,4})$/);
  if (named) {
    const monthIndex = MONTH_MAP[named[2].toLowerCase()];
    if (monthIndex !== undefined) {
      const year = named[3].length === 2 ? `20${named[3]}` : named[3];
      return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${named[1].padStart(2, '0')}`;
    }
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCDate()).padStart(2, '0'),
    ].join('-');
  }

  return '';
}

function matrixQuadrantToRoman(value: unknown): 'I' | 'II' | 'III' | 'IV' | null {
  const raw = String(value ?? '').trim();
  if (raw === 'I' || raw === 'urgent-important') return 'I';
  if (raw === 'II' || raw === 'important') return 'II';
  if (raw === 'III' || raw === 'urgent') return 'III';
  if (raw === 'IV' || raw === 'neither') return 'IV';
  return null;
}

function repeatDaysForHabit(data: Record<string, unknown>): number[] {
  const explicit = Array.isArray(data.repeatDays)
    ? data.repeatDays
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    : [];

  if (data.frequency === 'daily') return [0, 1, 2, 3, 4, 5, 6];
  if (data.frequency === 'weekdays') return [1, 2, 3, 4, 5];
  return [...new Set(explicit)];
}

function activeFromForHabit(data: Record<string, unknown>): string {
  const explicit = toDateKey(data.activeFrom);
  if (explicit) return explicit;
  return toDateKey(data.createdAt) || '1970-01-01';
}

function colorToHex(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw.toUpperCase();

  const colors: Record<string, string> = {
    blue: '#3B82F6',
    emerald: '#10B981',
    amber: '#F59E0B',
    rose: '#F43F5E',
    violet: '#8B5CF6',
  };

  return colors[raw] || '#3B82F6';
}

function isHabitDue(data: Record<string, unknown>, dateKey: string): boolean {
  const activeFrom = activeFromForHabit(data);
  if (dateKey < activeFrom) return false;

  const inactivePeriods = Array.isArray(data.inactivePeriods)
    ? data.inactivePeriods
        .map((value) => {
          if (!value || typeof value !== 'object') return null;
          const row = value as Record<string, unknown>;
          const from = toDateKey(row.from);
          const to = row.to ? toDateKey(row.to) : null;
          return from ? { from, to } : null;
        })
        .filter(
          (value): value is { from: string; to: string | null } =>
            Boolean(value)
        )
    : [];

  const inactiveForDate = inactivePeriods.some((period) => {
    if (dateKey < period.from) return false;
    return !period.to || dateKey <= period.to;
  });
  if (inactiveForDate) return false;

  if (data.isActive === false && inactivePeriods.length === 0) return false;

  const skipped = new Set(
    Array.isArray(data.skippedDates) ? data.skippedDates.map((value) => String(value)) : []
  );
  const extras = new Set(
    Array.isArray(data.extraDates) ? data.extraDates.map((value) => String(value)) : []
  );

  if (extras.has(dateKey)) return true;
  if (skipped.has(dateKey)) return false;

  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return false;

  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return repeatDaysForHabit(data).includes(weekday);
}

function roundedRate(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

async function commitQueuedWrites(writes: QueuedWrite[]): Promise<void> {
  let batch: WriteBatch = writeBatch(db);
  let count = 0;

  for (const write of writes) {
    batch.set(write.ref, write.data);
    count += 1;

    if (count >= MIGRATION_BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }
}

/**
 * Migrates the legacy System Builder model into the single-user target model.
 *
 * Safety properties:
 * - Idempotent: safe to run multiple times.
 * - Non-destructive: legacy fields and source collections remain untouched.
 * - Same-ID migration: existing task/habit document IDs are preserved.
 */
function simpleTaskId(index: number): string {
  return `T${index + 1}`;
}

function simpleHabitLogId(index: number): string {
  return `HL${index + 1}`;
}

function isSimpleHabitId(value: string): boolean {
  return /^[1-9]\d*$/.test(value);
}

function isSimpleTaskId(value: string): boolean {
  return /^T[1-9]\d*$/.test(value);
}

function isSimpleHabitLogId(value: string): boolean {
  return /^HL[1-9]\d*$/.test(value);
}

/**
 * Re-keys the canonical collections to compact stable IDs while preserving
 * HabitLogs.habitId -> Habits.habitId. Existing simple IDs are retained.
 */
async function migrateCanonicalIds(): Promise<void> {
  const [tasksSnap, habitsSnap, logsSnap] = await Promise.all([
    getDocs(collection(db, 'tasks')),
    getDocs(collection(db, 'habits')),
    getDocs(collection(db, 'habitLogs')),
  ]);

  const sortedHabits = [...habitsSnap.docs].sort((a, b) => a.id.localeCompare(b.id));
  const habitIdMap = new Map<string, string>();
  const usedHabitIds = new Set(
    sortedHabits.map((d) => String(d.data().habitId || d.id)).filter(isSimpleHabitId)
  );
  let nextHabit = 1;
  for (const d of sortedHabits) {
    const oldId = String(d.data().habitId || d.id);
    if (isSimpleHabitId(oldId)) {
      habitIdMap.set(oldId, oldId);
      habitIdMap.set(d.id, oldId);
      continue;
    }
    while (usedHabitIds.has(String(nextHabit))) nextHabit += 1;
    const newId = String(nextHabit++);
    usedHabitIds.add(newId);
    habitIdMap.set(oldId, newId);
    habitIdMap.set(d.id, newId);
  }

  const sortedTasks = [...tasksSnap.docs].sort((a, b) => {
    const ad = String(a.data().scheduledDate || '');
    const bd = String(b.data().scheduledDate || '');
    return ad.localeCompare(bd) || a.id.localeCompare(b.id);
  });
  const usedTaskIds = new Set(
    sortedTasks.map((d) => String(d.data().taskId || d.id)).filter(isSimpleTaskId)
  );
  const taskIdMap = new Map<string, string>();
  let nextTask = 1;
  for (const d of sortedTasks) {
    const oldId = String(d.data().taskId || d.id);
    if (isSimpleTaskId(oldId)) {
      taskIdMap.set(d.id, oldId);
      continue;
    }
    while (usedTaskIds.has(simpleTaskId(nextTask - 1))) nextTask += 1;
    const newId = simpleTaskId(nextTask - 1);
    nextTask += 1;
    usedTaskIds.add(newId);
    taskIdMap.set(d.id, newId);
  }

  const sortedLogs = [...logsSnap.docs].sort((a, b) => {
    const ad = String(a.data().dateKey || '');
    const bd = String(b.data().dateKey || '');
    return ad.localeCompare(bd) || a.id.localeCompare(b.id);
  });
  const usedLogIds = new Set(
    sortedLogs.map((d) => String(d.data().habitLogId || d.id)).filter(isSimpleHabitLogId)
  );
  const logIdMap = new Map<string, string>();
  let nextLog = 1;
  for (const d of sortedLogs) {
    const oldId = String(d.data().habitLogId || d.id);
    if (isSimpleHabitLogId(oldId)) {
      logIdMap.set(d.id, oldId);
      continue;
    }
    while (usedLogIds.has(simpleHabitLogId(nextLog - 1))) nextLog += 1;
    const newId = simpleHabitLogId(nextLog - 1);
    nextLog += 1;
    usedLogIds.add(newId);
    logIdMap.set(d.id, newId);
  }

  const writes: QueuedWrite[] = [];
  for (const d of sortedHabits) {
    const newId = habitIdMap.get(d.id)!;
    const data = d.data() as Record<string, unknown>;
    writes.push({ ref: doc(db, 'habits', newId), data: { ...data, habitId: newId } });
  }
  for (const d of sortedTasks) {
    const newId = taskIdMap.get(d.id)!;
    const data = d.data() as Record<string, unknown>;
    writes.push({ ref: doc(db, 'tasks', newId), data: { ...data, taskId: newId } });
  }
  for (const d of sortedLogs) {
    const newId = logIdMap.get(d.id)!;
    const data = d.data() as Record<string, unknown>;
    const oldHabitId = String(data.habitId || '');
    const newHabitId = habitIdMap.get(oldHabitId) || oldHabitId;
    writes.push({
      ref: doc(db, 'habitLogs', newId),
      data: { ...data, habitLogId: newId, habitId: newHabitId },
    });
  }

  await commitQueuedWrites(writes);

  // Delete only superseded document keys, after all replacement docs/FKs exist.
  const deletes = [
    ...sortedHabits.filter((d) => habitIdMap.get(d.id) !== d.id).map((d) => d.ref),
    ...sortedTasks.filter((d) => taskIdMap.get(d.id) !== d.id).map((d) => d.ref),
    ...sortedLogs.filter((d) => logIdMap.get(d.id) !== d.id).map((d) => d.ref),
  ];
  for (let i = 0; i < deletes.length; i += MIGRATION_BATCH_LIMIT) {
    const batch = writeBatch(db);
    deletes.slice(i, i + MIGRATION_BATCH_LIMIT).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function cleanupHabitLogsByDateAndHabit(): Promise<void> {
  const snapshot = await getDocs(collection(db, 'habitLogs'));
  const today = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
  const groups = new Map<string, typeof snapshot.docs>();

  snapshot.docs.forEach((logDoc) => {
    const data = logDoc.data();
    const dateKey = toDateKey(data.dateKey);
    const habitId = String(data.habitId || '').trim();
    if (!dateKey || !habitId) return;
    const key = `${dateKey}::${habitId}`;
    const rows = groups.get(key) || [];
    rows.push(logDoc);
    groups.set(key, rows);
  });

  const deletes: DocumentReference[] = [];
  const updates: QueuedWrite[] = [];

  for (const [key, rows] of groups) {
    const [dateKey] = key.split('::');
    if (dateKey > today) {
      rows.forEach((row) => deletes.push(row.ref));
      continue;
    }

    if (rows.length <= 1) continue;
    const survivor = rows.find((row) =>
      /^HL\d+$/i.test(String(row.data().habitLogId || row.id))
    ) || rows[0];
    const completed = rows.some((row) => row.data().Iscompleted === true);
    updates.push({
      ref: survivor.ref,
      data: { Iscompleted: completed },
    });
    rows
      .filter((row) => row.id !== survivor.id)
      .forEach((row) => deletes.push(row.ref));
  }

  await commitQueuedWrites(updates);
  for (let index = 0; index < deletes.length; index += MIGRATION_BATCH_LIMIT) {
    const batch = writeBatch(db);
    deletes.slice(index, index + MIGRATION_BATCH_LIMIT).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

export async function repairCanonicalHabitLogsAndDays(): Promise<void> {
  const [
    recordsSnap,
    tasksSnap,
    habitsSnap,
    logsSnap,
    daysSnap,
  ] = await Promise.all([
    getDocs(collection(db, 'records')),
    getDocs(collection(db, 'tasks')),
    getDocs(collection(db, 'habits')),
    getDocs(collection(db, 'habitLogs')),
    getDocs(collection(db, 'days')),
  ]);

  const today = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
  const dateKeys = new Set<string>();

  const addHistoricalDate = (value: unknown) => {
    const dateKey = toDateKey(value);
    if (dateKey && dateKey <= today) dateKeys.add(dateKey);
  };

  recordsSnap.forEach((recordDoc) => addHistoricalDate(recordDoc.data().date));
  tasksSnap.forEach((taskDoc) =>
    addHistoricalDate(taskDoc.data().scheduledDate || taskDoc.data().taskKey)
  );
  daysSnap.forEach((dayDoc) =>
    addHistoricalDate(dayDoc.data().dateKey || dayDoc.id)
  );
  logsSnap.forEach((logDoc) => addHistoricalDate(logDoc.data().dateKey));

  // Never manufacture HabitLogs for missing/future dates here. Existing
  // HabitLogs are canonicalized to HL1, HL2... by migrateCanonicalIds().
  // Re-read canonical logs after deduplication and rebuild every historical
  // Day that has system history.
  const canonicalLogsSnap = await getDocs(collection(db, 'habitLogs'));
  const completedByDate = new Map<string, Set<string>>();

  canonicalLogsSnap.forEach((logDoc) => {
    const data = logDoc.data();
    if (data.Iscompleted !== true) return;

    const dateKey = toDateKey(data.dateKey);
    const habitId = String(data.habitId || '');
    if (!dateKey || !habitId || dateKey > today) return;

    if (!completedByDate.has(dateKey)) {
      completedByDate.set(dateKey, new Set());
    }
    completedByDate.get(dateKey)!.add(habitId);
  });

  const normalizedTasks = tasksSnap.docs.map((taskDoc) => {
    const data = taskDoc.data();
    return {
      scheduledDate: toDateKey(data.scheduledDate || data.taskKey),
      Iscompleted:
        typeof data.Iscompleted === 'boolean'
          ? data.Iscompleted
          : Boolean(data.isCompleted),
    };
  });

  const normalizedHabits = habitsSnap.docs.map((habitDoc) => ({
    id: String(habitDoc.data().habitId || habitDoc.id),
    data: habitDoc.data() as Record<string, unknown>,
  }));

  const dayWrites: QueuedWrite[] = [];

  for (const dateKey of [...dateKeys].sort()) {
    const dayTasks = normalizedTasks.filter(
      (task) => task.scheduledDate === dateKey
    );
    const tasks = dayTasks.length;
    const tasksDone = dayTasks.filter((task) => task.Iscompleted).length;
    const tasksCompleted = roundedRate(tasksDone, tasks);

    const dueHabits = normalizedHabits.filter((habit) =>
      isHabitDue(habit.data, dateKey)
    );
    const Habits = dueHabits.length;
    const completedHabitIds = completedByDate.get(dateKey) || new Set<string>();
    const habitsDone = dueHabits.filter((habit) =>
      completedHabitIds.has(habit.id)
    ).length;
    const habitsCompleted = roundedRate(habitsDone, Habits);
    const dayCompleted = Math.round(tasksCompleted * 0.8 + habitsCompleted * 0.2);

    dayWrites.push({
      ref: doc(db, 'days', dateKey),
      data: {
        dateKey,
        tasksDone,
        tasks,
        tasksCompleted,
        habitsDone,
        Habits,
        habitsCompleted,
        dayCompleted,
        IsdayCompleted: dayCompleted >= 80,
      },
    });
  }

  await commitQueuedWrites(dayWrites);
}

function taskUniqueKeyDocumentId(logicalKey: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of logicalKey) {
    hash ^= BigInt(character.codePointAt(0) || 0);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

async function rebuildTaskUniqueKeys(): Promise<void> {
  const [tasksSnap, uniqueKeysSnap] = await Promise.all([
    getDocs(collection(db, 'tasks')),
    getDocs(collection(db, 'taskUniqueKeys')),
  ]);

  // Remove stale reservations first. The task collection is canonical after
  // deduplication, so rebuilding from scratch is safer than trying to repair
  // old reservations individually.
  for (let i = 0; i < uniqueKeysSnap.docs.length; i += MIGRATION_BATCH_LIMIT) {
    const batch = writeBatch(db);
    uniqueKeysSnap.docs
      .slice(i, i + MIGRATION_BATCH_LIMIT)
      .forEach((keyDoc) => batch.delete(keyDoc.ref));
    await batch.commit();
  }

  const writes: QueuedWrite[] = [];
  const seenDocumentIds = new Map<string, string>();

  tasksSnap.docs.forEach((taskDoc) => {
    const data = taskDoc.data() as Record<string, unknown>;
    const scheduledDate = toDateKey(data.scheduledDate || data.taskKey);
    const normalizedTitle = normalizedTaskTitleKey(data.title || data.taskOfTheDay);
    if (!scheduledDate || !normalizedTitle) return;

    const logicalKey = `${scheduledDate}::${normalizedTitle}`;
    const documentId = taskUniqueKeyDocumentId(logicalKey);
    const existingLogicalKey = seenDocumentIds.get(documentId);

    if (existingLogicalKey && existingLogicalKey !== logicalKey) {
      throw new Error('Task uniqueness hash collision detected.');
    }
    seenDocumentIds.set(documentId, logicalKey);

    writes.push({
      ref: doc(db, 'taskUniqueKeys', documentId),
      data: {
        logicalKey,
        taskId: String(data.taskId || taskDoc.id),
        scheduledDate,
        normalizedTitle,
        updatedAt: new Date().toISOString(),
      },
    });
  });

  await commitQueuedWrites(writes);
}

function normalizedTaskTitleKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

/**
 * Removes duplicate task documents that represent the same logical task:
 * same scheduled date + same normalized title.
 *
 * The canonical T# document is preferred as the survivor. When duplicate
 * copies differ, the most recently updated copy supplies the descriptive
 * fields, while completion is preserved if any copy is completed.
 */
async function deduplicateTasksByLogicalKey(): Promise<void> {
  const snapshot = await getDocs(collection(db, 'tasks'));
  if (snapshot.empty) return;

  const groups = new Map<string, typeof snapshot.docs>();

  snapshot.docs.forEach((taskDoc) => {
    const data = taskDoc.data() as Record<string, unknown>;
    const dateKey = toDateKey(data.scheduledDate || data.taskKey);
    const titleKey = normalizedTaskTitleKey(data.title || data.taskOfTheDay);
    if (!dateKey || !titleKey) return;

    const logicalKey = `${dateKey}::${titleKey}`;
    const group = groups.get(logicalKey) || [];
    group.push(taskDoc);
    groups.set(logicalKey, group);
  });

  const duplicateGroups = [...groups.values()].filter((group) => group.length > 1);
  if (!duplicateGroups.length) return;

  for (const group of duplicateGroups) {
    const ordered = [...group].sort((a, b) => {
      const aId = String(a.data().taskId || a.id);
      const bId = String(b.data().taskId || b.id);
      const aCanonical = isSimpleTaskId(aId) && a.id === aId ? 0 : 1;
      const bCanonical = isSimpleTaskId(bId) && b.id === bId ? 0 : 1;
      if (aCanonical !== bCanonical) return aCanonical - bCanonical;

      const aUpdated = String(a.data().updatedAt || '');
      const bUpdated = String(b.data().updatedAt || '');
      if (aUpdated !== bUpdated) return bUpdated.localeCompare(aUpdated);

      return a.id.localeCompare(b.id, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });

    const keeper = ordered[0];
    const latest = [...group].sort((a, b) =>
      String(b.data().updatedAt || '').localeCompare(String(a.data().updatedAt || ''))
    )[0];

    const keeperData = keeper.data() as Record<string, unknown>;
    const latestData = latest.data() as Record<string, unknown>;
    const keeperTaskId = String(keeperData.taskId || keeper.id);
    const scheduledDate = toDateKey(
      latestData.scheduledDate ||
        latestData.taskKey ||
        keeperData.scheduledDate ||
        keeperData.taskKey
    );
    const title = String(
      latestData.title ||
        latestData.taskOfTheDay ||
        keeperData.title ||
        keeperData.taskOfTheDay ||
        ''
    ).trim();

    const anyCompleted = group.some((taskDoc) => {
      const data = taskDoc.data();
      return data.Iscompleted === true || data.isCompleted === true;
    });

    const completedAtCandidates = group
      .map((taskDoc) => String(taskDoc.data().completedAt || ''))
      .filter(Boolean)
      .sort();

    const merged: Record<string, unknown> = {
      ...keeperData,
      ...latestData,
      taskId: keeperTaskId,
      title,
      scheduledDate,
      Iscompleted: anyCompleted,
    };

    if (completedAtCandidates.length > 0) {
      merged.completedAt = completedAtCandidates[completedAtCandidates.length - 1];
    }

    const batch = writeBatch(db);
    batch.set(keeper.ref, merged);

    ordered.slice(1).forEach((duplicate) => {
      batch.delete(duplicate.ref);
    });

    await batch.commit();
  }
}

async function backfillTaskOrder(): Promise<void> {
  const snapshot = await getDocs(collection(db, 'tasks'));
  const byDate = new Map<string, typeof snapshot.docs>();

  for (const taskDoc of snapshot.docs) {
    const dateKey = toDateKey(taskDoc.data().scheduledDate);
    if (!dateKey) continue;
    const group = byDate.get(dateKey) || [];
    group.push(taskDoc);
    byDate.set(dateKey, group);
  }

  const writes: QueuedWrite[] = [];
  for (const tasks of byDate.values()) {
    tasks.sort((a, b) => {
      const aId = String(a.data().taskId || a.id);
      const bId = String(b.data().taskId || b.id);
      return aId.localeCompare(bId, undefined, { numeric: true, sensitivity: 'base' });
    });
    tasks.forEach((taskDoc, index) => {
      const data = taskDoc.data() as Record<string, unknown>;
      const { sortOrder: _legacySortOrder, ...withoutLegacySortOrder } = data;
      writes.push({
        ref: taskDoc.ref,
        data: { ...withoutLegacySortOrder, taskOrder: index + 1 },
      });
    });
  }

  await commitQueuedWrites(writes);
}

export async function migrateLegacyDataModel(): Promise<DataModelMigrationResult> {
  const [
    recordsSnap,
    tasksSnap,
    habitsSnap,
    habitLogsSnap,
    existingDaysSnap,
    countdownSnap,
  ] = await Promise.all([
    getDocs(collection(db, 'records')),
    getDocs(collection(db, 'tasks')),
    getDocs(collection(db, 'habits')),
    getDocs(collection(db, 'habitLogs')),
    getDocs(collection(db, 'days')),
    getDoc(doc(db, 'countdowns', 'system_builder_countdown'))
  ]);

  const result: DataModelMigrationResult = {
    users: 0,
    days: 0,
    tasks: 0,
    habits: 0,
    habitLogs: 0,
    countdowns: 0,
  };

  const writes: QueuedWrite[] = [];

  // 1. Single-user profile.
  writes.push({
    ref: doc(db, 'users', 'default-user'),
    data: {
      userId: 'default-user',
      name: 'Rafiq Ahmed',
      email: 'sbrafiqahmedali7575@gmail.com',
    },
  });
  result.users = 1;

  // Normalize tasks while preserving all legacy fields through merge writes.
  const normalizedTasks = tasksSnap.docs
    .map((taskDoc, index) => {
      const data = taskDoc.data() as Record<string, unknown>;
      const scheduledDate = toDateKey(data.scheduledDate || data.taskKey);
      const title = String(data.title || data.taskOfTheDay || '').trim();
      const isCompleted =
        typeof data.Iscompleted === 'boolean'
          ? data.Iscompleted
          : Boolean(data.isCompleted);

      const normalized = {
        id: taskDoc.id,
        scheduledDate,
        title,
        quadrant: matrixQuadrantToRoman(data.quadrant || data.matrixQuadrant),
        taskOrder:
          Number.isInteger(Number(data.taskOrder || data.sortOrder)) && Number(data.taskOrder || data.sortOrder) >= 0
            ? Number(data.taskOrder || data.sortOrder)
            : index + 1,
        notes: String(data.notes || ''),
        Iscompleted: isCompleted,
      };

      writes.push({
        ref: taskDoc.ref,
        data: {
          taskId: taskDoc.id,
          title: normalized.title,
          quadrant: normalized.quadrant,
          scheduledDate: normalized.scheduledDate,
          taskOrder: normalized.taskOrder,
          notes: normalized.notes,
          Iscompleted: normalized.Iscompleted,
        },
      });
      result.tasks += 1;
      return normalized;
    })
    .filter((task) => Boolean(task.scheduledDate));

  // Canonical HabitLogs are the source of truth for check-in completion.
  // Keep legacy habits.checkIns only as a compatibility fallback.
  const completedLogDatesByHabit = new Map<string, Set<string>>();
  habitLogsSnap.forEach((logDoc) => {
    const data = logDoc.data();
    if (data.Iscompleted !== true) return;

    const habitId = String(data.habitId || '');
    const dateKey = toDateKey(data.dateKey);
    if (!habitId || !dateKey) return;

    if (!completedLogDatesByHabit.has(habitId)) {
      completedLogDatesByHabit.set(habitId, new Set());
    }
    completedLogDatesByHabit.get(habitId)!.add(dateKey);
  });

  // Normalize habits and split any remaining legacy checkIns into HabitLogs.
  const normalizedHabits = habitsSnap.docs.map((habitDoc) => {
    const data = habitDoc.data() as Record<string, unknown>;
    const repeatDays = repeatDaysForHabit(data);
    const activeFrom = activeFromForHabit(data);
    const legacyCheckIns = Array.isArray(data.checkIns)
      ? data.checkIns.map((value) => toDateKey(value)).filter(Boolean)
      : [];
    const canonicalHabitId = String(data.habitId || habitDoc.id);
    const canonicalCheckIns = [
      ...(completedLogDatesByHabit.get(canonicalHabitId) || new Set<string>()),
      ...(completedLogDatesByHabit.get(habitDoc.id) || new Set<string>()),
    ];
    const checkIns = [...new Set([...legacyCheckIns, ...canonicalCheckIns])].sort();

    const normalized = {
      id: habitDoc.id,
      data,
      repeatDays,
      activeFrom,
      isActive: data.isActive !== false,
      checkIns,
    };

    writes.push({
      ref: habitDoc.ref,
      data: {
        habitId: habitDoc.id,
        name: String(data.name || '').trim(),
        repeatDays,
        activeFrom,
        isActive: normalized.isActive,
        inactivePeriods: Array.isArray(data.inactivePeriods)
          ? data.inactivePeriods
          : [],
        color: colorToHex(data.color),
      },
    });
    result.habits += 1;

    return normalized;
  });

  // Move the existing countdown settings document into the target countdowns collection.
  if (countdownSnap.exists()) {
    const data = countdownSnap.data() as Record<string, unknown>;
    const targetDate = toDateKey(data.targetDate);

    if (targetDate) {
      const countdownId = 'system_builder_countdown';
      writes.push({
        ref: doc(db, 'countdowns', countdownId),
        data: {
          countdownId,
          title: String(data.reason || data.title || 'Countdown').trim(),
          targetDate,
          isActive: data.isActive !== false,
        },
      });
      result.countdowns = 1;
    }
  }

  // Build Day documents from every known legacy/current date.
  const dateKeys = new Set<string>();

  recordsSnap.forEach((recordDoc) => {
    const dateKey = toDateKey(recordDoc.data().date);
    if (dateKey) dateKeys.add(dateKey);
  });

  normalizedTasks.forEach((task) => {
    if (task.scheduledDate) dateKeys.add(task.scheduledDate);
  });

  normalizedHabits.forEach((habit) => {
    habit.checkIns.forEach((dateKey) => dateKeys.add(dateKey));
  });

  existingDaysSnap.forEach((dayDoc) => {
    const dateKey = toDateKey(dayDoc.data().dateKey || dayDoc.id);
    if (dateKey) dateKeys.add(dateKey);
  });

  for (const dateKey of [...dateKeys].sort()) {
    const dayTasks = normalizedTasks.filter((task) => task.scheduledDate === dateKey);
    const tasksDone = dayTasks.filter((task) => task.Iscompleted).length;
    const tasks = dayTasks.length;
    const tasksCompleted = roundedRate(tasksDone, tasks);

    const dueHabits = normalizedHabits.filter((habit) =>
      isHabitDue(
        {
          ...habit.data,
          repeatDays: habit.repeatDays,
          activeFrom: habit.activeFrom,
          isActive: habit.isActive,
        },
        dateKey
      )
    );

    const habitsDone = dueHabits.filter((habit) =>
      habit.checkIns.includes(dateKey)
    ).length;
    const Habits = dueHabits.length;
    const habitsCompleted = roundedRate(habitsDone, Habits);
    const dayCompleted = Math.round(tasksCompleted * 0.8 + habitsCompleted * 0.2);

    writes.push({
      ref: doc(db, 'days', dateKey),
      data: {
        dateKey,
        tasksDone,
        tasks,
        tasksCompleted,
        habitsDone,
        Habits,
        habitsCompleted,
        dayCompleted,
        IsdayCompleted: dayCompleted >= 80,
      },
    });
    result.days += 1;
  }

  await commitQueuedWrites(writes);
  await deduplicateTasksByLogicalKey();
  await migrateCanonicalIds();
  await cleanupHabitLogsByDateAndHabit();
  // Re-run after re-keying so an interrupted older migration cannot leave a
  // legacy-key copy beside its canonical T# copy.
  await deduplicateTasksByLogicalKey();
  await repairCanonicalHabitLogsAndDays();
  await rebuildTaskUniqueKeys();
  await backfillTaskOrder();
  return result;
}
