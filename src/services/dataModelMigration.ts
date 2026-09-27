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
  if (data.isActive === false) return false;

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
  return Math.round((completed / total) * 10000) / 100;
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

export async function migrateLegacyDataModel(): Promise<DataModelMigrationResult> {
  const [
    recordsSnap,
    tasksSnap,
    habitsSnap,
    existingDaysSnap,
    countdownSnap,
  ] = await Promise.all([
    getDocs(collection(db, 'records')),
    getDocs(collection(db, 'tasks')),
    getDocs(collection(db, 'habits')),
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

  // Normalize habits and split legacy checkIns into HabitLogs.
  const normalizedHabits = habitsSnap.docs.map((habitDoc) => {
    const data = habitDoc.data() as Record<string, unknown>;
    const repeatDays = repeatDaysForHabit(data);
    const activeFrom = activeFromForHabit(data);
    const checkIns = Array.isArray(data.checkIns)
      ? [...new Set(data.checkIns.map((value) => toDateKey(value)).filter(Boolean))]
      : [];

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
        color: colorToHex(data.color),
      },
    });
    result.habits += 1;

    for (const dateKey of checkIns) {
      const habitLogId = `${habitDoc.id}_${dateKey}`;
      writes.push({
        ref: doc(db, 'habitLogs', habitLogId),
        data: {
          habitLogId,
          habitId: habitDoc.id,
          dateKey,
          Iscompleted: true,
        },
      });
      result.habitLogs += 1;
    }

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
    const tasksCompleted = dayTasks.filter((task) => task.Iscompleted).length;
    const taskTotal = dayTasks.length;
    const taskCompletionRate = roundedRate(tasksCompleted, taskTotal);

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

    const habitsCompleted = dueHabits.filter((habit) =>
      habit.checkIns.includes(dateKey)
    ).length;
    const habitTotal = dueHabits.length;
    const habitCompletionRate = roundedRate(habitsCompleted, habitTotal);

    writes.push({
      ref: doc(db, 'days', dateKey),
      data: {
        dateKey,
        tasksCompleted,
        taskTotal,
        taskCompletionRate,
        habitsCompleted,
        habitTotal,
        habitCompletionRate,
        IsdayCompleted: taskCompletionRate === 100,
      },
    });
    result.days += 1;
  }

  await commitQueuedWrites(writes);
  await migrateCanonicalIds();
  return result;
}
