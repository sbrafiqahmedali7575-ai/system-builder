import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { DailyRecord, FilterState, DashboardTheme, HabitItem, TaskItem } from './types';
import { INITIAL_RECORDS } from './data/initialData';
import { PowerBiHeader } from './components/PowerBiHeader';
import { ReportView } from './components/ReportView';
import { AddRecordModal } from './components/AddRecordModal';
import { DayReviewModal } from './components/DayReviewModal';
import { CalNewportLibrary } from './components/CalNewportLibrary';
import { MoreWorkspace, type MoreTab } from './components/MoreWorkspace';
import { TaskSearchDialog } from './components/TaskSearchDialog';
import { MobileBottomNav } from './components/MobileBottomNav';
import { CommandPalette } from './components/CommandPalette';
import { ToastProvider } from './components/ui/ToastProvider';
import { isTodayDate, standardizeDate } from './utils/dateUtils';
import { areDatesEqual, CONFIGURED_TIMEZONE, formatCalendarDate, getIsoDateKeyInTimezone } from './utils/taskDateUtils';
import { getBadgeProgress } from './utils/badgeSystem';
import { isHabitDue } from './utils/habitUtils';
import {
  subscribeToRecords,
  addRecordToCloud,
  updateRecordInCloud,
  deleteRecordFromCloud,
  subscribeToTasks,
  addTaskToCloud,
  updateTaskInCloud,
  deleteTaskFromCloud,
  subscribeToHabits,
  addHabitToCloud,
  updateHabitInCloud,
  setTodayHabitCheckIn,
  deleteHabitFromCloud,
  initializeDayHabitStatus,
  isFirestoreWriteQuotaExhausted,
  isQuotaExceededError,
  markFirestoreWriteQuotaExhausted,
} from './services/firebaseService';
import {
  getCachedRecords,
  setCachedRecords,
  getCachedTasks,
  setCachedTasks,
  getCachedHabits,
  setCachedHabits,
  queueMutation,
  processPendingSync,
  isNetworkOrOfflineError,
} from './services/offlineStorage';
import {
  migrateLegacyDataModel,
  repairCanonicalHabitLogsAndDays,
} from './services/dataModelMigration';
import { useCurrentDateKey } from './hooks/useCurrentDateKey';

const STORAGE_KEY = 'RAFIQ_DAILY_COMMITMENT_RECORDS_V2';
const TASKS_STORAGE_KEY = 'SYSTEM_BUILDER_TASKS_CACHE_V2';
const TASKS_LEGACY_STORAGE_KEY = 'COMMITDAILY_TASKS_CACHE_V2';
const HABITS_STORAGE_KEY = 'SYSTEM_BUILDER_HABITS_CACHE_V1';
const DATA_MODEL_MIGRATION_KEY = 'SYSTEM_BUILDER_SINGLE_USER_MODEL_V16_DAYS_DEDUP_FUTURE_CLEANUP';
const HABIT_LOG_REPAIR_KEY = 'SYSTEM_BUILDER_V13_FULL_HISTORICAL_DAYS_REBUILD';
type PendingTaskMutation =
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

