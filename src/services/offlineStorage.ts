import localforage from 'localforage';
import { DailyRecord, HabitItem, TaskItem } from '../types';

// Configure localforage instance for CommitDaily / SystemBuilder
export const offlineStore = localforage.createInstance({
  name: 'CommitDaily_DB',
  storeName: 'offline_cache',
  description: 'IndexedDB offline-first persistence cache for tasks, habits, and records',
});

// Storage keys
const KEY_RECORDS = 'records_cache_v2';
const KEY_TASKS = 'tasks_cache_v2';
const KEY_HABITS = 'habits_cache_v2';
const KEY_PENDING_QUEUE = 'pending_offline_mutations_v1';

// Legacy localStorage fallback keys for one-time seamless migration
const LEGACY_RECORDS_KEY = 'RAFIQ_DAILY_COMMITMENT_RECORDS_V2';
const LEGACY_TASKS_KEY = 'SYSTEM_BUILDER_TASKS_CACHE_V2';
const LEGACY_TASKS_FALLBACK_KEY = 'COMMITDAILY_TASKS_CACHE_V2';
const LEGACY_HABITS_KEY = 'SYSTEM_BUILDER_HABITS_CACHE_V1';

export type PendingMutation =
  | { type: 'record_add'; payload: DailyRecord; timestamp: number }
  | { type: 'record_update'; payload: DailyRecord; timestamp: number }
  | { type: 'record_delete'; payload: { id: string }; timestamp: number }
  | { type: 'task_add'; payload: TaskItem; timestamp: number }
  | { type: 'task_update'; payload: TaskItem; timestamp: number }
  | { type: 'task_delete'; payload: { id: string }; timestamp: number }
  | { type: 'habit_add'; payload: HabitItem; timestamp: number }
  | { type: 'habit_update'; payload: HabitItem; timestamp: number }
  | { type: 'habit_delete'; payload: { id: string }; timestamp: number };

export interface SyncHandlers {
  addRecord?: (record: DailyRecord) => Promise<void>;
  updateRecord?: (record: DailyRecord) => Promise<void>;
  deleteRecord?: (id: string) => Promise<void>;
  addTask?: (task: TaskItem) => Promise<void>;
  updateTask?: (task: TaskItem) => Promise<void>;
  deleteTask?: (id: string) => Promise<void>;
  addHabit?: (habit: HabitItem) => Promise<void>;
  updateHabit?: (habit: HabitItem) => Promise<void>;
  deleteHabit?: (id: string) => Promise<void>;
}

/**
 * Check if an error or current environment indicates offline state.
 */
export function isNetworkOrOfflineError(error?: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }
  if (!error) return false;
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes('offline') ||
    msg.includes('unavailable') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('client is offline') ||
    msg.includes('network request failed') ||
    msg.includes('timeout')
  );
}

// ─────────────────────────────────────────────────────────────
// RECORDS CACHE
// ─────────────────────────────────────────────────────────────

export async function getCachedRecords(): Promise<DailyRecord[] | null> {
  try {
    const cached = await offlineStore.getItem<DailyRecord[]>(KEY_RECORDS);
    if (Array.isArray(cached) && cached.length > 0) {
      return cached;
    }

    // Attempt migration from localStorage if IndexedDB has not been populated yet
    if (typeof window !== 'undefined') {
      const legacy = localStorage.getItem(LEGACY_RECORDS_KEY);
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed) && parsed.length > 0) {
            await setCachedRecords(parsed);
            return parsed;
          }
        } catch {
          // ignore parsing error
        }
      }
    }
  } catch (err) {
    console.warn('Error reading records from IndexedDB:', err);
  }
  return null;
}

export async function setCachedRecords(records: DailyRecord[]): Promise<void> {
  try {
    await offlineStore.setItem(KEY_RECORDS, records);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LEGACY_RECORDS_KEY, JSON.stringify(records));
      } catch {
        // LocalStorage may exceed quota with large datasets; IndexedDB is the source of truth
      }
    }
  } catch (err) {
    console.warn('Error writing records to IndexedDB:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// TASKS CACHE
// ─────────────────────────────────────────────────────────────

export async function getCachedTasks(): Promise<TaskItem[] | null> {
  try {
    const cached = await offlineStore.getItem<TaskItem[]>(KEY_TASKS);
    if (Array.isArray(cached)) {
      return cached;
    }

    // Migration from localStorage
    if (typeof window !== 'undefined') {
      const legacy =
        localStorage.getItem(LEGACY_TASKS_KEY) ||
        localStorage.getItem(LEGACY_TASKS_FALLBACK_KEY);
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed)) {
            await setCachedTasks(parsed);
            return parsed;
          }
        } catch {
          // ignore parsing error
        }
      }
    }
  } catch (err) {
    console.warn('Error reading tasks from IndexedDB:', err);
  }
  return null;
}

