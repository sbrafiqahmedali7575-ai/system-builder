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
const KEY_SYNC_CONFLICTS = 'sync_conflicts_v1';

const LEGACY_LOCAL_STORAGE_KEYS = [
  'RAFIQ_DAILY_COMMITMENT_RECORDS_V2',
  'SYSTEM_BUILDER_TASKS_CACHE_V2',
  'COMMITDAILY_TASKS_CACHE_V2',
  'SYSTEM_BUILDER_HABITS_CACHE_V1',
];

export function purgeLegacyLocalStorage(): void {
  if (typeof window === 'undefined') return;

  for (const key of LEGACY_LOCAL_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage can be unavailable in hardened/private browser contexts.
    }
  }
}

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
  addRecord?: (record: DailyRecord, mutationAt?: number) => Promise<void>;
  updateRecord?: (record: DailyRecord, mutationAt?: number) => Promise<void>;
  deleteRecord?: (id: string, mutationAt?: number) => Promise<void>;
  addTask?: (task: TaskItem, mutationAt?: number) => Promise<void>;
  updateTask?: (task: TaskItem, mutationAt?: number) => Promise<void>;
  deleteTask?: (id: string, mutationAt?: number) => Promise<void>;
  addHabit?: (habit: HabitItem, mutationAt?: number) => Promise<void>;
  updateHabit?: (habit: HabitItem, mutationAt?: number) => Promise<void>;
  deleteHabit?: (id: string, mutationAt?: number) => Promise<void>;
}

export interface SyncConflict {
  mutation: PendingMutation;
  detectedAt: string;
  message: string;
}

function getErrorStatus(error: unknown): number | undefined {
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    Number.isFinite(Number((error as { status?: number }).status))
  ) {
    return Number((error as { status?: number }).status);
  }
  return undefined;
}

export function isRetryableSyncError(error?: unknown): boolean {
  if (isNetworkOrOfflineError(error)) return true;
  const status = getErrorStatus(error);
  return (
    status === 401 ||
    status === 403 ||
    status === 408 ||
    status === 425 ||
    status === 429 ||
    (status !== undefined && status >= 500)
  );
}

async function recordSyncConflict(
  mutation: PendingMutation,
  error: unknown
): Promise<void> {
  const current =
    (await offlineStore.getItem<SyncConflict[]>(KEY_SYNC_CONFLICTS)) || [];
  const message =
    error instanceof Error ? error.message : String(error || 'Sync conflict');

  const entityId =
    mutation.payload && 'id' in mutation.payload
      ? String(mutation.payload.id)
      : '';
  const filtered = current.filter((item) => {
    const itemId =
      item.mutation.payload && 'id' in item.mutation.payload
        ? String(item.mutation.payload.id)
        : '';
    return !(item.mutation.type === mutation.type && itemId === entityId);
  });

  filtered.push({
    mutation,
    detectedAt: new Date().toISOString(),
    message,
  });

  await offlineStore.setItem(KEY_SYNC_CONFLICTS, filtered.slice(-100));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('system-builder-sync-conflict', {
        detail: { message, entityId, type: mutation.type },
      })
    );
  }
}

export async function getSyncConflicts(): Promise<SyncConflict[]> {
  const conflicts =
    await offlineStore.getItem<SyncConflict[]>(KEY_SYNC_CONFLICTS);
  return Array.isArray(conflicts) ? conflicts : [];
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
    return Array.isArray(cached) && cached.length > 0 ? cached : null;
  } catch (err) {
    console.warn('Error reading records from IndexedDB:', err);
    return null;
  }
}

export async function setCachedRecords(
  records: DailyRecord[]
): Promise<void> {
  try {
    await offlineStore.setItem(KEY_RECORDS, records);
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
    return Array.isArray(cached) ? cached : null;
  } catch (err) {
    console.warn('Error reading tasks from IndexedDB:', err);
    return null;
  }
}

export async function setCachedTasks(tasks: TaskItem[]): Promise<void> {
  try {
    await offlineStore.setItem(KEY_TASKS, tasks);
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
    return Array.isArray(cached) ? cached : null;
  } catch (err) {
    console.warn('Error reading habits from IndexedDB:', err);
    return null;
  }
}

export async function setCachedHabits(habits: HabitItem[]): Promise<void> {
  try {
    await offlineStore.setItem(KEY_HABITS, habits);
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
            if (handlers.addTask) await handlers.addTask(mutation.payload, mutation.timestamp);
            break;
          case 'task_update':
            if (handlers.updateTask) await handlers.updateTask(mutation.payload, mutation.timestamp);
            break;
          case 'task_delete':
            if (handlers.deleteTask) await handlers.deleteTask(mutation.payload.id, mutation.timestamp);
            break;

          case 'habit_add':
            if (handlers.addHabit) await handlers.addHabit(mutation.payload, mutation.timestamp);
            break;
          case 'habit_update':
            if (handlers.updateHabit) await handlers.updateHabit(mutation.payload, mutation.timestamp);
            break;
          case 'habit_delete':
            if (handlers.deleteHabit) await handlers.deleteHabit(mutation.payload.id, mutation.timestamp);
            break;

          case 'record_add':
            if (handlers.addRecord) await handlers.addRecord(mutation.payload, mutation.timestamp);
            break;
          case 'record_update':
            if (handlers.updateRecord) await handlers.updateRecord(mutation.payload, mutation.timestamp);
            break;
          case 'record_delete':
            if (handlers.deleteRecord) await handlers.deleteRecord(mutation.payload.id, mutation.timestamp);
            break;
        }
        synced++;
      } catch (err) {
        const status = getErrorStatus(err);

        if (isRetryableSyncError(err)) {
          // Authentication expiry, throttling, network faults and server errors
          // are transient. Never discard the user's queued work.
          remaining.push(mutation);
          failed++;
        } else if (status === 409) {
          // The server has a newer edit. Keep a local audit record and let the
          // server version win instead of overwriting it with stale offline data.
          await recordSyncConflict(mutation, err);
          failed++;
        } else {
          // Permanent validation failures are surfaced as conflicts rather than
          // silently disappearing.
          await recordSyncConflict(mutation, err);
          failed++;
        }
      }
    }

    await offlineStore.setItem(KEY_PENDING_QUEUE, remaining);
  } finally {
    isSyncingQueue = false;
  }

  return { synced, failed };
}
