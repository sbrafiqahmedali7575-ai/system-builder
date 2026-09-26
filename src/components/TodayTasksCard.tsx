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
  CalendarDays,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { DashboardTheme, MatrixQuadrant, TaskItem } from '../types';
import { AnimatedProgressRing } from './AnimatedProgressRing';
import { PomodoroTimer } from './PomodoroTimer';
import {
  CONFIGURED_TIMEZONE,
  getUpcomingDateOptions,
  formatCalendarDate,
  areDatesEqual,
  toInputDateValue,
} from '../utils/taskDateUtils';
import confetti from 'canvas-confetti';

const TASK_QUADRANT_OPTIONS: Array<{
  value: MatrixQuadrant;
  roman: 'I' | 'II' | 'III' | 'IV';
  label: string;
}> = [
  { value: 'urgent-important', roman: 'I', label: 'Urgent & Important' },
  { value: 'important', roman: 'II', label: 'Not Urgent & Important' },
  { value: 'urgent', roman: 'III', label: 'Urgent & Unimportant' },
  { value: 'neither', roman: 'IV', label: 'Not Urgent & Unimportant' },
];

function priorityForQuadrant(
  quadrant: MatrixQuadrant
): NonNullable<TaskItem['priority']> {
  if (quadrant === 'urgent-important') return 'High';
  if (quadrant === 'important' || quadrant === 'urgent') return 'Medium';
  return 'Normal';
}


function getTaskQuadrantMeta(quadrant?: MatrixQuadrant) {
  switch (quadrant) {
    case 'urgent-important':
      return {
        roman: 'I',
        label: 'Urgent & Important',
        classes:
          'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300',
      };
    case 'important':
      return {
        roman: 'II',
        label: 'Not Urgent & Important',
        classes:
          'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
      };
    case 'urgent':
      return {
        roman: 'III',
        label: 'Urgent & Unimportant',
        classes:
          'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300',
      };
    case 'neither':
      return {
        roman: 'IV',
        label: 'Not Urgent & Unimportant',
        classes:
          'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
      };
    default:
      return {
        roman: '—',
        label: 'Unassigned',
        classes:
          'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
      };
  }
}

interface TodayTasksCardProps {
  tasks: TaskItem[];
  theme: DashboardTheme;
  onAddTask: (task: Omit<TaskItem, 'id'>) => Promise<void>;
  onUpdateTask: (task: TaskItem) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onToggleTaskStatus: (taskId: string) => Promise<void>;
  onOpenDayReview: () => void;
  currentDayFormatted: string;
  currentDayName: string;
  isSyncing?: boolean;
}

