import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { DailyRecord, DashboardTheme, HabitItem, TaskItem, DayProgressStats, DaySubmitResult } from './types';
import { INITIAL_RECORDS } from './data/initialData';
import { PowerBiHeader } from './components/PowerBiHeader';
import { ReportView } from './components/ReportView';
import { DayReviewModal } from './components/DayReviewModal';
import { CalNewportLibrary } from './components/CalNewportLibrary';
import { MoreWorkspace, type MoreTab } from './components/MoreWorkspace';
import { TaskSearchDialog } from './components/TaskSearchDialog';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileBrandHeader } from './components/MobileBrandHeader';
import { CommandPalette } from './components/CommandPalette';
import { ToastProvider } from './components/ui/ToastProvider';
import { FeedbackDiagnosticsPanel } from './components/FeedbackDiagnosticsPanel';
import { standardizeDate } from './utils/dateUtils';
import { areDatesEqual, CONFIGURED_TIMEZONE, formatCalendarDate, getIsoDateKeyInTimezone } from './utils/taskDateUtils';
import { calculateKPIStats } from './utils/daxMeasures';
import { calculateAchievedWeeks } from './utils/progressAnalytics';
import { isHabitDue } from './utils/habitUtils';
import {
  addRecordToCloud,
  updateRecordInCloud,
  addTaskToCloud,
  updateTaskInCloud,
  deleteTaskFromCloud,
  addHabitToCloud,
  updateHabitInCloud,
  setTodayHabitCheckIn,
  deleteHabitFromCloud,
  isFirestoreWriteQuotaExhausted,
} from './services/firebaseService';
import {
  setCachedRecords,
  setCachedTasks,
  setCachedHabits,
  queueMutation,
  isNetworkOrOfflineError,
} from './services/offlineStorage';
import { useSystemDataLifecycle, type PendingTaskMutation } from './hooks/useSystemDataLifecycle';
import { useCurrentDateKey } from './hooks/useCurrentDateKey';
import { playInteractionFeedback } from './utils/interactionFeedback';

const STORAGE_KEY = 'RAFIQ_DAILY_COMMITMENT_RECORDS_V2';
const TASKS_STORAGE_KEY = 'SYSTEM_BUILDER_TASKS_CACHE_V2';
const TASKS_LEGACY_STORAGE_KEY = 'COMMITDAILY_TASKS_CACHE_V2';
const HABITS_STORAGE_KEY = 'SYSTEM_BUILDER_HABITS_CACHE_V1';

