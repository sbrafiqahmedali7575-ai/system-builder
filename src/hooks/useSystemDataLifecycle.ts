import { useEffect, type MutableRefObject } from 'react';
import type { DailyRecord, HabitItem, TaskItem } from '../types';
import {
  isFirestoreWriteQuotaExhausted,
  isQuotaExceededError,
  markFirestoreWriteQuotaExhausted,
} from '../services/firebaseService';
import {
  tasksRepository,
  habitsRepository,
  daysRepository,
} from '../services/repositories';
import {
  getCachedHabits,
  getCachedRecords,
  getCachedTasks,
  processPendingSync,
  setCachedHabits,
  setCachedRecords,
  setCachedTasks,
} from '../services/offlineStorage';
import {
  migrateLegacyDataModel,
  repairCanonicalHabitLogsAndDays,
} from '../services/dataModelMigration';

const DATA_MODEL_MIGRATION_KEY = 'SYSTEM_BUILDER_SINGLE_USER_MODEL_V16_DAYS_DEDUP_FUTURE_CLEANUP';
const HABIT_LOG_REPAIR_KEY = 'SYSTEM_BUILDER_V13_FULL_HISTORICAL_DAYS_REBUILD';

export type PendingTaskMutation =
  | { kind: 'upsert'; task: TaskItem }
  | { kind: 'delete' };

function taskContentMatches(a: TaskItem, b: TaskItem): boolean {
  return (
    a.id === b.id &&
    a.taskKey === b.taskKey &&
    a.taskOfTheDay === b.taskOfTheDay &&
    a.isCompleted === b.isCompleted &&
    (a.priority || 'Normal') === (b.priority || 'Normal') &&
    (a.timeEstimate || '') === (b.timeEstimate || '') &&
    (a.category || '') === (b.category || '') &&
    (a.notes || '') === (b.notes || '') &&
    (a.completedAt || '') === (b.completedAt || '') &&
    (a.matrixQuadrant || '') === (b.matrixQuadrant || '')
  );
}

interface Params {
  currentDateKey: string;
  pendingTaskMutationsRef: MutableRefObject<Map<string, PendingTaskMutation>>;
  setRecords: React.Dispatch<React.SetStateAction<DailyRecord[]>>;
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  setHabits: React.Dispatch<React.SetStateAction<HabitItem[]>>;
}

export function useSystemDataLifecycle({
  currentDateKey,
  pendingTaskMutationsRef,
  setRecords,
  setTasks,
  setHabits,
}: Params): void {
  useEffect(() => {
    let mounted = true;
    Promise.all([getCachedRecords(), getCachedTasks(), getCachedHabits()])
      .then(([records, tasks, habits]) => {
        if (!mounted) return;
        if (records?.length) setRecords(records);
        if (tasks?.length) setTasks(tasks);
        if (habits?.length) setHabits(habits);
      })
      .catch((error) => console.warn('Local cache hydration failed:', error));
    return () => { mounted = false; };
  }, [setHabits, setRecords, setTasks]);

  useEffect(() => {
    if (typeof window === 'undefined' || isFirestoreWriteQuotaExhausted()) return;
    if (localStorage.getItem(DATA_MODEL_MIGRATION_KEY) === '1') return;
    let cancelled = false;
    void migrateLegacyDataModel()
      .then(() => {
        if (!cancelled) localStorage.setItem(DATA_MODEL_MIGRATION_KEY, '1');
      })
      .catch((error) => {
        if (isQuotaExceededError(error)) markFirestoreWriteQuotaExhausted();
        else console.warn('Data model migration remains pending:', error);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || isFirestoreWriteQuotaExhausted()) return;
    if (localStorage.getItem(HABIT_LOG_REPAIR_KEY) === '1') return;
    let cancelled = false;
    void repairCanonicalHabitLogsAndDays()
      .then(() => {
        if (!cancelled) localStorage.setItem(HABIT_LOG_REPAIR_KEY, '1');
      })
      .catch((error) => {
        if (isQuotaExceededError(error)) markFirestoreWriteQuotaExhausted();
        else if (!cancelled) console.warn('Historical habit/day repair remains pending:', error);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isFirestoreWriteQuotaExhausted()) return;
    void daysRepository.initializeHabitStatus(currentDateKey).catch((error) => {
      if (isQuotaExceededError(error)) markFirestoreWriteQuotaExhausted();
      else console.warn('Today habit initialization failed:', error);
    });
  }, [currentDateKey]);

  useEffect(() => {
    const sync = () => {
      if (isFirestoreWriteQuotaExhausted()) return;
      void processPendingSync({
        addTask: tasksRepository.add,
        updateTask: tasksRepository.update,
        deleteTask: tasksRepository.remove,
        addHabit: habitsRepository.add,
        updateHabit: habitsRepository.update,
        deleteHabit: habitsRepository.remove,
        addRecord: daysRepository.add,
        updateRecord: daysRepository.update,
        deleteRecord: daysRepository.remove,
      }).catch((error) => console.warn('Offline queue sync failed:', error));
    };
    window.addEventListener('online', sync);
    sync();
    return () => window.removeEventListener('online', sync);
  }, []);

  useEffect(() => daysRepository.subscribe(
    (cloud) => {
      if (!cloud?.length) return;
      setRecords(cloud);
      void setCachedRecords(cloud);
    },
    (error) => console.warn('Records using local cache:', error)
  ), [setRecords]);

  useEffect(() => tasksRepository.subscribe(
    (cloudTasks) => {
      const pending = pendingTaskMutationsRef.current;
      const merged = new Map(cloudTasks.map((task) => [task.id, task]));
      pending.forEach((mutation, taskId) => {
        const cloudTask = merged.get(taskId);
        if (mutation.kind === 'delete') {
          if (!cloudTask) pending.delete(taskId);
          merged.delete(taskId);
        } else if (cloudTask && taskContentMatches(cloudTask, mutation.task)) {
          pending.delete(taskId);
        } else {
          merged.set(taskId, mutation.task);
        }
      });
      const next = Array.from(merged.values()).sort((a, b) => (b.taskKey || '').localeCompare(a.taskKey || ''));
      setTasks(next);
      void setCachedTasks(next);
    },
    (error) => console.warn('Tasks using local cache:', error)
  ), [pendingTaskMutationsRef, setTasks]);

  useEffect(() => habitsRepository.subscribe(
    (cloud) => {
      setHabits(cloud);
      void setCachedHabits(cloud);
    },
    (error) => console.warn('Habits using local cache:', error)
  ), [setHabits]);

  useEffect(() => { if (currentDateKey) void setCachedRecords; }, [currentDateKey]);

  // Cache writes are local-only and intentionally separate from Firestore writes.
  // Components can update optimistically without coupling persistence to rendering.
}
