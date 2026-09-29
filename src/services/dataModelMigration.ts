import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  type DocumentReference,
  type WriteBatch,
} from 'firebase/firestore';
import {
  db,
  isFirestoreWriteQuotaExhausted,
  isQuotaExceededError,
  markFirestoreWriteQuotaExhausted,
} from './firebaseService';
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
      try {
        await batch.commit();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('quota') || msg.includes('resource-exhausted')) {
          console.warn('Firestore write quota limit reached during migration batch commit.');
          return;
        }
        throw err;
      }
      batch = writeBatch(db);
      count = 0;
    }
  }

  if (count > 0) {
    try {
      await batch.commit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('quota') || msg.includes('resource-exhausted')) {
        console.warn('Firestore write quota limit reached during migration final batch commit.');
        return;
      }
      throw err;
    }
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
function isSimpleTaskId(value: string): boolean {
  return /^T[1-9]\d*$/.test(value);
}

async function deduplicateHabitLogs(): Promise<void> {
  const snapshot = await getDocs(collection(db, 'habitLogs'));
  const groups = new Map<string, typeof snapshot.docs>();

  snapshot.docs.forEach((logDoc) => {
    const data = logDoc.data();
    const habitId = String(data.habitId || '').trim();
    const dateKey = toDateKey(data.dateKey);
    if (!habitId || !dateKey) return;
    const key = `${habitId}::${dateKey}`;
    const group = groups.get(key) || [];
    group.push(logDoc);
    groups.set(key, group);
  });

  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const ordered = [...group].sort((a, b) =>
      String(a.data().habitLogId || a.id).localeCompare(
        String(b.data().habitLogId || b.id),
        undefined,
        { numeric: true }
      )
    );
    const keeper = ordered[0];
    const keeperData = keeper.data();
    const batch = writeBatch(db);
    batch.set(keeper.ref, {
      ...keeperData,
      habitLogId: String(keeperData.habitLogId || keeper.id),
      habitId: String(keeperData.habitId || '').trim(),
      dateKey: toDateKey(keeperData.dateKey),
      Iscompleted: ordered.some((logDoc) => logDoc.data().Iscompleted === true),
    });
    ordered.slice(1).forEach((duplicate) => batch.delete(duplicate.ref));
    await batch.commit();
  }
}

export async function repairCanonicalHabitLogsAndDays(): Promise<void> {
  if (isFirestoreWriteQuotaExhausted()) return;
  // Enforce the HabitLogs uniqueness rule for all historical and current data:
  // one row per (habitId, dateKey). Completion is preserved if any duplicate was completed.
  await deduplicateHabitLogs();

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
  // Preserve existing HabitLog document IDs; startup repair only normalizes data.
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
        tasksCompleted: tasksDone,
        taskTotal: tasks,
        taskCompletionRate: tasksCompleted,
        habitsCompleted: habitsDone,
        habitTotal: Habits,
        habitCompletionRate: habitsCompleted,
        IsdayCompleted: tasks > 0 && tasksCompleted === 100,
      },
    });
  }

  await commitQueuedWrites(dayWrites);
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
      const { taskOrder: _legacyTaskOrder, ...withoutLegacyTaskOrder } = data;
      writes.push({
        ref: taskDoc.ref,
        data: { ...withoutLegacyTaskOrder, sortOrder: index + 1 },
      });
    });
  }

  await commitQueuedWrites(writes);
}

export async function migrateLegacyDataModel(): Promise<DataModelMigrationResult> {
  if (isFirestoreWriteQuotaExhausted()) {
    return { users: 0, days: 0, tasks: 0, habits: 0, habitLogs: 0, countdowns: 0 };
  }
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
        sortOrder:
          Number.isInteger(Number(data.sortOrder || data.taskOrder)) && Number(data.sortOrder || data.taskOrder) >= 0
            ? Number(data.sortOrder || data.taskOrder)
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
          sortOrder: normalized.sortOrder,
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
        tasksCompleted: tasksDone,
        taskTotal: tasks,
        taskCompletionRate: tasksCompleted,
        habitsCompleted: habitsDone,
        habitTotal: Habits,
        habitCompletionRate: habitsCompleted,
        IsdayCompleted: tasks > 0 && tasksCompleted === 100,
      },
    });
    result.days += 1;
  }

  await commitQueuedWrites(writes);
  await deduplicateTasksByLogicalKey();
  // Safety: normal startup migration never re-keys canonical documents.
  // Existing Firestore document IDs are immutable here; field normalization
  // happens in place. This avoids copy/delete data-loss windows on reload.
  // Never reset HabitLogs during normal startup migration. Check-ins are live
  // user data and must survive reloads. The old nine-row reset was a one-time
  // historical repair and would overwrite today's Iscompleted values.
  await repairCanonicalHabitLogsAndDays();
  await backfillTaskOrder();
  return result;
}
