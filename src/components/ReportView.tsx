import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { RotateCcw, X } from 'lucide-react';
import { DailyRecord, FilterState, DashboardTheme, HabitItem, TaskItem } from '../types';
import { parseDateToTimestamp } from '../utils/dateUtils';
import { CONFIGURED_TIMEZONE, formatCalendarDate } from '../utils/taskDateUtils';
import { isHabitDue } from '../utils/habitUtils';
import { useCurrentDateKey } from '../hooks/useCurrentDateKey';
import { TodayTasksCard } from './TodayTasksCard';
import { CommandCenterSidebar } from './CommandCenterSidebar';
import { PerformanceIntelligence } from './PerformanceIntelligence';
import {
  saveCountdownSettings,
  subscribeToCountdownSettings,
} from '../services/firebaseService';

export type NavTab = 'ALL' | 'TRENDS' | 'ANALYTICS' | 'TASKS';

const COUNTDOWN_TARGET_DATE_KEY = 'SYSTEM_BUILDER_COUNTDOWN_TARGET_DATE';
const COUNTDOWN_TARGET_REASON_KEY = 'SYSTEM_BUILDER_COUNTDOWN_TARGET_REASON';
const SYSTEM_BUILDER_START_DATE_KEY = '2026-08-01';

const addDays = (dateKey: string, amount: number) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
};

interface ReportViewProps {
  records: DailyRecord[];
  tasks: TaskItem[];
  habits: HabitItem[];
  filterState: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  theme: DashboardTheme;
  onToggleRecordStatus: (id: string) => void;
  onSelectRecord?: (record: DailyRecord) => void;
  onUpdateRecord?: (record: DailyRecord) => void;
  onOpenAddModal?: () => void;
  activeTab?: NavTab;
  onTabChange?: (tab: NavTab) => void;
  // Task management handlers
  onAddTask: (task: Omit<TaskItem, 'id'>) => Promise<void>;
  onUpdateTask: (task: TaskItem) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onToggleTaskStatus: (taskId: string) => Promise<void>;
  onSubmitTaskDay: (
    dateKey: string,
    dayTasks: TaskItem[]
  ) => Promise<'COMPLETED' | 'NOT_COMPLETED'>;
  onOpenDayReview: () => void;
  isSyncing?: boolean;
  focusMode?: boolean;
}

/**
 * Animated SVG Checkmark that smoothly draws its stroke using Framer Motion pathLength.
 */
