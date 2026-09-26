import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Loader2,
  Repeat2,
  X,
} from 'lucide-react';
import { DashboardTheme, HabitItem, TaskItem } from '../types';
import {
  areDatesEqual,
  CONFIGURED_TIMEZONE,
  formatCalendarDate,
  getIsoDateKeyInTimezone,
} from '../utils/taskDateUtils';
import { isHabitDue } from '../utils/habitUtils';

interface DayReviewModalProps {
  isOpen: boolean;
  tasks: TaskItem[];
  habits: HabitItem[];
  theme: DashboardTheme;
  isSyncing?: boolean;
  onClose: () => void;
  onToggleTaskStatus: (taskId: string) => Promise<void>;
  onUpdateHabit: (habit: HabitItem) => Promise<void>;
  onSubmitTaskDay: (
    dateKey: string,
    dayTasks: TaskItem[],
    dayHabits: HabitItem[]
  ) => Promise<'COMPLETED' | 'NOT_COMPLETED'>;
}

export const DayReviewModal: React.FC<DayReviewModalProps> = ({
  isOpen,
  tasks,
  habits,
  theme,
  isSyncing = false,
  onClose,
  onToggleTaskStatus,
  onUpdateHabit,
  onSubmitTaskDay,
}) => {
  const isDark = theme === 'dark';
  const todayDateKey = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
  const todayTasks = useMemo(
    () => tasks.filter((task) => areDatesEqual(task.taskKey, todayDateKey)),
    [tasks, todayDateKey]
  );
  const todayHabits = useMemo(
    () => habits.filter((habit) => isHabitDue(habit, todayDateKey)),
    [habits, todayDateKey]
  );

  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [selectedHabitIds, setSelectedHabitIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    status: 'COMPLETED' | 'NOT_COMPLETED';
    completedTaskCount: number;
    totalTaskCount: number;
    completedHabitCount: number;
    totalHabitCount: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setResult(null);
  }, [isOpen, todayDateKey]);

  useEffect(() => {
    if (!isOpen || isSubmitting || result) return;
    setSelectedTaskIds(
      new Set(todayTasks.filter((task) => task.isCompleted).map((task) => task.id))
    );
    setSelectedHabitIds(
      new Set(
        todayHabits
          .filter((habit) => habit.checkIns.includes(todayDateKey))
          .map((habit) => habit.id)
      )
    );
  }, [isOpen, isSubmitting, result, todayTasks, todayHabits, todayDateKey]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  const toggleTaskSelection = (taskId: string) => {
    if (isSubmitting) return;
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleHabitSelection = (habitId: string) => {
    if (isSubmitting) return;
    setSelectedHabitIds((current) => {
      const next = new Set(current);
      if (next.has(habitId)) next.delete(habitId);
      else next.add(habitId);
      return next;
    });
  };

  const handleMarkDay = async () => {
    if (todayTasks.length === 0 && todayHabits.length === 0) {
      setError('No tasks or habits are scheduled for today.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      for (const task of todayTasks) {
        const shouldBeCompleted = selectedTaskIds.has(task.id);
        if (task.isCompleted !== shouldBeCompleted) {
          await onToggleTaskStatus(task.id);
        }
      }

      const reviewedTasks = todayTasks.map((task) => ({
        ...task,
        isCompleted: selectedTaskIds.has(task.id),
      }));

      const reviewedHabits: HabitItem[] = [];
      for (const habit of todayHabits) {
        const shouldBeCheckedIn = selectedHabitIds.has(habit.id);
        const isCheckedIn = habit.checkIns.includes(todayDateKey);
        let reviewedHabit = habit;

        if (isCheckedIn !== shouldBeCheckedIn) {
          const checkIns = shouldBeCheckedIn
            ? [...habit.checkIns, todayDateKey].sort()
            : habit.checkIns.filter((key) => key !== todayDateKey);

          reviewedHabit = {
            ...habit,
            checkIns,
            updatedAt: new Date().toISOString(),
          };
          await onUpdateHabit(reviewedHabit);
        }

        reviewedHabits.push(reviewedHabit);
      }

      const status = await onSubmitTaskDay(todayDateKey, reviewedTasks, reviewedHabits);
      setResult({
        status,
        completedTaskCount: selectedTaskIds.size,
        totalTaskCount: todayTasks.length,
        completedHabitCount: selectedHabitIds.size,
        totalHabitCount: todayHabits.length,
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to mark the day. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const exitReview = () => {
    const openedFromEmail =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('review') === '1';

    if (!openedFromEmail) {
      onClose();
      return;
    }

    // Email review links open in the same browsing context when possible,
    // so Back returns to the message that launched the review.
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    // Fallback for email clients that opened the review in a separate tab/window.
    window.close();
    window.setTimeout(() => {
      if (!window.closed) onClose();
    }, 150);
  };

  const goToDashboard = () => {
    window.location.assign('/');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSubmitting) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Review current day"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {!result ? (
              <>
                <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <ClipboardCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.16em] font-black text-blue-600 dark:text-blue-400">
                        Current Day Review
                      </div>
                      <h2 className="text-lg font-black leading-tight">Mark Current Day</h2>
                      <p className="mt-0.5 text-xs font-mono text-slate-500 dark:text-slate-400">
                        {formatCalendarDate(todayDateKey)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                    aria-label="Close review"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4">
                  <p className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Check completed tasks and today's habit check-ins, then press <strong>Mark Day</strong>.
                  </p>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    {todayTasks.length === 0 ? (
                      <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
                        No tasks were created for today.
                      </div>
                    ) : (
                      todayTasks.map((task) => {
                        const checked = selectedTaskIds.has(task.id);
                        return (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => toggleTaskSelection(task.id)}
                            disabled={isSubmitting}
                            className="w-full flex items-center gap-3 p-3 text-left border-b last:border-b-0 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:cursor-not-allowed"
                          >
                            {checked ? (
                              <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-400 shrink-0" />
                            )}
                            <span className="text-sm font-bold leading-snug">
                              {task.taskOfTheDay}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {todayTasks.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs font-bold mb-1">
                        <span>{selectedTaskIds.size} of {todayTasks.length} completed</span>
                        <span className="font-mono">
                          {Math.round((selectedTaskIds.size / todayTasks.length) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-all duration-200"
                          style={{ width: `${Math.round((selectedTaskIds.size / todayTasks.length) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400">
                      <Repeat2 className="w-4 h-4" />
                      Habits due today
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      {todayHabits.length === 0 ? (
                        <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
                          No habits are due today.
                        </div>
                      ) : (
                        todayHabits.map((habit) => {
                          const checked = selectedHabitIds.has(habit.id);
                          return (
                            <button
                              key={habit.id}
                              type="button"
                              onClick={() => toggleHabitSelection(habit.id)}
                              disabled={isSubmitting}
                              className="w-full flex items-center gap-3 p-3 text-left border-b last:border-b-0 border-slate-200 dark:border-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 disabled:cursor-not-allowed"
                            >
                              {checked ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                              ) : (
                                <Circle className="w-5 h-5 text-slate-400 shrink-0" />
                              )}
                              <span className="text-lg leading-none shrink-0" aria-hidden="true">
                                {habit.emoji}
                              </span>
                              <span className="text-sm font-bold leading-snug min-w-0 flex-1">
                                {habit.name}
                              </span>
                              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                                {checked ? 'Checked in' : 'Check in'}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {todayHabits.length > 0 && (
                      <div className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        {selectedHabitIds.size} of {todayHabits.length} checked in
                      </div>
                    )}
                  </div>
                  {error && (
                    <div className="mt-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleMarkDay}
                    disabled={(todayTasks.length === 0 && todayHabits.length === 0) || isSubmitting || isSyncing}
                    className="mt-4 w-full min-h-11 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white font-black text-sm flex items-center justify-center gap-2"
                  >
                    {isSubmitting || isSyncing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ClipboardCheck className="w-4 h-4" />
                    )}
                    Mark Day
                  </button>

                  <p className="mt-2 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    All tasks and due habits checked = Completed. Any unchecked item = Not Completed.
                  </p>
                </div>
              </>
            ) : (
              <div className="p-5 text-center">
                <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center ${
                  result.status === 'COMPLETED'
                    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600'
                    : 'bg-amber-100 dark:bg-amber-950/50 text-amber-600'
                }`}>
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h2 className="mt-3 text-xl font-black">
                  Day marked {result.status === 'COMPLETED' ? 'Completed' : 'Not Completed'}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {result.completedTaskCount} of {result.totalTaskCount} tasks completed.{' '}
                  {result.completedHabitCount} of {result.totalHabitCount} habits checked in.
                </p>

                <div className="grid grid-cols-2 gap-2 mt-5">
                  <button
                    type="button"
                    onClick={exitReview}
                    className="min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-black text-sm"
                  >
                    Exit
                  </button>
                  <button
                    type="button"
                    onClick={goToDashboard}
                    className="min-h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