export async function setCachedTasks(tasks: TaskItem[]): Promise<void> {
  try {
    await offlineStore.setItem(KEY_TASKS, tasks);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LEGACY_TASKS_KEY, JSON.stringify(tasks));
      } catch {
        // quota ignore
      }
    }
  } catch (err) {
    console.warn('Error writing tasks to IndexedDB:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// HABITS CACHE
// ─────────────────────────────────────────────────────────────

export async function getCachedHabits(): Promise<HabitItem[] | null> {
  try {
    const cached = await offlineStore.getItem<HabitItem[]>(KEY_HABITS);
    if (Array.isArray(cached)) {
      return cached;
    }

    // Migration from localStorage
    if (typeof window !== 'undefined') {
      const legacy = localStorage.getItem(LEGACY_HABITS_KEY);
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed)) {
            await setCachedHabits(parsed);
            return parsed;
          }
        } catch {
          // ignore parsing error
        }
      }
    }
  } catch (err) {
    console.warn('Error reading habits from IndexedDB:', err);
  }
  return null;
}

export async function setCachedHabits(habits: HabitItem[]): Promise<void> {
  try {
    await offlineStore.setItem(KEY_HABITS, habits);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LEGACY_HABITS_KEY, JSON.stringify(habits));
      } catch {
        // quota ignore
      }
    }
  } catch (err) {
    console.warn('Error writing habits to IndexedDB:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// OFFLINE MUTATION QUEUE & RE-SYNC
// ─────────────────────────────────────────────────────────────

export async function getPendingMutations(): Promise<PendingMutation[]> {
  try {
    const queue = await offlineStore.getItem<PendingMutation[]>(KEY_PENDING_QUEUE);
    return Array.isArray(queue) ? queue : [];
  } catch {
    return [];
  }
}

export async function queueMutation(mutation: PendingMutation): Promise<void> {
  try {
    const current = await getPendingMutations();
    // Avoid redundant duplicates: if updating the same entity ID multiple times while offline, merge or keep latest
    const filtered = current.filter((item) => {
      if (item.type.startsWith('task_') && mutation.type.startsWith('task_')) {
        const itemTaskId = 'id' in item.payload ? item.payload.id : undefined;
        const mutTaskId = 'id' in mutation.payload ? mutation.payload.id : undefined;
        return itemTaskId !== mutTaskId;
      }
      if (item.type.startsWith('habit_') && mutation.type.startsWith('habit_')) {
        const itemHabitId = 'id' in item.payload ? item.payload.id : undefined;
        const mutHabitId = 'id' in mutation.payload ? mutation.payload.id : undefined;
        return itemHabitId !== mutHabitId;
      }
      if (item.type.startsWith('record_') && mutation.type.startsWith('record_')) {
        const itemRecId = 'id' in item.payload ? item.payload.id : undefined;
        const mutRecId = 'id' in mutation.payload ? mutation.payload.id : undefined;
        return itemRecId !== mutRecId;
      }
      return true;
    });

    filtered.push(mutation);
    await offlineStore.setItem(KEY_PENDING_QUEUE, filtered);
  } catch (err) {
    console.warn('Error queueing offline mutation in IndexedDB:', err);
  }
}

export async function clearPendingMutations(): Promise<void> {
  try {
    await offlineStore.removeItem(KEY_PENDING_QUEUE);
  } catch (err) {
    console.warn('Error clearing pending mutations:', err);
  }
}

/**
 * Process all queued offline mutations once network connectivity is restored.
 */
let isSyncingQueue = false;

export async function processPendingSync(
  handlers: SyncHandlers
): Promise<{ synced: number; failed: number }> {
  if (isSyncingQueue) {
    return { synced: 0, failed: 0 };
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  isSyncingQueue = true;
  let synced = 0;
  let failed = 0;

  try {
    const queue = await getPendingMutations();
    if (queue.length === 0) {
      isSyncingQueue = false;
      return { synced: 0, failed: 0 };
    }

    const remaining: PendingMutation[] = [];

    for (const mutation of queue) {
      try {
        switch (mutation.type) {
          case 'task_add':
            if (handlers.addTask) await handlers.addTask(mutation.payload);
            break;
          case 'task_update':
            if (handlers.updateTask) await handlers.updateTask(mutation.payload);
            break;
          case 'task_delete':
            if (handlers.deleteTask) await handlers.deleteTask(mutation.payload.id);
            break;

          case 'habit_add':
            if (handlers.addHabit) await handlers.addHabit(mutation.payload);
            break;
          case 'habit_update':
            if (handlers.updateHabit) await handlers.updateHabit(mutation.payload);
            break;
          case 'habit_delete':
            if (handlers.deleteHabit) await handlers.deleteHabit(mutation.payload.id);
            break;

          case 'record_add':
            if (handlers.addRecord) await handlers.addRecord(mutation.payload);
            break;
          case 'record_update':
            if (handlers.updateRecord) await handlers.updateRecord(mutation.payload);
            break;
          case 'record_delete':
            if (handlers.deleteRecord) await handlers.deleteRecord(mutation.payload.id);
            break;
        }
        synced++;
      } catch (err) {
        if (isNetworkOrOfflineError(err)) {
          // Still offline, retain in remaining queue
          remaining.push(mutation);
          failed++;
        } else {
          // If permanent business validation error (e.g. duplicate or already deleted), don't loop forever
          console.warn('Offline sync mutation discarded due to error:', err);
        }
      }
    }

    await offlineStore.setItem(KEY_PENDING_QUEUE, remaining);
  } finally {
    isSyncingQueue = false;
  }

  return { synced, failed };
}
