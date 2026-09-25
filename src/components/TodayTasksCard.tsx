import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Check,
  CheckCircle2,
  Circle,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  Loader2,
  ListTodo,
  CalendarDays,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { TaskItem, DashboardTheme } from '../types';
import {
  CONFIGURED_TIMEZONE,
  getUpcomingDateOptions,
  formatCalendarDate,
  areDatesEqual,
} from '../utils/taskDateUtils';
import confetti from 'canvas-confetti';

interface TodayTasksCardProps {
  tasks: TaskItem[];
  theme: DashboardTheme;
  onAddTask: (task: Omit<TaskItem, 'id'>) => Promise<void>;
  onUpdateTask: (task: TaskItem) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onToggleTaskStatus: (taskId: string) => Promise<void>;
  isSyncing?: boolean;
}

export const TodayTasksCard: React.FC<TodayTasksCardProps> = ({
  tasks,
  theme,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onToggleTaskStatus,
  isSyncing = false,
}) => {
  const isDark = theme === 'dark';

  // Keep the main task view intentionally focused on only Today and Tomorrow.
  // Refresh the date options periodically so a tab left open across midnight
  // automatically rolls over to the new Today/Tomorrow dates.
  const [dateRefreshKey, setDateRefreshKey] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDateRefreshKey((value) => value + 1);
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  const upcomingOptions = useMemo(
    () => getUpcomingDateOptions(CONFIGURED_TIMEZONE),
    [dateRefreshKey]
  );
  const todayOption = upcomingOptions[0];
  const tomorrowOption = upcomingOptions[1];

  const [activeDateTab, setActiveDateTab] = useState<'TODAY' | 'TOMORROW'>('TODAY');

  // Compute currently active dateKey
  const activeDateKey = useMemo(() => {
    return activeDateTab === 'TODAY' ? todayOption.dateKey : tomorrowOption.dateKey;
  }, [activeDateTab, todayOption.dateKey, tomorrowOption.dateKey]);

  // Compute active formatted calendar date (e.g. "24-Sep-2026")
  const activeFormattedDate = useMemo(() => {
    return formatCalendarDate(activeDateKey);
  }, [activeDateKey]);

  const activeFullDayName = useMemo(() => {
    const [year, month, day] = activeDateKey.split('-').map(Number);
    if (!year || !month || !day) return '';
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }, [activeDateKey]);

  // Relative label for currently active date
  const activeDateLabel = activeDateTab === 'TODAY' ? 'Today' : 'Tomorrow';

  // Filter tasks for the active date
  const dateTasks = useMemo(() => {
    return tasks.filter((t) => areDatesEqual(t.taskKey, activeDateKey));
  }, [tasks, activeDateKey]);

  // Split and order tasks: incomplete first, completed below
  const incompleteTasks = useMemo(() => dateTasks.filter((t) => !t.isCompleted), [dateTasks]);
  const completedTasks = useMemo(() => dateTasks.filter((t) => t.isCompleted), [dateTasks]);
  const sortedTasks = useMemo(() => [...incompleteTasks, ...completedTasks], [incompleteTasks, completedTasks]);

  const totalTasksCount = dateTasks.length;
  const completedCount = completedTasks.length;
  const progressPercent = totalTasksCount > 0 ? Math.round((completedCount / totalTasksCount) * 100) : 0;

  // UI state for "Enter Tasks" panel
  const [isEnterPanelOpen, setIsEnterPanelOpen] = useState(false);
  // Panel date selection mirrors the two main tabs.
  const [panelDateTab, setPanelDateTab] = useState<'TODAY' | 'TOMORROW'>('TODAY');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [recentlyAddedInSession, setRecentlyAddedInSession] = useState<string[]>([]);
  const taskInputRef = useRef<HTMLInputElement>(null);

  // UI state for Editing a Task
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCompleted, setEditCompleted] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // UI state for Deleting a Task confirmation
  const [deletingTask, setDeletingTask] = useState<TaskItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // General feedback status (e.g. "Saving...")
  const [savingStatusMsg, setSavingStatusMsg] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);

  // Compute panel target dateKey
  const panelTargetDateKey = useMemo(() => {
    return panelDateTab === 'TODAY' ? todayOption.dateKey : tomorrowOption.dateKey;
  }, [panelDateTab, todayOption.dateKey, tomorrowOption.dateKey]);

  const panelTargetFormattedDate = useMemo(() => {
    return formatCalendarDate(panelTargetDateKey);
  }, [panelTargetDateKey]);

  const panelTargetRelativeLabel = panelDateTab === 'TODAY' ? 'Today' : 'Tomorrow';

  // Open Enter Tasks panel
  const handleOpenEnterPanel = (preselectedTab?: 'TODAY' | 'TOMORROW') => {
    const tabToUse = preselectedTab || activeDateTab;
    setPanelDateTab(tabToUse);
    setNewTaskTitle('');
    setPanelError(null);
    setRecentlyAddedInSession([]);
    setIsEnterPanelOpen(true);
  };

  // Focus input when Enter panel opens
  useEffect(() => {
    if (isEnterPanelOpen) {
      setTimeout(() => {
        taskInputRef.current?.focus();
      }, 100);
    }
  }, [isEnterPanelOpen]);

  // Add Task inside "Enter Tasks" panel
  const handleCreateTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedTitle = newTaskTitle.trim();
    if (!trimmedTitle) {
      setPanelError('Please enter a task title before adding.');
      return;
    }

    // Guard: duplicate within same date
    const duplicate = tasks.find(
      (t) =>
        areDatesEqual(t.taskKey, panelTargetDateKey) &&
        t.taskOfTheDay.trim().toLowerCase() === trimmedTitle.toLowerCase()
    );
    if (duplicate) {
      setPanelError(`A task titled "${trimmedTitle}" already exists for ${panelTargetFormattedDate}.`);
      return;
    }

    try {
      setIsAddingTask(true);
      setPanelError(null);
      await onAddTask({
        taskKey: panelTargetDateKey,
        taskOfTheDay: trimmedTitle,
        isCompleted: false,
        priority: 'Normal',
        category: 'General',
      });

      // Keep panel open, add to session list, clear input and refocus!
      setRecentlyAddedInSession((prev) => [trimmedTitle, ...prev]);
      setNewTaskTitle('');
      setTimeout(() => {
        taskInputRef.current?.focus();
      }, 50);
    } catch (err: any) {
      console.error('Error adding task:', err);
      setPanelError(err?.message || 'Failed to add task. Please check connection and try again.');
    } finally {
      setIsAddingTask(false);
    }
  };

  // Toggle completion status of a task
  const handleToggleTask = async (task: TaskItem) => {
    try {
      setCardError(null);
      setSavingStatusMsg(`Updating "${task.taskOfTheDay}"...`);

      const willBeCompleted = !task.isCompleted;
      if (willBeCompleted && incompleteTasks.length === 1 && incompleteTasks[0].id === task.id) {
        try {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#2563eb', '#ef4444', '#fbbf24'],
          });
        } catch (_) {}
      }

      await onToggleTaskStatus(task.id);
      setSavingStatusMsg(null);
    } catch (err: any) {
      console.error('Error toggling task:', err);
      setSavingStatusMsg(null);
      setCardError(err?.message || 'Failed to update task completion status.');
    }
  };

  // Open Edit Task modal
  const handleStartEdit = (task: TaskItem) => {
    setEditingTask(task);
    setEditTitle(task.taskOfTheDay);
    setEditCompleted(task.isCompleted);
    setEditError(null);
  };

  // Save Task Edit (preserves ID and taskKey)
  const handleSaveEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingTask) return;

    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      setEditError('Task title cannot be empty.');
      return;
    }

    try {
      setIsSavingEdit(true);
      setEditError(null);

      // Explicitly preserve ID and recorded dateKey
      const updated: TaskItem = {
        ...editingTask,
        taskOfTheDay: trimmedTitle,
        isCompleted: editCompleted,
        updatedAt: new Date().toISOString(),
        completedAt: editCompleted ? editingTask.completedAt || new Date().toISOString() : undefined,
      };

      await onUpdateTask(updated);
      setEditingTask(null);
    } catch (err: any) {
      console.error('Error saving task edit:', err);
      setEditError(err?.message || 'Failed to save changes. Please try again.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Confirm Task Deletion
  const handleConfirmDelete = async () => {
    if (!deletingTask) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await onDeleteTask(deletingTask.id);
      setDeletingTask(null);
    } catch (err: any) {
      console.error('Error deleting task:', err);
      setDeleteError(err?.message || 'Failed to delete task. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      id="today-tasks-card"
      aria-label="Today's Tasks"
      initial={{ opacity: 0, y: 14, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className={`ninja-task-card ui-motion-section p-2 sm:p-2.5 rounded-2xl border flex-1 flex flex-col transition-all ${
        isDark
          ? 'bg-slate-900/80 border-slate-800'
          : 'bg-slate-50/70 border-slate-200/80'
      }`}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. CARD HEADER
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 mb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center space-x-1.5">
          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold shrink-0">
            <ListTodo className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                {activeDateTab === 'TODAY' ? "Today's Tasks" : "Tomorrow's Tasks"}
              </h2>
              {isSyncing && (
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono flex items-center gap-0.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Syncing</span>
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              Mission Board • {activeFormattedDate} • {activeFullDayName}
            </p>
          </div>
        </div>

        {/* Date tabs + Add Task grouped in the card header */}
        <div className="flex flex-wrap items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setActiveDateTab('TODAY')}
            className={`flex items-center space-x-1 px-1.5 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeDateTab === 'TODAY'
                ? 'bg-blue-600 text-white shadow-xs'
                : isDark
                ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200/80'
            }`}
          >
            <span>Today</span>
            <span className="opacity-80 font-mono text-[10px]">({todayOption.formattedDate})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDateTab('TOMORROW')}
            className={`flex items-center space-x-1 px-1.5 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeDateTab === 'TOMORROW'
                ? 'bg-blue-600 text-white shadow-xs'
                : isDark
                ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200/80'
            }`}
          >
            <span>Tomorrow</span>
            <span className="opacity-80 font-mono text-[10px]">({tomorrowOption.formattedDate})</span>
          </button>

          <button
            id="btn-add-task-card-header"
            onClick={() => handleOpenEnterPanel()}
            className="flex items-center space-x-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-semibold text-xs transition cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Global Notice / Error in Card */}
      {cardError && (
        <div className="mb-2 p-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <span>{cardError}</span>
          <button onClick={() => setCardError(null)} className="p-0.5 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {savingStatusMsg && (
        <div className="mb-1.5 text-[11px] font-mono text-blue-600 dark:text-blue-400 flex items-center gap-1 animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>{savingStatusMsg}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. PROGRESS BAR (Displayed when tasks exist)
             Do NOT show 0% failure when there are no tasks!
      ───────────────────────────────────────────────────────────── */}
      {totalTasksCount > 0 ? (
        <div className="ui-motion-card mb-2.5 p-2 rounded-2xl bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold mb-1">
            <span className="text-slate-700 dark:text-slate-200">
              {completedCount} of {totalTasksCount} tasks completed
            </span>
            <span className="font-mono text-blue-600 dark:text-blue-400">
              {progressPercent}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <motion.div
              className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* ─────────────────────────────────────────────────────────────
          4. TASK LIST (Incomplete tasks first, Completed tasks below)
             Or Empty State when no tasks planned
      ───────────────────────────────────────────────────────────── */}
      {totalTasksCount === 0 ? (
        <div className="py-5 px-2 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="w-10 h-10 mx-auto mb-1.5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <CalendarDays className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-0.5">
            No tasks planned for {activeDateTab === 'TODAY' ? 'today' : activeDateLabel.toLowerCase()}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-2">
            Take a moment to define meaningful actions. Keep daily commitments and build steady momentum.
          </p>
          <button
            type="button"
            onClick={() => handleOpenEnterPanel()}
            className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-semibold text-xs shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add your first task</span>
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {sortedTasks.map((task) => {
              const isTaskCompleted = task.isCompleted;

              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  whileHover={{ y: -2, scale: 1.005 }}
                  whileTap={{ scale: 0.995 }}
                  className={`group ui-motion-card flex items-center justify-between p-2 sm:p-2 rounded-2xl border transition-all ${
                    isTaskCompleted
                      ? isDark
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-85'
                        : 'bg-slate-50/70 border-slate-200/60 opacity-90'
                      : isDark
                      ? 'bg-slate-800/50 border-slate-700/80 hover:border-slate-600'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  {/* Left: Checkbox + Title + Status */}
                  <div className="flex items-start sm:items-center space-x-1.5 flex-1 min-w-0 pr-1">
                    {/* Checkbox button */}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isTaskCompleted}
                      onClick={() => handleToggleTask(task)}
                      className={`mt-0.5 sm:mt-0 w-5 h-5 rounded-lg flex items-center justify-center transition shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        isTaskCompleted
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : isDark
                          ? 'border-2 border-slate-600 hover:border-blue-400 bg-slate-900'
                          : 'border-2 border-slate-300 hover:border-blue-500 bg-white'
                      }`}
                      title={isTaskCompleted ? 'Mark task as Not completed' : 'Mark task as Completed'}
                    >
                      {isTaskCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>

                    {/* Title + Status Label */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5 min-w-0 flex-1">
                      <span
                        onClick={() => handleToggleTask(task)}
                        className={`text-sm font-medium cursor-pointer break-words select-none ${
                          isTaskCompleted
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {task.taskOfTheDay}
                      </span>

                      {/* Clear Status text */}
                      <span
                        className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded-md text-[11px] font-semibold shrink-0 select-none ${
                          isTaskCompleted
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {isTaskCompleted ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Completed</span>
                          </>
                        ) : (
                          <>
                            <Circle className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                            <span>Not completed</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Right: Edit & Delete Actions */}
                  <div className="flex items-center space-x-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(task)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Edit Task"
                      aria-label={`Edit task ${task.taskOfTheDay}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDeletingTask(task);
                        setDeleteError(null);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      title="Delete Task"
                      aria-label={`Delete task ${task.taskOfTheDay}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. "ENTER TASKS" PANEL
             Allows multiple tasks to be added without closing!
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isEnterPanelOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className={`w-full max-w-lg rounded-3xl border p-3 shadow-2xl transition-all ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-100'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              {/* Panel Header */}
              <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center space-x-1">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Plus className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                      Enter Tasks
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Add one or multiple tasks for your daily commitment
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEnterPanelOpen(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Date Options */}
              <div className="mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Schedule For Date
                </label>
                <div className="grid grid-cols-2 gap-1">
                  {/* Today */}
                  <button
                    type="button"
                    onClick={() => setPanelDateTab('TODAY')}
                    className={`flex flex-col items-start p-1.5 rounded-xl border text-left transition cursor-pointer ${
                      panelDateTab === 'TODAY'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200'
                        : isDark
                        ? 'border-slate-800 bg-slate-800/50 hover:bg-slate-800 text-slate-300'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold">Today</span>
                    <span className="text-[10px] font-mono opacity-80">{todayOption.formattedDate}</span>
                  </button>

                  {/* Tomorrow */}
                  <button
                    type="button"
                    onClick={() => setPanelDateTab('TOMORROW')}
                    className={`flex flex-col items-start p-1.5 rounded-xl border text-left transition cursor-pointer ${
                      panelDateTab === 'TOMORROW'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200'
                        : isDark
                        ? 'border-slate-800 bg-slate-800/50 hover:bg-slate-800 text-slate-300'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold">Tomorrow</span>
                    <span className="text-[10px] font-mono opacity-80">{tomorrowOption.formattedDate}</span>
                  </button>

                </div>

                {/* Explicit Target Date confirmation indicator */}
                <div className="mt-1.5 px-1.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 text-xs flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Task will be scheduled for:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono">
                    {panelTargetRelativeLabel} ({panelTargetFormattedDate})
                  </span>
                </div>
              </div>

              {/* Task Title Input Form */}
              <form onSubmit={handleCreateTask} className="space-y-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Task Title / Objective
                  </label>
                  <div className="flex items-center space-x-1">
                    <input
                      ref={taskInputRef}
                      type="text"
                      placeholder="e.g., Complete chapter 4 of SQL fundamentals"
                      value={newTaskTitle}
                      onChange={(e) => {
                        setNewTaskTitle(e.target.value);
                        if (panelError) setPanelError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setIsEnterPanelOpen(false);
                      }}
                      className={`flex-1 p-1.5 rounded-xl border text-sm focus:outline-none transition ${
                        isDark
                          ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white'
                      }`}
                    />

                    <button
                      type="submit"
                      disabled={isAddingTask || !newTaskTitle.trim()}
                      className={`px-2 py-1.5 rounded-xl font-semibold text-xs flex items-center space-x-1 transition shadow-xs shrink-0 ${
                        isAddingTask || !newTaskTitle.trim()
                          ? 'opacity-50 cursor-not-allowed bg-slate-300 dark:bg-slate-800 text-slate-500'
                          : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white cursor-pointer'
                      }`}
                    >
                      {isAddingTask ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Adding...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Add</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Press <kbd className="font-mono bg-slate-200 dark:bg-slate-800 px-0.5 py-0.5 rounded text-[10px]">Enter</kbd> to add. Panel remains open so you can add multiple tasks.
                  </p>
                </div>

                {/* Panel Error message */}
                {panelError && (
                  <div className="p-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{panelError}</span>
                  </div>
                )}

                {/* Recently Added List in this session */}
                {recentlyAddedInSession.length > 0 && (
                  <div className="p-1.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-xs space-y-0.5">
                    <span className="font-semibold text-blue-800 dark:text-blue-300 block">
                      Added in this session ({recentlyAddedInSession.length}):
                    </span>
                    <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                      {recentlyAddedInSession.map((item, idx) => (
                        <li key={idx} className="flex items-center space-x-0.5 text-slate-700 dark:text-slate-300">
                          <Check className="w-3 h-3 text-blue-600 shrink-0" />
                          <span className="truncate">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Bottom Footer Actions */}
                <div className="flex items-center justify-end pt-1.5 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEnterPanelOpen(false);
                      // Switch main view to the target date so user sees the newly added tasks!
                      setActiveDateTab(panelDateTab);
                    }}
                    className="px-2 py-1 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white font-semibold text-xs cursor-pointer transition"
                  >
                    Done
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          6. EDIT TASK MODAL
             Preserves task ID and recorded dateKey!
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {editingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-md rounded-3xl border p-3 shadow-2xl transition-all ${
                isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Edit Task
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-2">
                {/* Date is locked to preserve historical record date */}
                <div className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Recorded Date:</span>
                  <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                    {formatCalendarDate(editingTask.taskKey)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    (Task date and ID {editingTask.id.slice(0, 10)}... are strictly preserved)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Task Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className={`w-full p-1.5 rounded-xl border text-sm focus:outline-none transition ${
                      isDark
                        ? 'bg-slate-800/80 border-slate-700 text-white focus:border-blue-500'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500 focus:bg-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Completion Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditCompleted(!editCompleted)}
                    className={`flex items-center space-x-1 w-full p-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      editCompleted
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center ${
                        editCompleted ? 'bg-blue-600 text-white' : 'border border-slate-400'
                      }`}
                    >
                      {editCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span>{editCompleted ? 'Completed' : 'Not completed'}</span>
                  </button>
                </div>

                {editError && (
                  <div className="p-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs">
                    {editError}
                  </div>
                )}

                <div className="flex items-center justify-end space-x-1 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingTask(null)}
                    className="px-2 py-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit || !editTitle.trim()}
                    className={`px-2 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer ${
                      isSavingEdit ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  >
                    {isSavingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          7. DELETE TASK CONFIRMATION MODAL
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {deletingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-sm rounded-3xl border p-3 shadow-2xl transition-all ${
                isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-1.5">
                <Trash2 className="w-5 h-5" />
              </div>

              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 mb-0.5">
                Delete Task?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Are you sure you want to delete <span className="font-semibold text-slate-700 dark:text-slate-200">&ldquo;{deletingTask.taskOfTheDay}&rdquo;</span>? This action cannot be undone.
              </p>

              {deleteError && (
                <div className="mb-1.5 p-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs">
                  {deleteError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-1">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeletingTask(null)}
                  className="px-2 py-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-2 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Task'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
