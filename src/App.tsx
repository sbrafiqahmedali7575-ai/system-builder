import React, { useState, useEffect } from 'react';
import { DailyRecord, FilterState, DashboardTheme, TaskItem } from './types';
import { INITIAL_RECORDS } from './data/initialData';
import { PowerBiHeader } from './components/PowerBiHeader';
import { ReportView } from './components/ReportView';
import { AddRecordModal } from './components/AddRecordModal';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { ConfirmationPage } from './components/ConfirmationPage';
import { DayReviewModal } from './components/DayReviewModal';
import { isTodayDate, standardizeDate } from './utils/dateUtils';
import { areDatesEqual, CONFIGURED_TIMEZONE, formatCalendarDate, getIsoDateKeyInTimezone } from './utils/taskDateUtils';
import { getBadgeProgress } from './utils/badgeSystem';
import {
  subscribeToRecords,
  addRecordToCloud,
  updateRecordInCloud,
  deleteRecordFromCloud,
  subscribeToTasks,
  addTaskToCloud,
  updateTaskInCloud,
  deleteTaskFromCloud,
} from './services/firebaseService';

const STORAGE_KEY = 'RAFIQ_DAILY_COMMITMENT_RECORDS_V2';
const TASKS_STORAGE_KEY = 'SYSTEM_BUILDER_TASKS_CACHE_V2';
const TASKS_LEGACY_STORAGE_KEY = 'COMMITDAILY_TASKS_CACHE_V2';

