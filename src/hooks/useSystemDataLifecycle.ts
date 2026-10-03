import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
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


const DATA_MODEL_MIGRATION_KEY = 'SYSTEM_BUILDER_SINGLE_USER_MODEL_V16_DAYS_DEDUP_FUTURE_CLEANUP';
const HABIT_LOG_REPAIR_KEY = 'SYSTEM_BUILDER_V17_CALENDAR_DAYS_BACKFILL';

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
    (a.EstimationTime || '') === (b.EstimationTime || '') &&
    (a.ActualTime || '') === (b.ActualTime || '') &&
    (a.category || '') === (b.category || '') &&
    (a.notes || '') === (b.notes || '') &&
    (a.completedAt || '') === (b.completedAt || '') &&
    (a.matrixQuadrant || '') === (b.matrixQuadrant || '') &&
    (a.taskOrder || 0) === (b.taskOrder || 0)
  );
}

interface Params {
  currentDateKey: string;
  pendingTaskMutationsRef: MutableRefObject<Map<string, PendingTaskMutation>>;
  setRecords: Dispatch<SetStateAction<DailyRecord[]>>;
  setTasks: Dispatch<SetStateAction<TaskItem[]>>;
  setHabits: Dispatch<SetStateAction<HabitItem[]>>;
}

export function useSystemDataLifecycle({
  currentDateKey,
  pendingTaskMutationsRef,
  setRecords,
  setTasks,
  setHabits,
}: Params): void {
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

}