const buildDayProgressStats = (
  recordSnapshot: DailyRecord[],
  taskSnapshot: TaskItem[],
  currentDateKey: string
): DayProgressStats => {
  const kpis = calculateKPIStats(recordSnapshot, currentDateKey);
  return {
    successfulDays: kpis.completedDays,
    currentStreak: kpis.currentStreak,
    achievedWeeks: calculateAchievedWeeks(taskSnapshot, currentDateKey),
    bestStreak: kpis.maxStreak,
  };
};

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
  const pendingHabitCreateNamesRef = useRef<Set<string>>(new Set());
  const currentDateKey = useCurrentDateKey(CONFIGURED_TIMEZONE);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [theme, setTheme] = useState<DashboardTheme>('modern');
  const [isTaskSearchOpen, setIsTaskSearchOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [toolsFocusMode, setToolsFocusMode] = useState(false);
  const [booksFocusMode, setBooksFocusMode] = useState(false);
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
  const [isQuotaExhausted, setIsQuotaExhausted] = useState(() => isFirestoreWriteQuotaExhausted());

  useEffect(() => {
    const onQuotaExceeded = () => setIsQuotaExhausted(true);
    window.addEventListener('system-builder:quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('system-builder:quota-exceeded', onQuotaExceeded);
  }, []);

  useEffect(() => {
    const returnToDashboardForShortcut = (afterReturn: () => void) => {
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.history.pushState({}, '', '/');
      }
      setBooksFocusMode(false);
      setToolsFocusMode(false);
      setIsLibraryOpen(false);
      setIsToolsOpen(false);
      window.setTimeout(afterReturn, 0);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT' || target?.isContentEditable;
      const awayFromDashboard = isLibraryOpen || isToolsOpen;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (awayFromDashboard) {
          returnToDashboardForShortcut(() => setIsCommandPaletteOpen(true));
        } else {
          setIsCommandPaletteOpen(true);
        }
        return;
      }
      if (event.key === 'Escape') {
        setIsTaskSearchOpen(false);
        return;
      }
      if (typing) return;
      if (event.key === '/') {
        event.preventDefault();
        if (awayFromDashboard) {
          returnToDashboardForShortcut(() => setIsTaskSearchOpen(true));
        } else {
          setIsTaskSearchOpen(true);
        }
      } else if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        const openEnterTasks = () =>
          window.dispatchEvent(new CustomEvent('system-builder:open-enter-tasks'));
        if (awayFromDashboard) {
          returnToDashboardForShortcut(openEnterTasks);
        } else {
          openEnterTasks();
        }
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        if (isLibraryOpen) setBooksFocusMode((value) => !value);
        else if (isToolsOpen) setToolsFocusMode((value) => !value);
        else setFocusMode((value) => !value);
      } else if (event.key.toLowerCase() === 't') {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isLibraryOpen, isToolsOpen]);

  // Listen to popstate in case of browser navigation
  useEffect(() => {
    const handleLocationChange = () => {
      const params = new URLSearchParams(window.location.search);
      setIsLibraryOpen(window.location.pathname === '/books/cal-newport');
      setIsToolsOpen(window.location.pathname === '/tools');
      setIsDayReviewOpen(params.get('review') === '1');
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  useSystemDataLifecycle({
    currentDateKey,
    pendingTaskMutationsRef,
    setRecords,
    setTasks,
    setHabits,
  });

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
      playInteractionFeedback('error');
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
    playInteractionFeedback('success');

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
    playInteractionFeedback('delete');

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
    playInteractionFeedback(nextCompleted ? 'complete' : 'toggleOff');

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
    const normalizedName = habitData.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    if (!normalizedName) throw new Error('Habit name cannot be empty.');
    const duplicateInState = habits.some(
      (item) => item.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase() === normalizedName
    );
    if (duplicateInState || pendingHabitCreateNamesRef.current.has(normalizedName)) {
      playInteractionFeedback('error');
      throw new Error(`Duplicate habit rejected: A habit named "${habitData.name.trim()}" already exists.`);
    }
    pendingHabitCreateNamesRef.current.add(normalizedName);
    const habit: HabitItem = {
      ...habitData,
      name: habitData.name.trim().replace(/\s+/g, ' '),
      id: String(Math.max(0, ...habits.map((item) => Number.parseInt(item.id, 10)).filter(Number.isFinite)) + 1),
      updatedAt: new Date().toISOString(),
    };
    setHabits((current) => [...current, habit]);
    playInteractionFeedback('success');
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
        setHabits((current) => current.filter((item) => item.id !== habit.id));
        throw err;
      }
    } finally {
      pendingHabitCreateNamesRef.current.delete(normalizedName);
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
      playInteractionFeedback(isCompleted ? 'complete' : 'toggleOff');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteHabit = async (habitId: string) => {
    const previousHabit = habits.find((item) => item.id === habitId);
    setHabits((current) => current.filter((item) => item.id !== habitId));
    playInteractionFeedback('delete');
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
  // IsdayCompleted is task-driven: all scheduled tasks checked => Completed.
  // Habits are still reviewed and stored, but do not decide the day result.
  const handleSubmitTaskDay = async (
    dateKey: string,
    dayTasks: TaskItem[],
    reviewedHabits?: HabitItem[]
  ): Promise<DaySubmitResult> => {
    const todayDateKey = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
    if (!areDatesEqual(dateKey, todayDateKey)) {
      playInteractionFeedback('error');
      throw new Error('Only the current day can be submitted.');
    }

    const dayHabits =
      reviewedHabits ?? habits.filter((habit) => isHabitDue(habit, dateKey));

    if (dayTasks.length === 0 && dayHabits.length === 0) {
      playInteractionFeedback('warning');
      throw new Error('No tasks or habits are scheduled for today.');
    }

    const completedTaskCount = dayTasks.filter((task) => task.isCompleted).length;
    const completedHabitCount = dayHabits.filter((habit) =>
      habit.checkIns.includes(dateKey)
    ).length;
    const allCompleted =
      dayTasks.length > 0 && completedTaskCount === dayTasks.length;

    const formattedDate = formatCalendarDate(dateKey);
    const nowIso = new Date().toISOString();
    const summary = `${completedTaskCount}/${dayTasks.length} tasks • ${completedHabitCount}/${dayHabits.length} habits`;
    const existingRecord = records.find((record) =>
      areDatesEqual(record.date, formattedDate)
    );

    const previousStatus: DaySubmitResult['previousStatus'] = existingRecord
      ? existingRecord.isCompleted
        ? 'COMPLETED'
        : 'NOT_COMPLETED'
      : null;

    const statsBefore = buildDayProgressStats(records, tasks, todayDateKey);

    const reviewedTaskMap = new Map(dayTasks.map((task) => [task.id, task]));
    const tasksAfter = tasks.map((task) => reviewedTaskMap.get(task.id) ?? task);

    let recordsAfter: DailyRecord[];

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

      recordsAfter = records.map((record) =>
        record.id === updatedRecord.id ? updatedRecord : record
      );
      const previousRecords = [...records];
      setRecords(recordsAfter);

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

      recordsAfter = [...records, newRecord].sort((a, b) => a.day - b.day);
      const previousRecords = [...records];
      setRecords(recordsAfter);

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

    const status: DaySubmitResult['status'] = allCompleted
      ? 'COMPLETED'
      : 'NOT_COMPLETED';
    const statsAfter = buildDayProgressStats(
      recordsAfter,
      tasksAfter,
      todayDateKey
    );

    playInteractionFeedback(allCompleted ? 'complete' : 'warning');

    return {
      status,
      previousStatus,
      isNewSuccess: status === 'COMPLETED' && previousStatus !== 'COMPLETED',
      statsBefore,
      statsAfter,
    };
  };

  const handleOpenLibrary = () => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname !== '/books/cal-newport') {
        window.history.pushState({}, '', '/books/cal-newport');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setToolsFocusMode(false);
    setIsToolsOpen(false);
    setIsLibraryOpen(true);
  };

  const handleCloseLibrary = () => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setBooksFocusMode(false);
    setIsLibraryOpen(false);
  };

  const handleOpenTools = (initialTab: MoreTab = 'data') => {
    setToolsInitialTab(initialTab);
    if (typeof window !== 'undefined') {
      if (window.location.pathname !== '/tools') {
        window.history.pushState({}, '', '/tools');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setBooksFocusMode(false);
    setIsLibraryOpen(false);
    setIsToolsOpen(true);
  };

  const handleCloseTools = () => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setToolsFocusMode(false);
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
        <MobileBrandHeader isSyncing={isSyncing} />
        <CalNewportLibrary theme={theme} onBack={handleCloseLibrary} focusMode={booksFocusMode} onFocusChange={setBooksFocusMode} />
        <MobileBottomNav activeSection="books" focusActive={booksFocusMode} onAdd={() => { handleCloseLibrary(); setTimeout(() => window.dispatchEvent(new CustomEvent('system-builder:open-enter-tasks')), 0); }} onFocus={() => setBooksFocusMode(v => !v)} onPlan={() => handleOpenTools('tasks')} onBooks={handleOpenLibrary} onTop={handleCloseLibrary} />
      </>
    );
  }

  if (isToolsOpen) {
    return (
      <>
      <MobileBrandHeader isSyncing={isSyncing} />
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
      <MobileBottomNav activeSection="plan" focusActive={toolsFocusMode} onAdd={() => { handleCloseTools(); setTimeout(() => window.dispatchEvent(new CustomEvent('system-builder:open-enter-tasks')), 0); }} onFocus={() => setToolsFocusMode(v => !v)} onPlan={() => handleOpenTools('tasks')} onBooks={handleOpenLibrary} onTop={handleCloseTools} />
      </>
    );
  }

  const isDark = theme === 'dark';
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
        onOpenLibrary={handleOpenLibrary}
        onOpenTools={() => handleOpenTools()}
        isSyncing={isSyncing}
        onToggleFocus={() => setFocusMode((value) => !value)}
        focusMode={focusMode}
      />}
      <MobileBrandHeader isSyncing={isSyncing} />

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

      <main className={`flex-1 w-full mx-auto pb-20 md:pb-0 ${focusMode ? 'max-w-4xl px-3 pt-6 md:py-6' : 'max-w-7xl px-2 sm:px-3 lg:px-4 pt-3 sm:pt-4 md:py-4'}`}>
        <ReportView
          records={records}
          tasks={tasks}
          habits={habits}
          theme={theme}
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

      {isCommandPaletteOpen && <CommandPalette onClose={() => setIsCommandPaletteOpen(false)} onAdd={() => window.dispatchEvent(new CustomEvent('system-builder:open-enter-tasks'))} onSearch={() => setIsTaskSearchOpen(true)} onFocus={() => setFocusMode(v => !v)} onCalendar={() => handleOpenTools('tasks')} onTools={() => handleOpenTools()} />}
      <MobileBottomNav activeSection="today" focusActive={focusMode} onAdd={() => window.dispatchEvent(new CustomEvent('system-builder:open-enter-tasks'))} onFocus={() => setFocusMode(v => !v)} onPlan={() => handleOpenTools('tasks')} onBooks={handleOpenLibrary} onTop={() => window.scrollTo({top:0,behavior:'smooth'})} />

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
          <FeedbackDiagnosticsPanel />
    </ToastProvider>
  );
}
