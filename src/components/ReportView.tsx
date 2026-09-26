import React, { FormEvent, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { RotateCcw, X } from 'lucide-react';
import { DailyRecord, FilterState, DashboardTheme, HabitItem, TaskItem } from '../types';
import { calculateKPIStats } from '../utils/daxMeasures';
import { parseDateToTimestamp } from '../utils/dateUtils';
import { CONFIGURED_TIMEZONE, formatCalendarDate, getIsoDateKeyInTimezone } from '../utils/taskDateUtils';
import { TodayTasksCard } from './TodayTasksCard';

export type NavTab = 'ALL' | 'TRENDS' | 'ANALYTICS' | 'TASKS';

const COUNTDOWN_TARGET_DATE_KEY = 'SYSTEM_BUILDER_COUNTDOWN_TARGET_DATE';
const COUNTDOWN_TARGET_REASON_KEY = 'SYSTEM_BUILDER_COUNTDOWN_TARGET_REASON';

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

  // Overall KPIs for hero visual (preserved calculations)
  const allKpis = useMemo(() => calculateKPIStats(records), [records]);

  // Fixed tracked-week cadence:
  // Week 1 = D1-D7, Week 2 = D8-D14, Week 3 = D15-D21, etc.
  const recentWeekCadence = useMemo(() => {
    const latestDay = records.reduce((maxDay, record) => Math.max(maxDay, record.day), 0);
    const weekNumber = latestDay > 0 ? Math.ceil(latestDay / 7) : 1;
    const startDay = (weekNumber - 1) * 7 + 1;
    const endDay = weekNumber * 7;
    const weekRecords = [...records]
      .filter((record) => record.day >= startDay && record.day <= endDay)
      .sort((a, b) => a.day - b.day);
    const completedDays = weekRecords.filter((record) => record.isCompleted).length;
    const performance = Math.min(100, (completedDays / 7) * 100);

    return {
      weekNumber,
      startDay,
      endDay,
      records: weekRecords,
      completedDays,
      performance,
    };
  }, [records]);

  const currentCadenceDay = useMemo(() => {
    const dateKey = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
    const [year, month, day] = dateKey.split('-').map(Number);
    const fullDayName = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));

    return {
      formattedDate: formatCalendarDate(dateKey),
      fullDayName,
    };
  }, []);

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

    const todayKey = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
    const [todayYear, todayMonth, todayDay] = todayKey.split('-').map(Number);
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
  }, [customCountdownDate, customCountdownReason, defaultCountdownTarget]);

  const openCountdownEditor = () => {
    setDraftCountdownDate(customCountdownDate || defaultCountdownTarget);
    setDraftCountdownReason(
      customCountdownReason || (customCountdownDate ? '' : '1,800-day mastery goal')
    );
    setIsCountdownEditorOpen(true);
  };

  const saveCountdownTarget = (event: FormEvent) => {
    event.preventDefault();
    if (!draftCountdownDate) return;

    const reason = draftCountdownReason.trim();
    setCustomCountdownDate(draftCountdownDate);
    setCustomCountdownReason(reason);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COUNTDOWN_TARGET_DATE_KEY, draftCountdownDate);
      window.localStorage.setItem(COUNTDOWN_TARGET_REASON_KEY, reason);
    }

    setIsCountdownEditorOpen(false);
  };

  const resetCountdownTarget = () => {
    setCustomCountdownDate('');
    setCustomCountdownReason('');
    setDraftCountdownDate(defaultCountdownTarget);
    setDraftCountdownReason('1,800-day mastery goal');

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(COUNTDOWN_TARGET_DATE_KEY);
      window.localStorage.removeItem(COUNTDOWN_TARGET_REASON_KEY);
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
      <motion.div
        id="today-focus-section"
        aria-label="Today's Commitments and Key Metrics"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.36, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
        className="min-w-0 min-h-0 flex flex-col lg:h-[430px]"
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
          currentWeekCadencePercentage={Math.round(recentWeekCadence.performance)}
          overallCompletionPercentage={allKpis.completionRate}
          completedDays={allKpis.completedDays}
          totalDays={allKpis.totalDays}
          countdownDaysRemaining={longTermCountdown.daysRemaining}
          countdownReason={longTermCountdown.reason}
          countdownTargetLabel={longTermCountdown.targetDateLabel}
          onOpenCountdown={openCountdownEditor}
          isSyncing={isSyncing}
        />
      </motion.div>

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