export default function App() {
  // Check if current URL is a secure confirmation link
  const [confirmToken, setConfirmToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('token');
    }
    return null;
  });

  const [confirmAction, setConfirmAction] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('action') || undefined;
    }
    return undefined;
  });

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

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [theme, setTheme] = useState<DashboardTheme>('modern');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState<boolean>(false);
  const [isDayReviewOpen, setIsDayReviewOpen] = useState<boolean>(false);

  // Filter state for report view
  const [filterState, setFilterState] = useState<FilterState>({
    status: 'ALL',
    searchQuery: '',
    dateRange: 'ALL',
  });

  // Listen to popstate in case of browser navigation
  useEffect(() => {
    const handleLocationChange = () => {
      const params = new URLSearchParams(window.location.search);
      setConfirmToken(params.get('token'));
      setConfirmAction(params.get('action') || undefined);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Subscribe to real-time Firestore updates for records
  useEffect(() => {
    const unsubscribe = subscribeToRecords(
      (cloudRecords) => {
        if (cloudRecords && cloudRecords.length > 0) {
          setRecords(cloudRecords);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudRecords));
        }
      },
      (error) => {
        console.warn('Using local storage fallback for records due to:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Subscribe to real-time Firestore updates for tasks
  useEffect(() => {
    const unsubscribe = subscribeToTasks(
      (cloudTasks) => {
        setTasks(cloudTasks);
        localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(cloudTasks));
      },
      (error) => {
        console.warn('Using local storage fallback for tasks due to:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Save records to local cache as immediate offline persistence
  useEffect(() => {
    if (records.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }
  }, [records]);

  // Save tasks to local cache as immediate offline persistence
  useEffect(() => {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

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
      console.error('Error syncing status update to cloud:', e);
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
      console.error('Error syncing record update to cloud:', e);
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
      console.error('Error adding record to cloud:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // TASK MANAGEMENT HANDLERS
  // ─────────────────────────────────────────────────────────────

  // Add a new task
  const handleAddTask = async (taskData: Omit<TaskItem, 'id'>) => {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const newTask: TaskItem = {
      ...taskData,
      id: taskId,
      updatedAt: new Date().toISOString(),
    };

    // Optimistic update
    setTasks((prev) => [newTask, ...prev]);

    try {
      setIsSyncing(true);
      await addTaskToCloud(newTask);
    } catch (err) {
      // Rollback on failure
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // Update a task (preserves ID and recorded date)
  const handleUpdateTask = async (updatedTask: TaskItem) => {
    const previousTasks = [...tasks];
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));

    try {
      setIsSyncing(true);
      await updateTaskInCloud(updatedTask);
    } catch (err) {
      // Rollback on failure
      setTasks(previousTasks);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete a task
  const handleDeleteTask = async (taskId: string) => {
    const previousTasks = [...tasks];
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      setIsSyncing(true);
      await deleteTaskFromCloud(taskId);
    } catch (err) {
      // Rollback on failure
      setTasks(previousTasks);
      throw err;
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

    const previousTasks = [...tasks];
    setTasks((prev) => prev.map((t) => (t.id === taskId ? updatedTask : t)));

    try {
      setIsSyncing(true);
      await updateTaskInCloud(updatedTask);
    } catch (err) {
      // Rollback on failure
      setTasks(previousTasks);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // Submit the selected day's task response into the records table.
  // All tasks checked => Completed; otherwise => Not Completed.
  const handleSubmitTaskDay = async (
    dateKey: string,
    dayTasks: TaskItem[]
  ): Promise<'COMPLETED' | 'NOT_COMPLETED'> => {
    const todayDateKey = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
    if (!areDatesEqual(dateKey, todayDateKey)) {
      throw new Error('Only the current day can be submitted.');
    }

    if (dayTasks.length === 0) {
      throw new Error('No tasks were created for today. The day will default to Not Completed.');
    }

    const allCompleted = dayTasks.every((task) => task.isCompleted);
    const completedCount = dayTasks.filter((task) => task.isCompleted).length;
    const formattedDate = formatCalendarDate(dateKey);
    const nowIso = new Date().toISOString();
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
        summary: `${completedCount}/${dayTasks.length} tasks completed`,
        responseSubmittedAt: nowIso,
        responseSource: 'APP',
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
        setRecords(previousRecords);
        throw err;
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
        skill: 'Daily Tasks',
        summary: `${completedCount}/${dayTasks.length} tasks completed`,
        notes: 'Submitted from Today Tasks card',
        responseSubmittedAt: nowIso,
        responseSource: 'APP',
        updatedAt: nowIso,
      };

      const previousRecords = [...records];
      setRecords((prev) => [...prev, newRecord].sort((a, b) => a.day - b.day));

      try {
        setIsSyncing(true);
        await addRecordToCloud(newRecord);
      } catch (err) {
        setRecords(previousRecords);
        throw err;
      } finally {
        setIsSyncing(false);
      }
    }

    return allCompleted ? 'COMPLETED' : 'NOT_COMPLETED';
  };

  const handleReturnToDashboard = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }
    setConfirmToken(null);
  };

  // If user arrives via confirmation email token link, show confirmation screen
  if (confirmToken) {
    return (
      <ConfirmationPage
        token={confirmToken}
        initialAction={confirmAction}
        theme={theme}
        onReturnToDashboard={handleReturnToDashboard}
      />
    );
  }

  const isDark = theme === 'dark';
  const completedDaysForBadge = records.filter((record) => record.isCompleted).length;
  const currentBadge = getBadgeProgress(completedDaysForBadge).current;

  return (
    <div
      className={`system-edition system-app-shell ui-compact min-h-screen flex flex-col font-sans transition-colors duration-200 antialiased ${
        isDark
          ? 'bg-slate-950 text-slate-100 selection:bg-blue-500 selection:text-white'
          : 'bg-[#f6f8ff] text-slate-900 selection:bg-blue-100 selection:text-blue-900'
      }`}
    >
      {/* 1. Clean Navigation Header */}
      <PowerBiHeader
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenNotificationModal={() => setIsNotificationModalOpen(true)}
        onOpenDayReview={() => setIsDayReviewOpen(true)}
        theme={theme}
        onThemeChange={setTheme}
        totalRecordsCount={records.length}
        currentBadge={currentBadge}
        isSyncing={isSyncing}
      />

      {/* 2. Main Daily Commitment Dashboard Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-2 sm:px-3 lg:px-4 py-3 sm:py-4">
        <ReportView
          records={records}
          tasks={tasks}
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
          isSyncing={isSyncing}
        />
      </main>

      {/* 3. Add Record Modal */}
      <AddRecordModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddRecord={handleAddRecord}
        theme={theme}
        existingRecords={records}
      />

      {/* 4. Daily Email Notification Settings Modal */}
      <NotificationSettingsModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        theme={theme}
      />

      {/* 5. Header-triggered current-day review */}
      <DayReviewModal
        isOpen={isDayReviewOpen}
        tasks={tasks}
        theme={theme}
        isSyncing={isSyncing}
        onClose={() => setIsDayReviewOpen(false)}
        onToggleTaskStatus={handleToggleTaskStatus}
        onSubmitTaskDay={handleSubmitTaskDay}
      />
    </div>
  );
}