export const TodayTasksCard: React.FC<TodayTasksCardProps> = ({
  tasks,
  theme,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onToggleTaskStatus,
  onOpenDayReview,
  currentDayFormatted,
  currentDayName,
  isSyncing = false,
}) => {
  const isDark = theme === 'dark';

  // Keep the main task view intentionally focused on only Today and Tomorrow.
  const upcomingOptions = useMemo(() => getUpcomingDateOptions(CONFIGURED_TIMEZONE), []);
  const todayOption = upcomingOptions[0];
  const tomorrowOption = upcomingOptions[1];

  const [activeDateTab, setActiveDateTab] = useState<'TODAY' | 'TOMORROW'>('TODAY');

  // Compute currently active dateKey
  const activeDateKey = useMemo(() => {
    return activeDateTab === 'TODAY' ? todayOption.dateKey : tomorrowOption.dateKey;
  }, [activeDateTab, todayOption.dateKey, tomorrowOption.dateKey]);

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
  const [newTaskQuadrant, setNewTaskQuadrant] = useState<MatrixQuadrant | ''>('');
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
  const [copyForwardFeedback, setCopyForwardFeedback] = useState<string | null>(null);

  useEffect(() => {
    setCopyForwardFeedback(null);
    setCardError(null);
  }, [activeDateKey]);

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
    setNewTaskQuadrant('');
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

    if (!newTaskQuadrant) {
      setPanelError('Please select a quadrant from I to IV.');
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
        priority: priorityForQuadrant(newTaskQuadrant),
        category: 'General',
        matrixQuadrant: newTaskQuadrant,
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

  const getNextTaskDateKey = (taskDateKey: string): string => {
    const isoDate = toInputDateValue(taskDateKey);
    const [year, month, day] = isoDate.split('-').map(Number);

    if (!year || !month || !day) {
      throw new Error('Unable to determine the next date for this task.');
    }

    const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
    return [
      nextDate.getUTCFullYear(),
      String(nextDate.getUTCMonth() + 1).padStart(2, '0'),
      String(nextDate.getUTCDate()).padStart(2, '0'),
    ].join('-');
  };

  // Copy a task forward one calendar day without changing the original task.
  const handleCopyToNextDay = async (task: TaskItem) => {
    try {
      setCardError(null);
      setCopyForwardFeedback(null);

      const nextDateKey = getNextTaskDateKey(task.taskKey);
      const duplicate = tasks.find(
        (candidate) =>
          areDatesEqual(candidate.taskKey, nextDateKey) &&
          candidate.taskOfTheDay.trim().toLowerCase() ===
            task.taskOfTheDay.trim().toLowerCase()
      );

      if (duplicate) {
        setCardError(
          `"${task.taskOfTheDay}" already exists for ${formatCalendarDate(nextDateKey)}.`
        );
        return;
      }

      setSavingStatusMsg(`Adding "${task.taskOfTheDay}" to next day...`);

      await onAddTask({
        taskKey: nextDateKey,
        taskOfTheDay: task.taskOfTheDay,
        isCompleted: false,
        priority: task.priority || 'Normal',
        timeEstimate: task.timeEstimate,
        category: task.category,
        notes: task.notes,
        matrixQuadrant: task.matrixQuadrant,
      });

      setCopyForwardFeedback(
        `Added "${task.taskOfTheDay}" to ${formatCalendarDate(nextDateKey)}.`
      );
    } catch (err: any) {
      console.error('Error copying task to next day:', err);
      setCardError(err?.message || 'Failed to add the task to the next day.');
    } finally {
      setSavingStatusMsg(null);
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
      className={`system-task-card ui-motion-section h-full min-h-0 overflow-hidden p-2 rounded-2xl border flex-1 flex flex-col transition-all ${
        isDark
          ? 'bg-slate-900/80 border-slate-800'
          : 'bg-slate-50/70 border-slate-200/80'
      }`}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. CARD HEADER
      ───────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1.5 mb-1.5 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center space-x-1.5">
          <div
            className="shrink-0"
            title={`${completedCount} of ${totalTasksCount} tasks completed • ${progressPercent}%`}
          >
            <AnimatedProgressRing
              value={progressPercent}
              size={38}
              strokeWidth={4}
              label={`${progressPercent}%`}
              trackClassName="text-slate-200 dark:text-slate-800"
              progressClassName={progressPercent === 100 ? 'text-emerald-500' : 'text-blue-500'}
            />
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
            <div className="mt-0.5 flex items-center gap-1 text-[9px] font-semibold text-slate-400">
              <span>Current day</span>
              <span className="font-mono font-black text-slate-600 dark:text-slate-300">
                {currentDayFormatted}
              </span>
              <span>•</span>
              <span className="font-black text-slate-600 dark:text-slate-300">
                {currentDayName}
              </span>
            </div>
          </div>
        </div>

        {/* Pomodoro + date tabs + task actions grouped in the card header */}
        <div className="flex flex-wrap items-center justify-end gap-1">
          <PomodoroTimer className="mr-1" />

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
          </button>

          <button
            id="btn-add-task-card-header"
            type="button"
            onClick={() => handleOpenEnterPanel()}
            title="Add Task"
            aria-label="Add Task"
            className="w-8 h-8 inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl transition cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>

          <button
            id="btn-review-task-day"
            type="button"
            onClick={onOpenDayReview}
            disabled={activeDateTab !== 'TODAY' || totalTasksCount === 0 || isSyncing}
            title={
              activeDateTab !== 'TODAY'
                ? 'Review is available for the current day only'
                : totalTasksCount === 0
                ? 'Add at least one task before reviewing today'
                : 'Review today tasks before marking the day'
            }
            aria-label="Review today's tasks"
            className="w-8 h-8 inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl transition cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
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

      {copyForwardFeedback && (
        <div className="mb-2 p-1.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center gap-1.5">
          <ArrowRight className="w-4 h-4 shrink-0" />
          <span>{copyForwardFeedback}</span>
        </div>
      )}

      {savingStatusMsg && (
        <div className="mb-1.5 text-[11px] font-mono text-blue-600 dark:text-blue-400 flex items-center gap-1 animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>{savingStatusMsg}</span>
        </div>
      )}

      {/* Task completion progress is shown in the header ring. */}

      {/* ─────────────────────────────────────────────────────────────
          4. TASK LIST (Incomplete tasks first, Completed tasks below)
             Or Empty State when no tasks planned
      ───────────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
      {totalTasksCount === 0 ? (
        <div className="py-4 px-2 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
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
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {sortedTasks.map((task) => {
              const isTaskCompleted = task.isCompleted;
              const quadrantMeta = getTaskQuadrantMeta(task.matrixQuadrant);

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
                  className={`group ui-motion-card flex items-center justify-between p-1.5 sm:p-2 rounded-xl border transition-all ${
                    isTaskCompleted
                      ? isDark
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-85'
                        : 'bg-slate-50/70 border-slate-200/60 opacity-90'
                      : isDark
                      ? 'bg-slate-800/50 border-slate-700/80 hover:border-slate-600'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  {/* Left: Checkbox + flexible title + aligned quadrant/status columns */}
                  <div className="flex items-start sm:items-center gap-1.5 flex-1 min-w-0 pr-1">
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

                    <div className="min-w-0 flex-1">
                      <span
                        onClick={() => handleToggleTask(task)}
                        className={`block text-sm font-medium cursor-pointer break-words select-none ${
                          isTaskCompleted
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {task.taskOfTheDay}
                      </span>

                      {/* On small screens keep metadata together below the title. */}
                      <div className="mt-1 flex items-center gap-1 sm:hidden">
                        <span
                          className={`inline-flex w-7 items-center justify-center px-1 py-0.5 rounded-md border text-[10px] font-black shrink-0 select-none ${quadrantMeta.classes}`}
                          title={`Quadrant ${quadrantMeta.roman} — ${quadrantMeta.label}`}
                          aria-label={`Quadrant ${quadrantMeta.roman}: ${quadrantMeta.label}`}
                        >
                          {quadrantMeta.roman}
                        </span>
                        <span
                          className={`inline-flex min-w-[104px] items-center justify-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-semibold shrink-0 select-none ${
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

                    {/* Fixed desktop columns keep every quadrant and status aligned. */}
                    <div className="hidden sm:grid grid-cols-[32px_108px] items-center gap-1.5 shrink-0">
                      <span
                        className={`inline-flex w-7 items-center justify-center px-1 py-0.5 rounded-md border text-[10px] font-black select-none ${quadrantMeta.classes}`}
                        title={`Quadrant ${quadrantMeta.roman} — ${quadrantMeta.label}`}
                        aria-label={`Quadrant ${quadrantMeta.roman}: ${quadrantMeta.label}`}
                      >
                        {quadrantMeta.roman}
                      </span>

                      <span
                        className={`inline-flex w-[108px] items-center justify-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-semibold select-none ${
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

                  {/* Right: Edit, Next Day & Delete Actions */}
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
                      onClick={() => handleCopyToNextDay(task)}
                      className="p-1 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                      title={`Add to next day (${formatCalendarDate(getNextTaskDateKey(task.taskKey))})`}
                      aria-label={`Add task ${task.taskOfTheDay} to next day`}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
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
      </div>

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

              {/* Task Title + Quadrant Input Form */}
              <form onSubmit={handleCreateTask} className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_190px_auto] gap-2 items-start">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Task Title / Objective
                    </label>
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
                      className={`w-full p-1.5 rounded-xl border text-sm focus:outline-none transition ${
                        isDark
                          ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white'
                      }`}
                    />
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Press <kbd className="font-mono bg-slate-200 dark:bg-slate-800 px-0.5 py-0.5 rounded text-[10px]">Enter</kbd> to add. Panel remains open so you can add multiple tasks.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="new-task-quadrant"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                    >
                      Quadrant
                    </label>
                    <select
                      id="new-task-quadrant"
                      value={newTaskQuadrant}
                      onChange={(event) => {
                        setNewTaskQuadrant(event.target.value as MatrixQuadrant | '');
                        if (panelError) setPanelError(null);
                      }}
                      className={`w-full h-[34px] px-2 rounded-xl border text-xs font-semibold outline-none transition ${
                        isDark
                          ? 'bg-slate-800/80 border-slate-700 text-white focus:border-blue-500'
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500 focus:bg-white'
                      }`}
                      aria-label="Select task quadrant"
                    >
                      <option value="">Select quadrant</option>
                      {TASK_QUADRANT_OPTIONS.map((quadrant) => (
                        <option key={quadrant.value} value={quadrant.value}>
                          {quadrant.roman} — {quadrant.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">
                      I = do first · II = schedule · III = delegate · IV = eliminate
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isAddingTask || !newTaskTitle.trim() || !newTaskQuadrant}
                    className={`h-[34px] px-3 rounded-xl font-semibold text-xs inline-flex items-center justify-center gap-1 transition shadow-xs shrink-0 sm:mt-[21px] ${
                      isAddingTask || !newTaskTitle.trim() || !newTaskQuadrant
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
                {/* Date and quadrant details are visible while editing. */}
                <div className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block mb-0.5">
                        Recorded Date:
                      </span>
                      <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                        {formatCalendarDate(editingTask.taskKey)}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block mb-0.5">
                        Quadrant:
                      </span>
                      {(() => {
                        const quadrantMeta = getTaskQuadrantMeta(editingTask.matrixQuadrant);
                        return (
                          <span
                            className={`inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 font-black ${quadrantMeta.classes}`}
                          >
                            <span>{quadrantMeta.roman}</span>
                            <span className="font-semibold">{quadrantMeta.label}</span>
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Task date and ID {editingTask.id.slice(0, 10)}... are preserved.
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