export const SmoothCheckmark: React.FC<{
  className?: string;
  strokeWidth?: number;
}> = ({ className = 'w-4 h-4', strokeWidth = 3 }) => {
  return (
    <motion.svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      initial={{ scale: 0.5, rotate: -25, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      exit={{ scale: 0.5, rotate: 25, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
    >
      <motion.path
        d="M4 12.6L8.5 17L20 6.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        exit={{ pathLength: 0, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      />
    </motion.svg>
  );
};

export const ReportView: React.FC<ReportViewProps> = ({
  records,
  tasks,
  habits,
  filterState,
  theme,
  onToggleRecordStatus,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onToggleTaskStatus,
  onSubmitTaskDay,
  onOpenDayReview,
  isSyncing = false,
  focusMode = false,
}) => {
  const isDark = theme === 'dark';
  const [isCountdownEditorOpen, setIsCountdownEditorOpen] = useState(false);
  const [customCountdownDate, setCustomCountdownDate] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(COUNTDOWN_TARGET_DATE_KEY) || '';
  });
  const [customCountdownReason, setCustomCountdownReason] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(COUNTDOWN_TARGET_REASON_KEY) || '';
  });
  const [draftCountdownDate, setDraftCountdownDate] = useState('');
  const [draftCountdownReason, setDraftCountdownReason] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeToCountdownSettings(
      (settings) => {
        if (typeof window === 'undefined') return;

        if (!settings) {
          const localDate =
            window.localStorage.getItem(COUNTDOWN_TARGET_DATE_KEY) || '';
          const localReason =
            window.localStorage.getItem(COUNTDOWN_TARGET_REASON_KEY) || '';

          if (localDate || localReason) {
            void saveCountdownSettings({
              targetDate: localDate,
              reason: localReason,
            }).catch((error) => {
              console.warn('Unable to seed countdown settings to cloud:', error);
            });
          }
          return;
        }

        setCustomCountdownDate(settings.targetDate);
        setCustomCountdownReason(settings.reason);

        if (settings.targetDate) {
          window.localStorage.setItem(
            COUNTDOWN_TARGET_DATE_KEY,
            settings.targetDate
          );
        } else {
          window.localStorage.removeItem(COUNTDOWN_TARGET_DATE_KEY);
        }

        if (settings.reason) {
          window.localStorage.setItem(
            COUNTDOWN_TARGET_REASON_KEY,
            settings.reason
          );
        } else {
          window.localStorage.removeItem(COUNTDOWN_TARGET_REASON_KEY);
        }
      },
      (error) => {
        console.warn(
          'Using local countdown settings because cloud sync is unavailable:',
          error
        );
      }
    );

    return () => unsubscribe();
  }, []);

  // Apply filters to daily records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Status filter
      if (filterState.status === 'COMPLETED' && !r.isCompleted) return false;
      if (filterState.status === 'PENDING' && r.isCompleted) return false;

      // Date range filter
      if (filterState.dateRange === '7D' && r.day > 7) return false;
      if (filterState.dateRange === '14D' && r.day > 14) return false;
      if (filterState.dateRange === '30D' && r.day > 30) return false;

      return true;
    });
  }, [records, filterState]);

  const currentDateKey = useCurrentDateKey(CONFIGURED_TIMEZONE);

  const achievedWeeks = useMemo(() => {
    if (tasks.length === 0) return 0;

    const addDays = (dateKey: string, days: number) => {
      const [year, month, day] = dateKey.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day + days));
      return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0'),
      ].join('-');
    };
    const getMonday = (dateKey: string) => {
      const [year, month, day] = dateKey.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      const weekday = date.getUTCDay();
      const diff = weekday === 0 ? -6 : 1 - weekday;
      return addDays(dateKey, diff);
    };
    const dailyRate = (dateKey: string) => {
      const dayTasks = tasks.filter((task) => task.taskKey === dateKey);
      if (dayTasks.length === 0) return 0;
      return (dayTasks.filter((task) => task.isCompleted).length / dayTasks.length) * 100;
    };

    const firstTaskDate = tasks.map((task) => task.taskKey).sort()[0];
    if (!firstTaskDate) return 0;

    let weekStart = getMonday(firstTaskDate);
    const currentWeekStart = getMonday(currentDateKey);
    let achieved = 0;
    let guard = 0;

    while (weekStart < currentWeekStart && guard < 5200) {
      const score =
        Array.from({ length: 7 }, (_, index) => dailyRate(addDays(weekStart, index)))
          .reduce((sum, rate) => sum + rate, 0) / 7;
      if (score >= 80) achieved += 1;
      weekStart = addDays(weekStart, 7);
      guard += 1;
    }
    return achieved;
  }, [tasks, currentDateKey]);


  // Overall = Successful Days / Total calendar days since 1 Aug 2026 × 100.
  const commandCenterOverall = useMemo(() => {
    const startUtc = Date.UTC(2026, 7, 1);
    const [year, month, day] = currentDateKey.split('-').map(Number);
    const todayUtc = Date.UTC(year, month - 1, day);
    const totalDays = Math.max(0, Math.floor((todayUtc - startUtc) / (24 * 60 * 60 * 1000)) + 1);
    const completedDays = records.reduce((sum, record) => sum + (record.isCompleted ? 1 : 0), 0);
    const completionRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
    return { completedDays, totalDays, completionRate };
  }, [records, currentDateKey]);

  const currentFocusTask = useMemo(
    () =>
      tasks.find(
        (task) => task.taskKey === currentDateKey && !task.isCompleted
      ) || null,
    [tasks, currentDateKey]
  );

  const currentCadenceDay = useMemo(() => {
    const [year, month, day] = currentDateKey.split('-').map(Number);
    const fullDayName = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));

    return {
      formattedDate: formatCalendarDate(currentDateKey),
      fullDayName,
    };
  }, [currentDateKey]);

  // Default countdown = the app's 1,800-day mastery horizon.
  // A saved custom date/reason overrides the default until reset.
  const defaultCountdownTarget = useMemo(() => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const HORIZON_DAYS = 1800;

    const firstTimestamp = records
      .map((record) => parseDateToTimestamp(record.date))
      .filter((timestamp) => timestamp > 0)
      .sort((a, b) => a - b)[0];

    if (!firstTimestamp) return '';

    const firstDate = new Date(firstTimestamp);
    const startUtc = Date.UTC(
      firstDate.getFullYear(),
      firstDate.getMonth(),
      firstDate.getDate()
    );
    const targetDate = new Date(startUtc + HORIZON_DAYS * DAY_MS);

    return [
      targetDate.getUTCFullYear(),
      String(targetDate.getUTCMonth() + 1).padStart(2, '0'),
      String(targetDate.getUTCDate()).padStart(2, '0'),
    ].join('-');
  }, [records]);

  const longTermCountdown = useMemo(() => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const HORIZON_DAYS = 1800;
    const targetDateKey = customCountdownDate || defaultCountdownTarget;

    if (!targetDateKey) {
      return {
        daysRemaining: HORIZON_DAYS,
        targetDateLabel: 'Start logging to begin',
        reason: customCountdownReason || '1,800-day mastery goal',
        isCustom: Boolean(customCountdownDate),
      };
    }

    const [targetYear, targetMonth, targetDay] = targetDateKey.split('-').map(Number);
    const targetUtc = Date.UTC(targetYear, targetMonth - 1, targetDay);

    const [todayYear, todayMonth, todayDay] = currentDateKey.split('-').map(Number);
    const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay);

    const daysRemaining = Math.max(0, Math.ceil((targetUtc - todayUtc) / DAY_MS));
    const targetDateLabel = new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(targetUtc));

    return {
      daysRemaining,
      targetDateLabel,
      reason: customCountdownReason || '1,800-day mastery goal',
      isCustom: Boolean(customCountdownDate),
    };
  }, [customCountdownDate, customCountdownReason, defaultCountdownTarget, currentDateKey]);

  const openCountdownEditor = () => {
    setDraftCountdownDate(customCountdownDate || defaultCountdownTarget);
    setDraftCountdownReason(
      customCountdownReason || (customCountdownDate ? '' : '1,800-day mastery goal')
    );
    setIsCountdownEditorOpen(true);
  };

  const saveCountdownTarget = async (event: FormEvent) => {
    event.preventDefault();
    if (!draftCountdownDate) return;

    const reason = draftCountdownReason.trim();
    setCustomCountdownDate(draftCountdownDate);
    setCustomCountdownReason(reason);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COUNTDOWN_TARGET_DATE_KEY, draftCountdownDate);
      window.localStorage.setItem(COUNTDOWN_TARGET_REASON_KEY, reason);
    }

    try {
      await saveCountdownSettings({
        targetDate: draftCountdownDate,
        reason,
      });
    } catch (error) {
      console.warn(
        'Countdown saved locally; cloud persistence is temporarily unavailable:',
        error
      );
    }

    setIsCountdownEditorOpen(false);
  };

  const resetCountdownTarget = async () => {
    setCustomCountdownDate('');
    setCustomCountdownReason('');
    setDraftCountdownDate(defaultCountdownTarget);
    setDraftCountdownReason('1,800-day mastery goal');

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(COUNTDOWN_TARGET_DATE_KEY);
      window.localStorage.removeItem(COUNTDOWN_TARGET_REASON_KEY);
    }

    try {
      await saveCountdownSettings({
        targetDate: '',
        reason: '',
      });
    } catch (error) {
      console.warn(
        'Countdown reset locally; cloud persistence is temporarily unavailable:',
        error
      );
    }

    setIsCountdownEditorOpen(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full space-y-4 sm:space-y-5"
    >
      <section
        id="today-focus-section"
        aria-label="Today Command Center"
        className="space-y-2"
      >
        <div className="grid grid-cols-1 gap-3 items-stretch xl:grid-cols-[minmax(0,1fr)_320px] xl:h-[430px]">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="min-w-0 min-h-0 xl:h-full flex flex-col"
          >
            <TodayTasksCard
              tasks={tasks}
              habits={habits}
              theme={theme}
              onAddTask={onAddTask}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              onToggleTaskStatus={onToggleTaskStatus}
              onOpenDayReview={onOpenDayReview}
              currentDayFormatted={currentCadenceDay.formattedDate}
              currentDayName={currentCadenceDay.fullDayName}
              isSyncing={isSyncing}
              focusMode={focusMode}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="min-w-0 min-h-0 xl:h-full"
          >
            <CommandCenterSidebar
              theme={theme}
              currentDayFormatted={currentCadenceDay.formattedDate}
              currentDayName={currentCadenceDay.fullDayName}
              overallCompletionPercentage={commandCenterOverall.completionRate}
              achievedWeeks={achievedWeeks}
              completedDays={commandCenterOverall.completedDays}
              totalDays={commandCenterOverall.totalDays}
              countdownDaysRemaining={longTermCountdown.daysRemaining}
              countdownReason={longTermCountdown.reason}
              countdownTargetLabel={longTermCountdown.targetDateLabel}
              currentTaskTitle={currentFocusTask?.taskOfTheDay || 'No active task for today'}
              onOpenCountdown={openCountdownEditor}
              focusMode={focusMode}
            />
          </motion.div>
        </div>
      </section>

      {!focusMode && (
        <PerformanceIntelligence
          tasks={tasks}
          habits={habits}
          records={records}
          currentDateKey={currentDateKey}
          achievedWeeks={achievedWeeks}
        />
      )}

      {isCountdownEditorOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-[2px]"
              role="dialog"
              aria-modal="true"
              aria-label="Edit countdown target"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setIsCountdownEditorOpen(false);
              }}
            >
              <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                      Countdown Target
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Enter a date or choose one from the calendar, then add the target or reason.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCountdownEditorOpen(false)}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    aria-label="Close countdown editor"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={saveCountdownTarget} className="space-y-4">
                  <div>
                    <label
                      htmlFor="countdown-target-date"
                      className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5"
                    >
                      Target date
                    </label>
                    <input
                      id="countdown-target-date"
                      type="date"
                      required
                      autoFocus
                      value={draftCountdownDate}
                      onChange={(event) => setDraftCountdownDate(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') setIsCountdownEditorOpen(false);
                      }}
                      className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                    />
                    <p className="mt-1 text-[10px] text-slate-400">
                      You can type the date or use the calendar picker.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="countdown-target-reason"
                      className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5"
                    >
                      Target / reason
                    </label>
                    <textarea
                      id="countdown-target-reason"
                      rows={3}
                      maxLength={160}
                      value={draftCountdownReason}
                      onChange={(event) => setDraftCountdownReason(event.target.value)}
                      placeholder="e.g. Become job-ready Data Analyst"
                      className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-blue-500"
                    />
                    <div className="mt-1 text-right text-[9px] font-mono text-slate-400">
                      {draftCountdownReason.length}/160
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/25 p-3">
                    <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
                      Current countdown
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-3">
                      <span className="text-xl font-black font-mono text-blue-600 dark:text-blue-300">
                        {longTermCountdown.daysRemaining} days
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        {longTermCountdown.targetDateLabel}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={resetCountdownTarget}
                      className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center justify-center gap-1.5"
                      title="Reset to the default 1,800-day goal"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Default
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCountdownEditorOpen(false)}
                      className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!draftCountdownDate}
                      className="h-10 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs font-black"
                    >
                      Save Countdown
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </motion.div>
  );
};