export default function App() {
  // Initialize records from localStorage cache or initial template data
  const [records, setRecords] = useState<DailyRecord[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        } catch (e) {
          console.error('Failed to parse cached records', e);
        }
      }
    }
    return INITIAL_RECORDS;
  });

  // Initialize tasks from localStorage cache
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    if (typeof window !== 'undefined') {
      const savedTasks = localStorage.getItem(TASKS_STORAGE_KEY) || localStorage.getItem(TASKS_LEGACY_STORAGE_KEY);
      if (savedTasks) {
        try {
          const parsed = JSON.parse(savedTasks);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        } catch (e) {
          console.error('Failed to parse cached tasks', e);
        }
      }
    }
    return [];
  });

  const [habits, setHabits] = useState<HabitItem[]>(() => {
    if (typeof window !== 'undefined') {
      const savedHabits = localStorage.getItem(HABITS_STORAGE_KEY);
      if (savedHabits) {
        try {
          const parsed = JSON.parse(savedHabits);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {
          console.error('Failed to parse cached habits', e);
        }
      }
    }
    return [];
  });

  const pendingTaskMutationsRef = useRef<Map<string, PendingTaskMutation>>(
    new Map()
  );
  const pendingTaskCreateKeysRef = useRef<Set<string>>(new Set());
  const currentDateKey = useCurrentDateKey(CONFIGURED_TIMEZONE);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [theme, setTheme] = useState<DashboardTheme>('modern');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isTaskSearchOpen, setIsTaskSearchOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isDayReviewOpen, setIsDayReviewOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('review') === '1';
  });
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.location.pathname === '/books/cal-newport';
  });
  const [isToolsOpen, setIsToolsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.location.pathname === '/tools';
  });
  const [toolsInitialTab, setToolsInitialTab] = useState<MoreTab>('data');
  const [booksFocusMode, setBooksFocusMode] = useState(false);
  const [toolsFocusMode, setToolsFocusMode] = useState(false);
  const [isQuotaExhausted, setIsQuotaExhausted] = useState(() => isFirestoreWriteQuotaExhausted());

  useEffect(() => {
    const onQuotaExceeded = () => setIsQuotaExhausted(true);
    window.addEventListener('system-builder:quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('system-builder:quota-exceeded', onQuotaExceeded);
  }, []);

  // Filter state for report view
  const [filterState, setFilterState] = useState<FilterState>({
    status: 'ALL',
    searchQuery: '',
    dateRange: 'ALL',
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT' || target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }
      if (event.key === 'Escape') {
        setIsTaskSearchOpen(false);
        setIsAddModalOpen(false);
        return;
      }
      if (typing) return;
      if (event.key === '/') {
        event.preventDefault();
        setIsTaskSearchOpen(true);
      } else if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setIsAddModalOpen(true);
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setFocusMode((value) => !value);
      } else if (event.key.toLowerCase() === 't') {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Listen to popstate in case of browser navigation
  useEffect(() => {
    const handleLocationChange = () => {
      const params = new URLSearchParams(window.location.search);
      setIsLibraryOpen(window.location.pathname === '/books/cal-newport');
      setIsToolsOpen(window.location.pathname === '/tools');
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Hydrate from IndexedDB on initial mount
  useEffect(() => {
    let isMounted = true;

    async function hydrateFromIndexedDB() {
      try {
        const [cachedRecords, cachedTasks, cachedHabits] = await Promise.all([
          getCachedRecords(),
          getCachedTasks(),
          getCachedHabits(),
        ]);
        if (!isMounted) return;

        if (cachedRecords && cachedRecords.length > 0) {
          setRecords(cachedRecords);
        }
        if (cachedTasks && cachedTasks.length > 0) {
          setTasks(cachedTasks);
        }
        if (cachedHabits && cachedHabits.length > 0) {
          setHabits(cachedHabits);
        }
      } catch (err) {
        console.warn('Error hydrating from IndexedDB:', err);
      }
    }

    hydrateFromIndexedDB();

    return () => {
      isMounted = false;
    };
  }, []);

  // One-time, non-destructive migration from the legacy Firestore model to
  // the single-user collections/fields. The legacy data remains in place for
  // compatibility, and the completion flag is written only after a full success.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isFirestoreWriteQuotaExhausted()) return;

    if (localStorage.getItem(DATA_MODEL_MIGRATION_KEY) === '1') {
      return;
    }

    let cancelled = false;

    async function runDataModelMigration() {
      try {
        const result = await migrateLegacyDataModel();
        if (cancelled) return;

        localStorage.setItem(DATA_MODEL_MIGRATION_KEY, '1');
        console.info('System Builder data model migration completed:', result);
      } catch (error) {
        if (isQuotaExceededError(error)) {
          markFirestoreWriteQuotaExhausted();
        }
        // Migration is intentionally best-effort while the app remains backward compatible.
        // A Firestore permission failure must not prevent the dashboard from loading.
        console.warn(
          'System Builder data model migration is pending and will retry later:',
          error
        );
      }
    }

    runDataModelMigration();

    return () => {
      cancelled = true;
    };
  }, []);

  // V11 focused repair: canonicalize historical HabitLogs independently
  // of the broader legacy migration so unrelated collection permissions cannot
  // block habit/day repair.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isFirestoreWriteQuotaExhausted()) return;
    if (localStorage.getItem(HABIT_LOG_REPAIR_KEY) === '1') return;

    let cancelled = false;

    async function repairHabitHistory() {
      try {
        await repairCanonicalHabitLogsAndDays();
        if (!cancelled) {
          localStorage.setItem(HABIT_LOG_REPAIR_KEY, '1');
        }
      } catch (error) {
        if (isQuotaExceededError(error)) {
          markFirestoreWriteQuotaExhausted();
        }
        if (!cancelled) {
          console.warn('Historical HabitLog repair is pending:', error);
        }
      }
    }

    repairHabitHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  // Materialize one HabitLog row for every habit due today, including
  // Iscompleted=false for habits that have not been checked. The hook updates
  // at midnight, so a new day's rows are created without requiring a refresh.
  useEffect(() => {
    if (isFirestoreWriteQuotaExhausted()) return;
    let cancelled = false;

    async function initializeTodayHabitRows() {
      try {
        await initializeDayHabitStatus(currentDateKey);
      } catch (error) {
        if (isQuotaExceededError(error)) {
          markFirestoreWriteQuotaExhausted();
        }
        if (!cancelled) {
          console.warn('Unable to initialize today habit status rows:', error);
        }
      }
    }

    initializeTodayHabitRows();

    return () => {
      cancelled = true;
    };
  }, [currentDateKey]);

  // Background sync for queued offline mutations when online
  useEffect(() => {
    const handleSync = async () => {
      try {
        await processPendingSync({
          addTask: addTaskToCloud,
          updateTask: updateTaskInCloud,
          deleteTask: deleteTaskFromCloud,
          addHabit: addHabitToCloud,
          updateHabit: updateHabitInCloud,
          deleteHabit: deleteHabitFromCloud,
          addRecord: addRecordToCloud,
          updateRecord: updateRecordInCloud,
          deleteRecord: deleteRecordFromCloud,
        });
      } catch (err) {
        console.warn('Background sync for offline queue attempt:', err);
      }
    };

    window.addEventListener('online', handleSync);
    // Also attempt when component mounts in case pending mutations existed from earlier session
    handleSync();

    return () => {
      window.removeEventListener('online', handleSync);
    };
  }, []);

  // Subscribe to real-time Firestore updates for records
  useEffect(() => {
    const unsubscribe = subscribeToRecords(
      (cloudRecords) => {
        if (cloudRecords && cloudRecords.length > 0) {
          setRecords(cloudRecords);
          setCachedRecords(cloudRecords);
        }
      },
      (error) => {
        console.warn('Using IndexedDB/local storage cache for records due to:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Subscribe to real-time Firestore updates for tasks
  useEffect(() => {
    const unsubscribe = subscribeToTasks(
      (cloudTasks) => {
        const pending = pendingTaskMutationsRef.current;
        const merged = new Map(cloudTasks.map((task) => [task.id, task]));

        pending.forEach((mutation, taskId) => {
          const cloudTask = merged.get(taskId);

          if (mutation.kind === 'delete') {
            if (!cloudTask) pending.delete(taskId);
            merged.delete(taskId);
            return;
          }

          if (cloudTask && taskContentMatches(cloudTask, mutation.task)) {
            pending.delete(taskId);
            return;
          }

          merged.set(taskId, mutation.task);
        });

        const nextTasks = Array.from(merged.values()).sort((a, b) =>
          (b.taskKey || '').localeCompare(a.taskKey || '')
        );
        setTasks(nextTasks);
        setCachedTasks(nextTasks);
      },
      (error) => {
        console.warn('Using IndexedDB/local storage cache for tasks due to:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Subscribe to real-time Firestore updates for habits
  useEffect(() => {
    const unsubscribe = subscribeToHabits(
      (cloudHabits) => {
        setHabits(cloudHabits);
        setCachedHabits(cloudHabits);
      },
      (error) => {
        console.warn('Using IndexedDB/local storage cache for habits due to:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Save records to IndexedDB cache
  useEffect(() => {
    if (records.length > 0) {
      setCachedRecords(records);
    }
  }, [records]);

  // Save tasks to IndexedDB cache
  useEffect(() => {
    setCachedTasks(tasks);
  }, [tasks]);

  // Save habits to IndexedDB cache
  useEffect(() => {
    setCachedHabits(habits);
  }, [habits]);

  // Handle record status toggle (Check / Uncheck) with cloud sync
  const handleToggleRecordStatus = async (id: string) => {
    const target = records.find((r) => r.id === id);
    if (!target) return;

    if (!isTodayDate(target.date)) {
      console.warn("Only today's date commitment can be modified. Previous dates are locked.");
      return;
    }

    const nextCompleted = !target.isCompleted;
    const updated: DailyRecord = {
      ...target,
      isCompleted: nextCompleted,
      result: nextCompleted ? 'TRUE' : 'FALSE',
      change: 0,
      updatedAt: new Date().toISOString(),
    };

    const nextRecords = records.map((r) => (r.id === id ? updated : r));
    setRecords(nextRecords);

    try {
      setIsSyncing(true);
      await updateRecordInCloud(updated);
    } catch (e) {
      if (isNetworkOrOfflineError(e)) {
        console.warn('Record status update saved locally in IndexedDB (offline):', e);
        await queueMutation({
          type: 'record_update',
          payload: updated,
          timestamp: Date.now(),
        });
      } else {
        setRecords((prev) =>
          prev.map((record) => (record.id === target.id ? target : record))
        );
        console.error('Error syncing status update to cloud:', e);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Update a single record
  const handleUpdateRecord = async (updatedRecord: DailyRecord) => {
    if (!isTodayDate(updatedRecord.date)) {
      console.warn("Only today's date commitment can be modified. Previous dates are locked.");
      return;
    }

    const previousRecord = records.find((record) => record.id === updatedRecord.id);
    const withTimestamp = {
      ...updatedRecord,
      updatedAt: new Date().toISOString(),
    };

    const nextRecords = records.map((r) =>
      r.id === withTimestamp.id ? withTimestamp : r
    );
    setRecords(nextRecords);

    try {
      setIsSyncing(true);
      await updateRecordInCloud(withTimestamp);
    } catch (e) {
      if (isNetworkOrOfflineError(e)) {
        console.warn('Record update saved locally in IndexedDB (offline):', e);
        await queueMutation({
          type: 'record_update',
          payload: withTimestamp,
          timestamp: Date.now(),
        });
      } else {
        if (previousRecord) {
          setRecords((prev) =>
            prev.map((record) =>
              record.id === previousRecord.id ? previousRecord : record
            )
          );
        }
        console.error('Error syncing record update to cloud:', e);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Add a new record
  const handleAddRecord = async (newRecord: Omit<DailyRecord, 'id'>) => {
    const recordWithId: DailyRecord = {
      ...newRecord,
      id: `record-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      result: newRecord.isCompleted ? 'TRUE' : 'FALSE',
      change: 0,
      updatedAt: new Date().toISOString(),
    };

    const nextRecords = [...records, recordWithId].sort((a, b) => a.day - b.day);
    setRecords(nextRecords);

    try {
      setIsSyncing(true);
      await addRecordToCloud(recordWithId);
    } catch (e) {
      if (isNetworkOrOfflineError(e)) {
        console.warn('Record saved locally in IndexedDB (offline):', e);
        await queueMutation({
          type: 'record_add',
          payload: recordWithId,
          timestamp: Date.now(),
        });
      } else {
        setRecords((prev) =>
          prev.filter((record) => record.id !== recordWithId.id)
        );
        console.error('Error adding record to cloud:', e);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // TASK MANAGEMENT HANDLERS
  // ─────────────────────────────────────────────────────────────

  // Reserve sequential canonical Task IDs (T1, T2, T3...).
  const nextTaskIdRef = useRef(0);

  // Add a new task
  const handleAddTask = async (taskData: Omit<TaskItem, 'id'>) => {
    const normalizedTitle = taskData.taskOfTheDay.trim().replace(/\s+/g, ' ').toLowerCase();
    const normalizedDate = standardizeDate(taskData.taskKey) || taskData.taskKey;
    const logicalCreateKey = `${normalizedDate}::${normalizedTitle}`;

    const duplicateInState = tasks.some(
      (task) =>
        (standardizeDate(task.taskKey) || task.taskKey) === normalizedDate &&
        task.taskOfTheDay.trim().replace(/\s+/g, ' ').toLowerCase() === normalizedTitle
    );

    if (duplicateInState || pendingTaskCreateKeysRef.current.has(logicalCreateKey)) {
      throw new Error(
        `Duplicate task rejected: A task named "${taskData.taskOfTheDay.trim()}" already exists for this date.`
      );
    }

    pendingTaskCreateKeysRef.current.add(logicalCreateKey);

    const highestExistingTaskNumber = tasks.reduce((highest, task) => {
      const match = /^T(\d+)$/i.exec(task.id);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    const nextTaskNumber = Math.max(highestExistingTaskNumber, nextTaskIdRef.current) + 1;
    nextTaskIdRef.current = nextTaskNumber;
    const taskId = `T${nextTaskNumber}`;
    const newTask: TaskItem = {
      ...taskData,
      id: taskId,
      updatedAt: new Date().toISOString(),
    };

    pendingTaskMutationsRef.current.set(taskId, {
      kind: 'upsert',
      task: newTask,
    });

    // Optimistic update: dashboard and Matrix read this same state immediately.
    setTasks((prev) => [newTask, ...prev]);

    try {
      setIsSyncing(true);
      await addTaskToCloud(newTask);
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn('Task saved locally in IndexedDB (offline):', err);
        await queueMutation({
          type: 'task_add',
          payload: newTask,
          timestamp: Date.now(),
        });
      } else {
        pendingTaskMutationsRef.current.delete(taskId);
        // Rollback on non-offline failure
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        throw err;
      }
    } finally {
      pendingTaskCreateKeysRef.current.delete(logicalCreateKey);
      setIsSyncing(false);
    }
  };

  // Update a task (preserves ID and recorded date)
  const handleUpdateTask = async (updatedTask: TaskItem) => {
    const previousTask = tasks.find((task) => task.id === updatedTask.id);
    const optimisticTask: TaskItem = {
      ...updatedTask,
      updatedAt: updatedTask.updatedAt || new Date().toISOString(),
    };

    pendingTaskMutationsRef.current.set(updatedTask.id, {
      kind: 'upsert',
      task: optimisticTask,
    });
    setTasks((prev) =>
      prev.map((task) => (task.id === optimisticTask.id ? optimisticTask : task))
    );

    try {
      setIsSyncing(true);
      await updateTaskInCloud(optimisticTask);
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn('Task update saved locally in IndexedDB (offline):', err);
        await queueMutation({
          type: 'task_update',
          payload: optimisticTask,
          timestamp: Date.now(),
        });
      } else {
        pendingTaskMutationsRef.current.delete(updatedTask.id);
        if (previousTask) {
          setTasks((prev) =>
            prev.map((task) => (task.id === previousTask.id ? previousTask : task))
          );
        }
        throw err;
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete a task
  const handleDeleteTask = async (taskId: string) => {
    const previousTask = tasks.find((task) => task.id === taskId);
    pendingTaskMutationsRef.current.set(taskId, { kind: 'delete' });
    const normalizeAfterDelete = (current: TaskItem[]) => {
      const remaining = current.filter((task) => task.id !== taskId);
      if (!previousTask?.taskKey) return remaining;

      const sameDate = remaining
        .filter((task) => task.taskKey === previousTask.taskKey)
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
      const orderById = new Map(sameDate.map((task, index) => [task.id, index + 1]));

      return remaining.map((task) =>
        task.taskKey === previousTask.taskKey
          ? { ...task, taskOrder: orderById.get(task.id) || 1 }
          : task
      );
    };
    setTasks((prev) => normalizeAfterDelete(prev));
    setCachedTasks(normalizeAfterDelete(tasks));

    try {
      setIsSyncing(true);
      await deleteTaskFromCloud(taskId);
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn('Task deletion saved locally in IndexedDB (offline):', err);
        await queueMutation({
          type: 'task_delete',
          payload: { id: taskId },
          timestamp: Date.now(),
        });
      } else {
        pendingTaskMutationsRef.current.delete(taskId);
        if (previousTask) {
          setTasks((prev) =>
            prev.some((task) => task.id === previousTask.id)
              ? prev
              : [previousTask, ...prev]
          );
        }
        throw err;
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Toggle completion of a task
  const handleToggleTaskStatus = async (taskId: string) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;

    const nextCompleted = !target.isCompleted;
    const updatedTask: TaskItem = {
      ...target,
      isCompleted: nextCompleted,
      completedAt: nextCompleted ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString(),
    };

    pendingTaskMutationsRef.current.set(taskId, {
      kind: 'upsert',
      task: updatedTask,
    });
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? updatedTask : task))
    );

    try {
      setIsSyncing(true);
      await updateTaskInCloud(updatedTask);
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn('Task status update saved locally in IndexedDB (offline):', err);
        await queueMutation({
          type: 'task_update',
          payload: updatedTask,
          timestamp: Date.now(),
        });
      } else {
        pendingTaskMutationsRef.current.delete(taskId);
        setTasks((prev) =>
          prev.map((task) => (task.id === taskId ? target : task))
        );
        throw err;
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddHabit = async (habitData: Omit<HabitItem, 'id'>) => {
    const habit: HabitItem = {
      ...habitData,
      id: String(Math.max(0, ...habits.map((item) => Number.parseInt(item.id, 10)).filter(Number.isFinite)) + 1),
      updatedAt: new Date().toISOString(),
    };
    setHabits((current) => [...current, habit]);
    try {
      setIsSyncing(true);
      await addHabitToCloud(habit);
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn('Habit saved locally in IndexedDB (offline):', err);
        await queueMutation({
          type: 'habit_add',
          payload: habit,
          timestamp: Date.now(),
        });
      } else {
        setHabits((current) =>
          current.filter((item) => item.id !== habit.id)
        );
        console.error('Error adding habit to cloud:', err);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateHabit = async (habit: HabitItem) => {
    const previousHabit = habits.find((item) => item.id === habit.id);
    setHabits((current) => current.map((item) => (item.id === habit.id ? habit : item)));
    try {
      setIsSyncing(true);
      await updateHabitInCloud(habit);
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn('Habit update saved locally in IndexedDB (offline):', err);
        await queueMutation({
          type: 'habit_update',
          payload: habit,
          timestamp: Date.now(),
        });
      } else {
        if (previousHabit) {
          setHabits((current) =>
            current.map((item) =>
              item.id === previousHabit.id ? previousHabit : item
            )
          );
        }
        console.error('Error updating habit in cloud:', err);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleHabitCheckIn = async (habit: HabitItem, isCompleted: boolean) => {
    try {
      setIsSyncing(true);
      await setTodayHabitCheckIn(habit, isCompleted);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteHabit = async (habitId: string) => {
    const previousHabit = habits.find((item) => item.id === habitId);
    setHabits((current) => current.filter((item) => item.id !== habitId));
    try {
      setIsSyncing(true);
      await deleteHabitFromCloud(habitId);
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        console.warn('Habit deletion saved locally in IndexedDB (offline):', err);
        await queueMutation({
          type: 'habit_delete',
          payload: { id: habitId },
          timestamp: Date.now(),
        });
      } else {
        if (previousHabit) {
          setHabits((current) =>
            current.some((item) => item.id === previousHabit.id)
              ? current
              : [...current, previousHabit]
          );
        }
        console.error('Error deleting habit from cloud:', err);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Submit the current-day review into the records table.
  // All tasks and all habits due today checked => Completed.
  const handleSubmitTaskDay = async (
    dateKey: string,
    dayTasks: TaskItem[],
    reviewedHabits?: HabitItem[]
  ): Promise<'COMPLETED' | 'NOT_COMPLETED'> => {
    const todayDateKey = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
    if (!areDatesEqual(dateKey, todayDateKey)) {
      throw new Error('Only the current day can be submitted.');
    }

    const dayHabits =
      reviewedHabits ?? habits.filter((habit) => isHabitDue(habit, dateKey));

    if (dayTasks.length === 0 && dayHabits.length === 0) {
      throw new Error('No tasks or habits are scheduled for today.');
    }

    const completedTaskCount = dayTasks.filter((task) => task.isCompleted).length;
    const completedHabitCount = dayHabits.filter((habit) =>
      habit.checkIns.includes(dateKey)
    ).length;
    const allTasksCompleted =
      dayTasks.length === 0 || completedTaskCount === dayTasks.length;
    const allHabitsCompleted =
      dayHabits.length === 0 || completedHabitCount === dayHabits.length;
    const allCompleted = allTasksCompleted && allHabitsCompleted;
    const formattedDate = formatCalendarDate(dateKey);
    const nowIso = new Date().toISOString();
    const summary = `${completedTaskCount}/${dayTasks.length} tasks • ${completedHabitCount}/${dayHabits.length} habits`;
    const existingRecord = records.find((record) =>
      areDatesEqual(record.date, formattedDate)
    );

    if (existingRecord) {
      const updatedRecord: DailyRecord = {
        ...existingRecord,
        date: standardizeDate(existingRecord.date) || formattedDate,
        isCompleted: allCompleted,
        result: allCompleted ? 'TRUE' : 'FALSE',
        change: 0,
        summary,
        updatedAt: nowIso,
      };

      const previousRecords = [...records];
      setRecords((prev) =>
        prev.map((record) => (record.id === updatedRecord.id ? updatedRecord : record))
      );

      try {
        setIsSyncing(true);
        await updateRecordInCloud(updatedRecord);
      } catch (err) {
        if (isNetworkOrOfflineError(err)) {
          console.warn('Day review update saved locally in IndexedDB (offline):', err);
          await queueMutation({
            type: 'record_update',
            payload: updatedRecord,
            timestamp: Date.now(),
          });
        } else {
          setRecords(previousRecords);
          throw err;
        }
      } finally {
        setIsSyncing(false);
      }
    } else {
      const nextDay =
        records.reduce((maxDay, record) => Math.max(maxDay, Number(record.day) || 0), 0) + 1;
      const newRecord: DailyRecord = {
        id: `record-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        day: nextDay,
        date: formattedDate,
        isCompleted: allCompleted,
        result: allCompleted ? 'TRUE' : 'FALSE',
        change: 0,
        skill: 'Daily Review',
        summary,
        notes: 'Submitted from current-day Review checklist',
        updatedAt: nowIso,
      };

      const previousRecords = [...records];
      setRecords((prev) => [...prev, newRecord].sort((a, b) => a.day - b.day));

      try {
        setIsSyncing(true);
        await addRecordToCloud(newRecord);
      } catch (err) {
        if (isNetworkOrOfflineError(err)) {
          console.warn('Day review record saved locally in IndexedDB (offline):', err);
          await queueMutation({
            type: 'record_add',
            payload: newRecord,
            timestamp: Date.now(),
          });
        } else {
          setRecords(previousRecords);
          throw err;
        }
      } finally {
        setIsSyncing(false);
      }
    }

    return allCompleted ? 'COMPLETED' : 'NOT_COMPLETED';
  };

  const handleOpenLibrary = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/books/cal-newport');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setIsLibraryOpen(true);
  };

  const handleCloseLibrary = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setIsLibraryOpen(false);
  };

  const handleOpenTools = (initialTab: MoreTab = 'data') => {
    setToolsInitialTab(initialTab);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/tools');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setIsLibraryOpen(false);
    setIsToolsOpen(true);
  };

  const handleCloseTools = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setIsToolsOpen(false);
  };

  const handleCloseDayReview = () => {
    setIsDayReviewOpen(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('review')) {
        url.searchParams.delete('review');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
    }
  };

  if (isLibraryOpen) {
    return (
      <>
        <CalNewportLibrary theme={theme} onBack={handleCloseLibrary} externalFocusMode={booksFocusMode} />
        <MobileBottomNav onAdd={() => { handleCloseLibrary(); setTimeout(() => window.dispatchEvent(new CustomEvent('system-builder:open-enter-tasks')), 0); }} onFocus={() => setBooksFocusMode(v => !v)} onPlan={() => handleOpenTools('tasks')} onBooks={handleOpenLibrary} onTop={handleCloseLibrary} />
      </>
    );
  }

  if (isToolsOpen) {
    return (
      <>
      <MoreWorkspace
        theme={theme}
        initialTab={toolsInitialTab}
        onBack={handleCloseTools}
        tasks={tasks}
        habits={habits}
        onAddTask={handleAddTask}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onToggleTaskStatus={handleToggleTaskStatus}
        onAddHabit={handleAddHabit}
        onUpdateHabit={handleUpdateHabit}
        onCheckIn={handleHabitCheckIn}
        onDeleteHabit={handleDeleteHabit}
        isSyncing={isSyncing}
        focusMode={toolsFocusMode}
        onFocusChange={setToolsFocusMode}
      />
      <MobileBottomNav onAdd={() => { handleCloseTools(); setTimeout(() => window.dispatchEvent(new CustomEvent('system-builder:open-enter-tasks')), 0); }} onFocus={() => setToolsFocusMode(v => !v)} onPlan={() => handleOpenTools('tasks')} onBooks={handleOpenLibrary} onTop={handleCloseTools} />
      </>
    );
  }

  const isDark = theme === 'dark';
  const completedDaysForBadge = records.filter((record) => record.isCompleted).length;
  const currentBadge = getBadgeProgress(completedDaysForBadge).current;

  return (
<ToastProvider>
    <div
      className={`system-edition system-app-shell ui-compact min-h-screen flex flex-col font-sans transition-colors duration-200 antialiased ${
        isDark
          ? 'bg-slate-950 text-slate-100 selection:bg-blue-500 selection:text-white'
          : 'bg-[#f6f8ff] text-slate-900 selection:bg-blue-100 selection:text-blue-900'
      }`}
    >
      {/* 1. Clean Navigation Header */}
      {!focusMode && <PowerBiHeader
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenLibrary={handleOpenLibrary}
        onOpenTools={() => handleOpenTools()}
        theme={theme}
        onThemeChange={setTheme}
        totalRecordsCount={records.length}
        currentBadge={currentBadge}
        isSyncing={isSyncing}
        onOpenQuickAdd={() => setIsAddModalOpen(true)}
        onOpenSearch={() => setIsTaskSearchOpen(true)}
        onToggleFocus={() => setFocusMode((value) => !value)}
        focusMode={focusMode}
      />}

      {isQuotaExhausted && (
        <div className="w-full bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">⚠️ Daily Firestore Write Quota Reached:</span>
            <span>The free-tier daily write limit for this Firebase project has been reached. Existing commitments remain readable, and writes will resume after midnight PT.</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://console.firebase.google.com/project/elaborate-lane-2f6jr/firestore/databases/ai-studio-powerbiskillprog-68c6ef1e-cce3-42f5-a93a-7da822711935/data?openUpgradeDialog=true"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100"
            >
              Upgrade in Firebase Console
            </a>
            <button
              type="button"
              onClick={() => setIsQuotaExhausted(false)}
              className="w-5 h-5 rounded-md flex items-center justify-center text-amber-700 dark:text-amber-300 hover:bg-amber-200/50 dark:hover:bg-amber-900/50"
              aria-label="Dismiss banner"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Daily Commitment Dashboard Container */}
      {focusMode && (
        <button
          type="button"
          onClick={() => setFocusMode(false)}
          className="hidden md:inline-flex fixed top-3 right-3 z-[160] w-8 h-8 rounded-full bg-slate-900/20 dark:bg-slate-100/15 text-slate-500/30 dark:text-slate-400/30 items-center justify-center opacity-30 hover:opacity-100 hover:bg-slate-900/90 dark:hover:bg-slate-100 hover:text-white dark:hover:text-slate-900 hover:shadow-md hover:scale-105 transition-all duration-200"
          aria-label="Exit Focus Mode"
          title="Exit Focus Mode"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <main className={`flex-1 w-full mx-auto ${focusMode ? 'max-w-4xl px-3 py-6' : 'max-w-7xl px-2 sm:px-3 lg:px-4 py-3 sm:py-4'}`}>
        <ReportView
          records={records}
          tasks={tasks}
          habits={habits}
          filterState={filterState}
          onFilterChange={(newFilters) =>
            setFilterState((prev) => ({ ...prev, ...newFilters }))
          }
          theme={theme}
          onToggleRecordStatus={handleToggleRecordStatus}
          onUpdateRecord={handleUpdateRecord}
          onOpenAddModal={() => setIsAddModalOpen(true)}
          onAddTask={handleAddTask}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
          onToggleTaskStatus={handleToggleTaskStatus}
          onSubmitTaskDay={handleSubmitTaskDay}
          onOpenDayReview={() => setIsDayReviewOpen(true)}
          isSyncing={isSyncing}
          focusMode={focusMode}
        />
      </main>

      {isTaskSearchOpen && <TaskSearchDialog tasks={tasks} onClose={() => setIsTaskSearchOpen(false)} />}

      {isCommandPaletteOpen && <CommandPalette onClose={() => setIsCommandPaletteOpen(false)} onAdd={() => setIsAddModalOpen(true)} onSearch={() => setIsTaskSearchOpen(true)} onFocus={() => setFocusMode(v => !v)} onTools={() => handleOpenTools()} />}
      <MobileBottomNav onAdd={() => window.dispatchEvent(new CustomEvent('system-builder:open-enter-tasks'))} onFocus={() => setFocusMode(v => !v)} onPlan={() => handleOpenTools('tasks')} onBooks={handleOpenLibrary} onTop={() => window.scrollTo({top:0,behavior:'smooth'})} />

      {/* 3. Add Record Modal */}
      <AddRecordModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddRecord={handleAddRecord}
        theme={theme}
        existingRecords={records}
      />

      {/* 5. Header-triggered current-day review */}
      <DayReviewModal
        isOpen={isDayReviewOpen}
        tasks={tasks}
        habits={habits}
        theme={theme}
        isSyncing={isSyncing}
        onClose={handleCloseDayReview}
        onToggleTaskStatus={handleToggleTaskStatus}
        onUpdateHabit={handleUpdateHabit}
        onSubmitTaskDay={handleSubmitTaskDay}
      />
    </div>
    </ToastProvider>
  );
}
