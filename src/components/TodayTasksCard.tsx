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
  MoreHorizontal,
  Flag,
} from 'lucide-react';
import { DashboardTheme, HabitItem, MatrixQuadrant, TaskItem } from '../types';
import { AnimatedProgressRing } from './AnimatedProgressRing';
import {
  CONFIGURED_TIMEZONE,
  getUpcomingDateOptions,
  formatCalendarDate,
  areDatesEqual,
  toInputDateValue,
} from '../utils/taskDateUtils';
import { useCurrentDateKey } from '../hooks/useCurrentDateKey';
import { addHabitDays, isHabitDue, parseHabitDateKey } from '../utils/habitUtils';
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

function taskQuadrantSortRank(quadrant?: MatrixQuadrant): number {
  switch (quadrant) {
    case 'urgent-important':
      return 1;
    case 'important':
      return 2;
    case 'urgent':
      return 3;
    case 'neither':
      return 5;
    default:
      return 4;
  }
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
  habits: HabitItem[];
  theme: DashboardTheme;
  onAddTask: (task: Omit<TaskItem, 'id'>) => Promise<void>;
  onUpdateTask: (task: TaskItem) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onToggleTaskStatus: (taskId: string) => Promise<void>;
  onOpenDayReview: () => void;
  currentDayFormatted: string;
  currentDayName: string;
  isSyncing?: boolean;
  focusMode?: boolean;
}

