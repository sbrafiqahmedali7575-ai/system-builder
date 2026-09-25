import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { DailyRecord, FilterState, DashboardTheme, TaskItem } from './types';
import { INITIAL_RECORDS } from './data/initialData';
import { PowerBiHeader } from './components/PowerBiHeader';
import { ReportView } from './components/ReportView';
import { AddRecordModal } from './components/AddRecordModal';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { ConfirmationPage } from './components/ConfirmationPage';
import { isTodayDate } from './utils/dateUtils';
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
  subscribeToAuthState,
  signInWithAccessKey,
  signOutOwner,
} from './services/firebaseService';

const STORAGE_KEY = 'RAFIQ_DAILY_COMMITMENT_RECORDS_V2';
const TASKS_STORAGE_KEY = 'SYSTEM_BUILDER_TASKS_CACHE_V2';
const TASKS_LEGACY_STORAGE_KEY = 'COMMITDAILY_TASKS_CACHE_V2';

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessKey, setAccessKey] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

  // Filter state for report view
  const [filterState, setFilterState] = useState<FilterState>({
    status: 'ALL',
    searchQuery: '',
    dateRange: 'ALL',
  });

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

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

  // Subscribe to real-time Firestore updates for records only after owner authentication.
  useEffect(() => {
    if (!authUser) return;

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
  }, [authUser]);

  // Subscribe to real-time Firestore updates for tasks only after owner authentication.
  useEffect(() => {
    if (!authUser) return;

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
  }, [authUser]);

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

  const handleOwnerSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accessKey.trim()) return;

    try {
      setAuthSubmitting(true);
      setAuthError(null);
      await signInWithAccessKey(accessKey.trim());
      setAccessKey('');
    } catch (err: any) {
      setAuthError(err?.message || 'Unable to sign in.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleOwnerSignOut = async () => {
    try {
      await signOutOwner();
      setRecords([]);
      setTasks([]);
    } catch (err) {
      console.error('Unable to sign out:', err);
    }
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="text-sm font-semibold text-slate-400">Opening System Builder…</div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <form
          onSubmit={handleOwnerSignIn}
          className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl"
        >
          <div className="mb-4">
            <h1 className="text-xl font-black text-white">System Builder</h1>
            <p className="mt-1 text-sm text-slate-400">
              Enter your private owner access key to continue.
            </p>
          </div>

          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Access Key
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={accessKey}
            onChange={(event) => setAccessKey(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-blue-500"
            placeholder="Private access key"
            autoFocus
          />

          {authError && (
            <p className="mt-2 text-xs font-semibold text-rose-400">{authError}</p>
          )}

          <button
            type="submit"
            disabled={authSubmitting || !accessKey.trim()}
            className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {authSubmitting ? 'Signing in…' : 'Open Dashboard'}
          </button>
        </form>
      </div>
    );
  }

  const isDark = theme === 'dark';
  const completedDaysForBadge = records.filter((record) => record.isCompleted).length;
  const currentBadge = getBadgeProgress(completedDaysForBadge).current;

  return (
    <div
      className={`ninja-edition ninja-app-shell ui-compact min-h-screen flex flex-col font-sans transition-colors duration-200 antialiased ${
        isDark
          ? 'bg-slate-950 text-slate-100 selection:bg-blue-500 selection:text-white'
          : 'bg-[#f6f8ff] text-slate-900 selection:bg-blue-100 selection:text-blue-900'
      }`}
    >
      {/* 1. Clean Navigation Header */}
      <PowerBiHeader
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenNotificationModal={() => setIsNotificationModalOpen(true)}
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

      <button
        type="button"
        onClick={handleOwnerSignOut}
        className="fixed bottom-2 right-2 z-40 rounded-lg border border-slate-300/70 bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-500 shadow-sm backdrop-blur hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400 dark:hover:text-white"
      >
        Sign out
      </button>
    </div>
  );
}
