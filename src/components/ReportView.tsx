import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Award } from 'lucide-react';
import { DailyRecord, FilterState, DashboardTheme, TaskItem } from '../types';
import { calculateKPIStats } from '../utils/daxMeasures';
import { isTodayDate, parseDateToTimestamp } from '../utils/dateUtils';
import { CONFIGURED_TIMEZONE, formatCalendarDate, getIsoDateKeyInTimezone } from '../utils/taskDateUtils';
import { TodayTasksCard } from './TodayTasksCard';
import { AnimatedProgressRing } from './AnimatedProgressRing';

export type NavTab = 'ALL' | 'TRENDS' | 'ANALYTICS' | 'TASKS';

interface ReportViewProps {
  records: DailyRecord[];
  tasks: TaskItem[];
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full space-y-4 sm:space-y-5"
    >
      {/* ─────────────────────────────────────────────────────────────
          TODAY'S COMMITMENTS & KPIS - Tasks Card & KPI Cadence Card
      ───────────────────────────────────────────────────────────── */}
      <section
        id="today-focus-section"
        aria-label="Today's Commitments and Key Metrics"
        className={`system-focus-panel ui-motion-section p-2.5 sm:p-3.5 rounded-3xl border transition-all ${
          isDark
            ? 'bg-slate-900/60 border-slate-800'
            : 'bg-white border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
        }`}
      >
        <div className="space-y-2.5">
          {/* Card 1: Merged progress overview */}
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -2 }}
            className={`system-kpi-shell ui-motion-shell p-2.5 sm:p-3 rounded-2xl border relative overflow-hidden transition-all ${
              isDark
                ? 'bg-slate-900/80 border-slate-800'
                : 'bg-slate-50/70 border-slate-200/80'
            }`}
          >
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-blue-500 via-cyan-400 via-amber-400 to-red-500 opacity-80" />

            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] font-black text-slate-500 dark:text-slate-400">
                  Progress Overview
                </p>
                <p className="text-[10px] text-slate-400">
                  Overall consistency and current 7-day cadence
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold text-slate-400">Current day</span>
                <p className="text-[11px] font-black text-slate-700 dark:text-slate-200">
                  <span className="font-mono">{currentCadenceDay.formattedDate}</span> • {currentCadenceDay.fullDayName}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[0.9fr_1.6fr] gap-2.5 md:divide-x divide-slate-200 dark:divide-slate-800">
              <div className="min-w-0 md:pr-3">
                <div className="flex items-center gap-2">
                  <motion.div
                    initial={{ scale: 0.72, rotate: -12, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                    className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 ring-2 ring-blue-400/30 flex items-center justify-center shrink-0"
                  >
                    <Award className="w-4 h-4 text-blue-500" />
                  </motion.div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-black text-slate-600 dark:text-slate-300">
                      Overall Completion
                    </p>
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={`text-3xl font-black font-mono ${
                          allKpis.completionRate >= 80
                            ? 'text-blue-500'
                            : isDark
                            ? 'text-slate-100'
                            : 'text-slate-900'
                        }`}
                      >
                        {allKpis.completionRate.toFixed(1)}%
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {allKpis.completedDays}/{allKpis.totalDays} days
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, allKpis.completionRate)}%` }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full bg-blue-500"
                  />
                </div>

                <div className="mt-2 grid grid-cols-2 gap-1.5 text-center">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/50 px-2 py-1.5">
                    <p className="text-[9px] uppercase font-black text-slate-400">Completed</p>
                    <p className="text-sm font-black font-mono text-blue-600 dark:text-blue-300">
                      {allKpis.completedDays}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/50 px-2 py-1.5">
                    <p className="text-[9px] uppercase font-black text-slate-400">Total Logged</p>
                    <p className="text-sm font-black font-mono text-slate-700 dark:text-slate-200">
                      {allKpis.totalDays}
                    </p>
                  </div>
                </div>
              </div>

              <div className="min-w-0 md:pl-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <AnimatedProgressRing
                      value={recentWeekCadence.performance}
                      size={38}
                      strokeWidth={4}
                      progressClassName={
                        recentWeekCadence.performance >= 80
                          ? 'text-blue-500'
                          : recentWeekCadence.performance >= 50
                          ? 'text-amber-500'
                          : 'text-rose-500'
                      }
                      label={`${Math.round(recentWeekCadence.performance)}%`}
                      delay={0.12}
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider font-black text-slate-600 dark:text-slate-300">
                        Current Week Cadence
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Week {recentWeekCadence.weekNumber} • D{recentWeekCadence.startDay}–D{recentWeekCadence.endDay}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-black font-mono text-blue-600 dark:text-blue-300">
                      {recentWeekCadence.completedDays}/7
                    </p>
                    <p className="text-[9px] font-bold text-slate-400">days done</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1 p-1.5 rounded-xl bg-white/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                  {recentWeekCadence.records.map((r) => {
                    const isToday = isTodayDate(r.date);
                    const timestamp = parseDateToTimestamp(r.date);
                    const pointDate = timestamp > 0 ? new Date(timestamp) : null;
                    const weekdayName = pointDate
                      ? pointDate.toLocaleDateString('en-US', { weekday: 'short' })
                      : '';
                    const compactDate = pointDate
                      ? pointDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })
                      : '';

                    return (
                      <motion.div
                        key={r.id}
                        whileHover={{ y: -1, scale: 1.03 }}
                        className="flex-1 min-w-0 flex flex-col items-center gap-0.5"
                        title={`Day ${r.day} (${r.date}): ${r.isCompleted ? 'Completed' : 'Not Completed'}`}
                      >
                        <span
                          className={`text-[8px] font-black whitespace-nowrap ${
                            isToday
                              ? 'text-blue-600 dark:text-blue-300'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {weekdayName}
                        </span>
                        <span className="text-[7px] font-mono text-slate-400 whitespace-nowrap">
                          {compactDate}
                        </span>
                        <span
                          className={`w-full h-2.5 rounded-full transition-all ${
                            r.isCompleted
                              ? 'bg-blue-500'
                              : 'bg-slate-200 dark:bg-slate-800'
                          } ${isToday ? 'ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-slate-900' : ''}`}
                        />
                        <span className="text-[9px] font-mono text-slate-400">D{r.day}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Today's Tasks — full width */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="min-w-0 flex flex-col"
          >
            <TodayTasksCard
              tasks={tasks}
              theme={theme}
              onAddTask={onAddTask}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              onToggleTaskStatus={onToggleTaskStatus}
              onOpenDayReview={onOpenDayReview}
              isSyncing={isSyncing}
            />
          </motion.div>
        </div>
      </section>

    </motion.div>
  );
};