export const TodayTasksCard: React.FC<TodayTasksCardProps> = ({
  tasks,
  habits,
  theme,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onToggleTaskStatus,
  onOpenDayReview,
  currentDayFormatted,
  currentDayName,
  isSyncing = false,
  focusMode = false,
}) => {
  const isDark = theme === 'dark';

  // Keep the main task view intentionally focused on only Today and Tomorrow.
  const currentDateKey = useCurrentDateKey(CONFIGURED_TIMEZONE);
  const upcomingOptions = useMemo(
    () => getUpcomingDateOptions(CONFIGURED_TIMEZONE),
    [currentDateKey]
  );
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

  const weeklyReview = useMemo(() => {
    const todayDate = parseHabitDateKey(currentDateKey);
    const weekday = todayDate.getUTCDay();
    const monday = addHabitDays(currentDateKey, weekday === 0 ? -6 : 1 - weekday);

    const elapsedDates = Array.from({ length: 7 }, (_, index) => addHabitDays(monday, index))
      .filter((dateKey) => dateKey <= currentDateKey);

    const taskDays = elapsedDates.map((dateKey) => {
      const dayTasks = tasks.filter((task) => areDatesEqual(task.taskKey, dateKey));
      const completed = dayTasks.filter((task) => task.isCompleted).length;
      return {
        dateKey,
        label: parseHabitDateKey(dateKey).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
        total: dayTasks.length,
        rate: dayTasks.length ? Math.round((completed / dayTasks.length) * 100) : 0,
      };
    });

    const habitRates = elapsedDates.map((dateKey) => {
      const due = habits.filter((habit) => isHabitDue(habit, dateKey));
      const completed = due.filter((habit) => habit.checkIns.includes(dateKey)).length;
      return due.length ? Math.round((completed / due.length) * 100) : 0;
    });

    const taskScore = Math.round((taskDays.reduce((sum, day) => sum + day.rate, 0) / 7) * 10) / 10;
    const habitScore = Math.round((habitRates.reduce((sum, rate) => sum + rate, 0) / 7) * 10) / 10;
    // Only days with at least one scheduled task are meaningful for best/worst ranking.
    const rankedTaskDays = taskDays.filter((day) => day.total > 0);
    const strongest = [...rankedTaskDays].sort((a, b) => b.rate - a.rate)[0];
    const weakest = [...rankedTaskDays].sort((a, b) => a.rate - b.rate)[0];

    return { taskScore, habitScore, strongest, weakest };
  }, [tasks, habits, currentDateKey]);

  // Sort each date by Eisenhower quadrant, then keep the execution view simple:
  // incomplete tasks first, completed tasks below. Relative order stays stable within a quadrant.
  const sortedTasks = useMemo(
    () =>
      dateTasks
        .map((task, index) => ({ task, index }))
        .sort((a, b) => {
          const quadrantDiff =
            taskQuadrantSortRank(a.task.matrixQuadrant) -
            taskQuadrantSortRank(b.task.matrixQuadrant);

          return quadrantDiff !== 0 ? quadrantDiff : a.index - b.index;
        })
        .map(({ task }) => task),
    [dateTasks]
  );
  const incompleteTasks = useMemo(
    () => sortedTasks.filter((task) => !task.isCompleted),
    [sortedTasks]
  );
  const completedTasks = useMemo(
    () => sortedTasks.filter((task) => task.isCompleted),
    [sortedTasks]
  );

  const totalTasksCount = dateTasks.length;
  const completedCount = completedTasks.length;
  const taskCompletionPercent = totalTasksCount > 0 ? (completedCount / totalTasksCount) * 100 : 0;
  const dueHabits = useMemo(
    () => habits.filter((habit) => isHabitDue(habit, activeDateKey)),
    [habits, activeDateKey]
  );
  const completedHabitsCount = useMemo(
    () => dueHabits.filter((habit) => habit.checkIns.includes(activeDateKey)).length,
    [dueHabits, activeDateKey]
  );
  const habitCompletionPercent =
    dueHabits.length > 0 ? (completedHabitsCount / dueHabits.length) * 100 : 0;
  // Today's Tasks ring: tasks carry 80% of the score and habits carry 20%.
  const progressPercent = Math.round(taskCompletionPercent * 0.8 + habitCompletionPercent * 0.2);

  // UI state for "Enter Tasks" panel
  const [isEnterPanelOpen, setIsEnterPanelOpen] = useState(false);
  // Panel date selection mirrors the two main tabs.
  const [panelDateTab, setPanelDateTab] = useState<'TODAY' | 'TOMORROW'>('TODAY');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [newEstimationTime, setNewEstimationTime] = useState('');
  const [newTaskQuadrant, setNewTaskQuadrant] = useState<MatrixQuadrant | ''>('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [recentlyAddedInSession, setRecentlyAddedInSession] = useState<string[]>([]);
  const taskInputRef = useRef<HTMLInputElement>(null);

  // UI state for Editing a Task
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editEstimationTime, setEditEstimationTime] = useState('');
  const [editActualTime, setEditActualTime] = useState('');
  const [editCompleted, setEditCompleted] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(() => new Set());

  // UI state for Deleting a Task confirmation
  const [deletingTask, setDeletingTask] = useState<TaskItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // General feedback status (e.g. "Saving...")
  const [savingStatusMsg, setSavingStatusMsg] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [copyForwardFeedback, setCopyForwardFeedback] = useState<string | null>(null);
  const copyForwardLocksRef = useRef<Set<string>>(new Set());
  const [copyingTaskIds, setCopyingTaskIds] = useState<Set<string>>(() => new Set());
  const [openTaskMenuId, setOpenTaskMenuId] = useState<string | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  useEffect(() => {
    const focusTask = (event: Event) => {
      const taskId = (event as CustomEvent<{ taskId?: string }>).detail?.taskId;
      if (!taskId) return;

      setActiveDateTab('TODAY');
      setFocusedTaskId(taskId);

      window.setTimeout(() => {
        document
          .getElementById(`system-task-${taskId}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 180);

      window.setTimeout(() => {
        setFocusedTaskId((current) => (current === taskId ? null : current));
      }, 3600);
    };

    window.addEventListener('system-builder:focus-task', focusTask);
    return () => window.removeEventListener('system-builder:focus-task', focusTask);
  }, []);

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
    setNewTaskNotes('');
    setNewEstimationTime('');
    setNewTaskQuadrant('');
    setPanelError(null);
    setRecentlyAddedInSession([]);
    setIsEnterPanelOpen(true);
  };

  const handleCloseEnterPanel = () => {
    setNewTaskTitle('');
    setNewTaskNotes('');
    setNewEstimationTime('');
    setNewTaskQuadrant('');
    setPanelError(null);
    setRecentlyAddedInSession([]);
    setIsEnterPanelOpen(false);
  };

  // Allow global quick-add controls (such as the mobile + button) to open this panel.
  useEffect(() => {
    const openEnterTasks = () => handleOpenEnterPanel();
    window.addEventListener('system-builder:open-enter-tasks', openEnterTasks);
    return () => window.removeEventListener('system-builder:open-enter-tasks', openEnterTasks);
  }, [activeDateTab]);

  // Preserve keyboard-first desktop entry without forcing the mobile visual viewport
  // to resize as soon as the Enter Tasks panel opens.
  useEffect(() => {
    if (!isEnterPanelOpen) return;
    const canAutoFocus =
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 640px) and (pointer: fine)').matches;
    if (!canAutoFocus) return;

    const timeoutId = window.setTimeout(() => {
      taskInputRef.current?.focus({ preventScroll: true });
    }, 100);

    return () => window.clearTimeout(timeoutId);
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
        priority: newTaskQuadrant
          ? priorityForQuadrant(newTaskQuadrant)
          : 'Normal',
        category: 'General',
        matrixQuadrant: newTaskQuadrant || undefined,
        notes: newTaskNotes.trim(),
        EstimationTime: newEstimationTime.trim(),
      });

      // Keep the panel open for rapid entry. The focused input naturally stays
      // focused on desktop/mobile; do not force another mobile viewport resize.
      setRecentlyAddedInSession((prev) => [trimmedTitle, ...prev]);
      setNewTaskTitle('');
      setNewTaskNotes('');
      setNewEstimationTime('');
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
    const nextDateKey = getNextTaskDateKey(task.taskKey);
    const lockKey = `${task.id}::${nextDateKey}`;
    if (copyForwardLocksRef.current.has(lockKey)) return;
    copyForwardLocksRef.current.add(lockKey);
    setCopyingTaskIds((current) => new Set(current).add(task.id));

    try {
      setCardError(null);
      setCopyForwardFeedback(null);

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
        EstimationTime: task.EstimationTime,
        ActualTime: task.ActualTime,
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
      copyForwardLocksRef.current.delete(lockKey);
      setCopyingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  };

  // Open Edit Task modal
  const handleStartEdit = (task: TaskItem) => {
    setEditingTask(task);
    setEditTitle(task.taskOfTheDay);
    setEditNotes(task.notes || '');
    setEditEstimationTime(task.EstimationTime || task.timeEstimate || '');
    setEditActualTime(task.ActualTime || '');
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
        EstimationTime: editEstimationTime.trim(),
        ActualTime: editActualTime.trim(),
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
      className={`system-task-card system-primary-focus h-full min-h-0 overflow-hidden p-2.5 sm:p-3 rounded-2xl border flex-1 flex flex-col transition-all ${
        isDark
          ? 'bg-slate-900/80 border-slate-800'
          : 'bg-slate-50/70 border-slate-200/80'
      }`}
    >
      {/* Primary execution header */}
      <div className={`${focusMode ? 'hidden' : 'block'} shrink-0 pb-2 mb-1 border-b border-slate-200/80 dark:border-slate-800`}>
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1 pr-1">
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {activeDateTab === 'TODAY' ? "Today's Tasks" : "Tomorrow's Tasks"}
            </h2>
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {activeDateTab === 'TODAY' ? `${currentDayName} · ${currentDayFormatted}` : tomorrowOption.label}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isSyncing && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
            <button id="btn-add-task-card-header" type="button" onClick={() => handleOpenEnterPanel()} className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-1 rounded-xl bg-blue-600 p-0 text-xs font-semibold text-white hover:bg-blue-500 sm:h-8 sm:w-auto sm:rounded-lg sm:px-2.5" aria-label="Add Task"><Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5"/><span className="hidden sm:inline">Add</span></button>
            <button id="btn-review-task-day" type="button" onClick={onOpenDayReview} disabled={activeDateTab !== 'TODAY' || totalTasksCount === 0 || isSyncing} className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-1 rounded-xl border border-slate-200 p-0 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 sm:h-8 sm:w-auto sm:rounded-lg sm:px-2.5" aria-label="Review today's tasks"><CheckCircle2 className="w-4 h-4 sm:w-3.5 sm:h-3.5"/><span className="hidden sm:inline">Review</span></button>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5" role="tablist" aria-label="Task date">
            {(['TODAY','TOMORROW'] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeDateTab===tab} onClick={() => setActiveDateTab(tab)} className={`min-h-9 px-3 py-1 rounded-md text-[11px] font-semibold transition sm:min-h-0 sm:px-2.5 ${activeDateTab===tab?'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm':'text-slate-500 dark:text-slate-400'}`}>{tab==='TODAY'?'Today':'Tomorrow'}</button>)}
          </div>
          <span className="shrink-0 text-right text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400 max-[360px]:text-[10px]">{completedCount} of {totalTasksCount} completed</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" title={`Task completion ${Math.round(taskCompletionPercent)}%`}>
          <div className="h-full rounded-full bg-blue-600 transition-[width] duration-300" style={{ width: `${Math.round(taskCompletionPercent)}%` }} />
        </div>
      </div>

      {/* Global Notice / Error in Card */}
      {cardError && (
        <div className="mb-2 p-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <span>{cardError}</span>
          <button type="button" onClick={() => setCardError(null)} className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/40" aria-label="Dismiss task error">
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
        <div className="py-6 px-3 text-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30">
          <div className="w-10 h-10 mx-auto mb-1.5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <CalendarDays className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-0.5">
            No tasks planned for {activeDateTab === 'TODAY' ? 'today' : activeDateLabel.toLowerCase()}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-2">
            Add a clear next action and keep today focused.
          </p>
          <button
            type="button"
            onClick={() => handleOpenEnterPanel()}
            className="inline-flex min-h-10 items-center justify-center space-x-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-500 active:bg-blue-700 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add your first task</span>
          </button>
        </div>
      ) : (
        <div className="relative divide-y divide-slate-100 dark:divide-slate-800/80">
          <AnimatePresence initial={false}>
            {[...incompleteTasks, ...completedTasks].map((task, taskIndex) => {
              const isTaskCompleted = task.isCompleted;

              const showCompletedHeading = taskIndex === incompleteTasks.length && completedTasks.length > 0;

              return (
                <React.Fragment key={task.id}>
                {showCompletedHeading && <div className="pt-3 pb-1 px-1 text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400 dark:text-slate-500">Completed {completedTasks.length}</div>}
                <motion.div
                  id={`system-task-${task.id}`}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  className={`relative rounded-xl transition-[box-shadow,background-color] duration-500 ${
                    focusedTaskId === task.id
                      ? 'bg-blue-50/90 ring-2 ring-blue-500 ring-offset-2 ring-offset-white shadow-lg shadow-blue-100 dark:bg-blue-950/35 dark:ring-blue-400 dark:ring-offset-slate-900 dark:shadow-blue-950/30'
                      : ''
                  }`}
                >
                  {/* Task row */}
                  <motion.div
                    
                    className={`group relative min-w-0 px-1 py-2 sm:px-1.5 sm:py-2.5 transition-colors ${
                      isTaskCompleted
                        ? 'bg-slate-50/45 dark:bg-slate-950/20'
                        : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-start gap-1.5 sm:gap-3">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isTaskCompleted}
                        aria-label={`${isTaskCompleted ? 'Mark incomplete' : 'Mark completed'}: ${task.taskOfTheDay}`}
                        onClick={() => handleToggleTask(task)}
                        className="relative -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl p-0 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:mt-0 sm:h-7 sm:w-7 sm:rounded-lg"
                        title={
                          isTaskCompleted
                            ? 'Mark task as Not completed'
                            : 'Mark task as Completed'
                        }
                      >
                        <span
                          className={`relative block size-5 shrink-0 rounded-[5px] transition ${
                            isTaskCompleted
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : isDark
                              ? 'border-2 border-slate-600 bg-slate-900'
                              : 'border-2 border-slate-300 bg-white'
                          }`}
                          aria-hidden="true"
                        >
                          {isTaskCompleted && (
                            <Check className="absolute inset-0 m-auto size-3 stroke-[3]" />
                          )}
                        </span>
                      </button>

                      <div className="min-w-0 flex-1 pt-px pr-1 sm:pr-0 overflow-hidden">
                        <div className="flex min-w-0 items-start gap-1.5">
                          <span
                            className={`mt-[3px] inline-flex size-4 shrink-0 items-center justify-center rounded ${
                              task.priority === 'High'
                                ? 'text-rose-600 dark:text-rose-400'
                                : task.priority === 'Medium'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-slate-400 dark:text-slate-500'
                            }`}
                            title={`${task.priority || 'Normal'} priority`}
                            aria-label={`${task.priority || 'Normal'} priority`}
                          >
                            <Flag className={`size-3.5 ${task.priority === 'High' ? 'fill-current' : ''}`} />
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleTask(task)}
                            className={`min-w-0 flex-1 text-left text-[13px] sm:text-sm font-semibold leading-[1.25rem] sm:leading-snug whitespace-normal break-words [overflow-wrap:anywhere] select-none ${
                              isTaskCompleted
                                ? 'line-through text-slate-400 dark:text-slate-500'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {task.taskOfTheDay}
                          </button>
                        </div>

                        {(task.EstimationTime?.trim() || task.ActualTime?.trim()) && (
                          <div
                            className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200/80 bg-white/75 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400"
                            aria-label={`Planned ${task.EstimationTime?.trim() || 'not set'}, actual ${task.ActualTime?.trim() || 'not set'}`}
                            title="Planned time vs actual time"
                          >
                            <span className="text-slate-400 dark:text-slate-500">Plan</span>
                            <span className="text-slate-700 dark:text-slate-200">{task.EstimationTime?.trim() || '—'}</span>
                            <span className="text-slate-300 dark:text-slate-600">→</span>
                            <span className="text-slate-400 dark:text-slate-500">Actual</span>
                            <span className={task.ActualTime?.trim() ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}>
                              {task.ActualTime?.trim() || '—'}
                            </span>
                          </div>
                        )}

                        {task.notes?.trim() && (
                          <div className="mt-1.5">
                            <p className={`text-xs leading-[1.25rem] whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-slate-600 dark:text-slate-300 ${expandedNotes.has(task.id) ? '' : 'line-clamp-2 sm:line-clamp-1'}`}>
                              {task.notes}
                            </p>
                            {(task.notes.length > 70 || task.notes.includes('\n')) && (
                              <button
                                type="button"
                                onClick={() => setExpandedNotes((current) => {
                                  const next = new Set(current);
                                  if (next.has(task.id)) next.delete(task.id);
                                  else next.add(task.id);
                                  return next;
                                })}
                                className="mt-0.5 inline-flex min-h-8 items-center rounded-lg px-2 text-[10px] font-bold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30 sm:min-h-0 sm:px-0 sm:hover:bg-transparent sm:hover:underline"
                              >
                                {expandedNotes.has(task.id) ? 'Less' : 'More'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="relative shrink-0 -mt-0.5 sm:-mt-1">
                        <button type="button" onClick={() => setOpenTaskMenuId(openTaskMenuId === task.id ? null : task.id)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 opacity-100 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 sm:h-7 sm:w-7 sm:rounded-md sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100" aria-label={`More actions for ${task.taskOfTheDay}`} aria-expanded={openTaskMenuId === task.id}>
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {openTaskMenuId === task.id && (
                          <div className="absolute right-0 top-10 z-30 w-44 max-w-[calc(100vw-2rem)] rounded-xl sm:top-9 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1 text-xs">
                            <button type="button" onClick={() => { setOpenTaskMenuId(null); handleStartEdit(task); }} className="task-menu-item"><Pencil />Edit</button>
                            <button type="button" disabled={copyingTaskIds.has(task.id)} onClick={() => { setOpenTaskMenuId(null); handleCopyToNextDay(task); }} className="task-menu-item"><ArrowRight />Move/copy to next day</button>
                            <button type="button" onClick={() => { setOpenTaskMenuId(null); setDeletingTask(task); setDeleteError(null); }} className="task-menu-item text-rose-600 dark:text-rose-400"><Trash2 />Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
                </React.Fragment>
              );
            })}
          </AnimatePresence>
        </div>
      )}
      </div>

      {!focusMode && activeDateTab === 'TODAY' && (
        <div
          aria-label="Weekly Review"
          className="mt-1.5 shrink-0 border-t border-slate-200/80 dark:border-slate-800 pt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400"
        >
          <span className="font-semibold text-slate-700 dark:text-slate-200">Weekly Review</span>
          <span>Tasks {weeklyReview.taskScore.toFixed(1)}%</span>
          <span>Habits {weeklyReview.habitScore.toFixed(1)}%</span>
          {weeklyReview.strongest && <span className="hidden sm:inline">Strongest: {weeklyReview.strongest.label} {weeklyReview.strongest.rate}%</span>}
          {weeklyReview.weakest && <span className="hidden sm:inline">Needs attention: {weeklyReview.weakest.label} {weeklyReview.weakest.rate}%</span>}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. "ENTER TASKS" PANEL
             Allows multiple tasks to be added without closing!
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isEnterPanelOpen && (
          <div className="system-stable-modal fixed inset-0 z-[220] flex items-start justify-center overflow-hidden overscroll-none bg-black/60 px-2 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-[max(.75rem,env(safe-area-inset-top))] backdrop-blur-xs sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Enter tasks">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className={`pointer-events-auto w-full max-w-lg max-h-[calc(100svh-1.5rem)] overflow-y-auto overscroll-y-contain touch-pan-y rounded-3xl border p-3 shadow-2xl transition-colors sm:max-h-[calc(100dvh-2rem)] ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-100'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              {/* Panel Header */}
              <div className="flex items-start justify-between gap-2 pb-1.5 mb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex min-w-0 flex-1 items-start space-x-1.5">
                  <div className="w-8 h-8 shrink-0 rounded-xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Plus className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                      Enter Tasks
                    </h3>
                    <p className="text-xs leading-4 text-slate-500 dark:text-slate-400 max-[360px]:line-clamp-2">
                      Add one or multiple tasks for your daily commitment
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!isAddingTask) handleCloseEnterPanel();
                    }}
                    disabled={isAddingTask}
                    className="inline-flex size-8 items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    aria-label="Exit Enter Tasks"
                    title="Exit"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
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
                        if (e.key === 'Escape' && !isAddingTask) handleCloseEnterPanel();
                      }}
                      className={`w-full h-8 px-2 rounded-lg border text-sm focus:outline-none transition ${
                        isDark
                          ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white'
                      }`}
                    />
                    <div className="mt-1 grid grid-cols-1 gap-2 min-[420px]:grid-cols-[minmax(0,1fr)_112px]">
                      <textarea
                        value={newTaskNotes}
                        onChange={(e) => setNewTaskNotes(e.target.value)}
                        placeholder="Notes"
                        rows={2}
                        className={`w-full min-h-[48px] max-h-20 resize-y px-2 py-1 rounded-lg border text-xs leading-4 focus:outline-none transition ${isDark ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white'}`}
                      />
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        EstimationTime
                        <input type="text" value={newEstimationTime} onChange={(e) => setNewEstimationTime(e.target.value)} placeholder="45m" className={`mt-1 w-full h-[34px] px-2 rounded-xl border text-xs font-semibold outline-none transition ${isDark ? 'bg-slate-800/80 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500 focus:bg-white'}`} />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="new-task-quadrant"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                    >
                      Quadrant <span className="font-medium normal-case tracking-normal text-slate-400">(optional)</span>
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
                      <option value="">No quadrant</option>
                      {TASK_QUADRANT_OPTIONS.map((quadrant) => (
                        <option key={quadrant.value} value={quadrant.value}>
                          {quadrant.roman} — {quadrant.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isAddingTask || !newTaskTitle.trim()}
                    className={`hidden h-[34px] px-3 rounded-xl font-semibold text-xs sm:mt-[21px] sm:inline-flex items-center justify-center gap-1 transition shadow-xs shrink-0 ${
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
                <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800 sm:flex sm:items-center sm:justify-end">
                  <button
                    type="submit"
                    disabled={isAddingTask || !newTaskTitle.trim()}
                    className={`inline-flex min-h-9 w-full items-center justify-center gap-1 rounded-xl px-2.5 text-xs font-semibold transition shadow-xs sm:hidden ${
                      isAddingTask || !newTaskTitle.trim()
                        ? 'opacity-50 cursor-not-allowed bg-slate-300 dark:bg-slate-800 text-slate-500'
                        : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white cursor-pointer'
                    }`}
                  >
                    {isAddingTask ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        <span>Adding...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 shrink-0" />
                        <span>Add</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isAddingTask}
                    onClick={() => {
                      // Switch main view to the target date so the user sees newly added tasks.
                      setActiveDateTab(panelDateTab);
                      handleCloseEnterPanel();
                    }}
                    className="inline-flex min-h-9 w-full items-center justify-center rounded-xl bg-slate-800 px-2.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 sm:w-auto"
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
          <div className="system-stable-modal fixed inset-0 z-[220] flex items-start justify-center overflow-hidden bg-black/60 px-2 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-[max(.75rem,env(safe-area-inset-top))] backdrop-blur-xs sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Edit task">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-md max-h-[calc(100svh-1.5rem)] overflow-y-auto overscroll-y-contain touch-pan-y rounded-3xl border p-3 shadow-2xl transition-colors sm:max-h-[calc(100dvh-2rem)] ${
                isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Edit Task
                </h3>
                <button
                  type="button"
                  onClick={() => { if (!isSavingEdit) setEditingTask(null); }}
                  disabled={isSavingEdit}
                  className="inline-flex size-9 items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
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
                            className={`inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 font-semibold ${quadrantMeta.classes}`}
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
                    className={`w-full min-h-10 px-3 py-2 rounded-xl border text-sm focus:outline-none transition ${
                      isDark
                        ? 'bg-slate-800/80 border-slate-700 text-white focus:border-blue-500'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500 focus:bg-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={2}
                    placeholder="Add notes"
                    className={`w-full min-h-[48px] max-h-20 resize-y px-2 py-1 rounded-lg border text-xs leading-4 focus:outline-none transition ${isDark ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white'}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    EstimationTime
                    <input type="text" value={editEstimationTime} onChange={(e) => setEditEstimationTime(e.target.value)} placeholder="e.g. 45m" className={`mt-1 w-full min-h-10 px-3 py-2 rounded-xl border text-sm outline-none transition ${isDark ? 'bg-slate-800/80 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500 focus:bg-white'}`} />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    ActualTime
                    <input type="text" value={editActualTime} onChange={(e) => setEditActualTime(e.target.value)} placeholder="e.g. 50m" className={`mt-1 w-full min-h-10 px-3 py-2 rounded-xl border text-sm outline-none transition ${isDark ? 'bg-slate-800/80 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500 focus:bg-white'}`} />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Completion Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditCompleted(!editCompleted)}
                    className={`flex min-h-10 items-center space-x-2 w-full px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
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

                <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800 sm:flex sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={() => { if (!isSavingEdit) setEditingTask(null); }}
                    disabled={isSavingEdit}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl px-3 py-2 text-slate-600 disabled:opacity-50 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit || !editTitle.trim()}
                    className={`inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-600 px-3 py-2 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer ${
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
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Delete task">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-sm max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain rounded-3xl border p-3 shadow-2xl transition-all ${
                isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-1.5">
                <Trash2 className="w-5 h-5" />
              </div>

              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-0.5">
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

              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeletingTask(null)}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-rose-500 active:bg-rose-700 disabled:opacity-50 cursor-pointer"
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
