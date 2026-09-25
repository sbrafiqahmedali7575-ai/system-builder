import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Award } from 'lucide-react';
import { DailyRecord, FilterState, DashboardTheme, TaskItem } from '../types';
import { calculateKPIStats } from '../utils/daxMeasures';
import { isTodayDate, parseDateToTimestamp } from '../utils/dateUtils';
import { CONFIGURED_TIMEZONE, formatCalendarDate, getIsoDateKeyInTimezone } from '../utils/taskDateUtils';
import { TrendsVisual } from './TrendsVisual';
import { TodayTasksCard } from './TodayTasksCard';
import { NinjaBadgeProgress } from './NinjaBadgeProgress';
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
        className={`ninja-focus-panel ui-motion-section p-2.5 sm:p-3.5 rounded-3xl border transition-all ${
          isDark
            ? 'bg-slate-900/60 border-slate-800'
            : 'bg-white border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
        }`}
      >
        <div className="space-y-2.5">
          {/* Card 1: KPI's — full-width horizontal summary */}
          <div
            className={`ninja-kpi-shell ui-motion-shell p-2 sm:p-2.5 rounded-2xl border transition-all ${
              isDark
                ? 'bg-slate-900/80 border-slate-800'
                : 'bg-slate-50/70 border-slate-200/80'
            }`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-10 gap-1.5 sm:gap-2">
              {/* Metric 1: Overall Completion */}
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.995 }}
                className={`xl:col-span-2 p-2 rounded-xl border flex flex-col justify-between min-h-[118px] relative overflow-hidden group transition-all ${
                  isDark
                    ? 'bg-slate-900/60 border-slate-800 hover:border-blue-700/60'
                    : 'bg-white border-slate-200/80 shadow-2xs hover:border-blue-300 hover:shadow-md'
                }`}
              >
                <div className="absolute -right-5 -top-5 w-20 h-20 rounded-full bg-blue-500/8 group-hover:scale-125 transition-transform duration-500" />
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 opacity-70" />

                <div className="relative flex items-center text-xs text-slate-400">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <motion.div
                      initial={{ scale: 0.72, rotate: -12, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                      className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 ring-2 ring-blue-400/30 flex items-center justify-center shrink-0"
                    >
                      <Award className="w-3.5 h-3.5 text-blue-500" />
                    </motion.div>
                    <span className="font-black uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-200">
                      Overall Completion
                    </span>
                  </div>
                </div>

                <div className="relative mt-1 flex flex-1 items-center">
                  <div className="min-w-0 w-full text-left" style={{ paddingLeft: '10%' }}>
                    <div className="flex items-baseline justify-start">
                      <span
                        className={`text-2xl font-extrabold font-mono ${
                          allKpis.completionRate >= 80
                            ? 'text-blue-500'
                            : isDark
                            ? 'text-slate-200'
                            : 'text-slate-800'
                        }`}
                      >
                        {allKpis.completionRate.toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {allKpis.completedDays}/{allKpis.totalDays} days completed
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Metric 2: Active Streak */}
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.32, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.995 }}
                className={`xl:col-span-2 p-2 rounded-xl border flex flex-col justify-between min-h-[118px] relative overflow-hidden group transition-all ${
                  isDark
                    ? 'bg-slate-900/60 border-slate-800 hover:border-amber-700/60'
                    : 'bg-white border-slate-200/80 shadow-2xs hover:border-amber-300 hover:shadow-md'
                }`}
              >
                <div className="absolute -right-5 -top-5 w-20 h-20 rounded-full bg-amber-500/8 group-hover:scale-125 transition-transform duration-500" />
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-amber-500 via-yellow-400 to-red-500 opacity-70" />

                <div className="relative flex items-center text-xs text-slate-400">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <motion.div
                      initial={{ scale: 0.72, rotate: -12, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.05 }}
                      className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 ring-2 ring-amber-400/30 flex items-center justify-center shrink-0"
                    >
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                    </motion.div>
                    <span className="font-black uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-200">
                      Active Streak
                    </span>
                  </div>
                </div>

                <div className="relative mt-1 flex flex-1 items-center">
                  <div className="min-w-0 w-full text-left" style={{ paddingLeft: '10%' }}>
                    <div className="flex items-baseline justify-start gap-1">
                      <span className="text-2xl font-extrabold font-mono text-amber-600 dark:text-amber-400">
                        {allKpis.currentStreak}
                      </span>
                      <span className="text-[10px] text-slate-400">active days</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Personal best: {allKpis.maxStreak} days
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Metric 3: Current Week Cadence */}
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.32, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.995 }}
                className={`xl:col-span-3 p-2 rounded-xl border flex flex-col justify-between min-h-[118px] relative overflow-hidden group transition-all ${
                  isDark
                    ? 'bg-slate-900/60 border-slate-800 hover:border-blue-700/60'
                    : 'bg-white border-slate-200/80 shadow-2xs hover:border-blue-300 hover:shadow-md'
                }`}
              >
                <div className="absolute -right-5 -top-5 w-20 h-20 rounded-full bg-blue-500/8 group-hover:scale-125 transition-transform duration-500" />
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-blue-500 via-amber-400 to-red-500 opacity-70" />

                <div className="relative flex items-center justify-between text-xs mb-1 gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <AnimatedProgressRing
                      value={recentWeekCadence.performance}
                      size={30}
                      strokeWidth={3}
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
                    <span className="font-black uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-200">
                      Current Week Cadence
                    </span>
                  </div>
                  <span className="text-blue-600 dark:text-blue-400 font-bold font-mono text-xs shrink-0">
                    {recentWeekCadence.completedDays}/7 Done
                  </span>
                </div>

                <div className="relative mb-1 text-[9px] font-semibold text-slate-500 dark:text-slate-400">
                  Current Day • <span className="font-mono">{currentCadenceDay.formattedDate}</span> • {currentCadenceDay.fullDayName}
                </div>

                <div className="relative">
                  <div className="w-full min-w-0">
                    <div className="flex items-center justify-between gap-1 p-1.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800">
                      {recentWeekCadence.records.map((r) => {
                        const isToday = isTodayDate(r.date);
                        const timestamp = parseDateToTimestamp(r.date);
                        const pointDate = timestamp > 0 ? new Date(timestamp) : null;
                        const weekdayName = pointDate
                          ? pointDate.toLocaleDateString('en-US', { weekday: 'long' })
                          : '';
                        const compactDate = pointDate
                          ? pointDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })
                          : '';
                        return (
                          <motion.div
                            key={r.id}
                            whileHover={{ y: -1, scale: 1.03 }}
                            className="flex-1 flex flex-col items-center gap-0.5"
                            title={`Day ${r.day} (${r.date}): ${r.isCompleted ? 'Completed' : 'Not Completed'}`}
                          >
                            <div className="min-h-[24px] flex flex-col items-center justify-end leading-none">
                              <span className={`text-[7px] font-bold whitespace-nowrap ${
                                isToday
                                  ? 'text-blue-600 dark:text-blue-300'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}>
                                {weekdayName}
                              </span>
                              <span className="mt-0.5 text-[7px] font-mono text-slate-400 whitespace-nowrap">
                                {compactDate}
                              </span>
                            </div>
                            <span
                              className={`w-full h-2.5 rounded-full transition-all ${
                                r.isCompleted
                                  ? 'bg-blue-500'
                                  : 'bg-slate-200 dark:bg-slate-800'
                              } ${isToday ? 'ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-slate-900' : ''}`}
                            />
                            <span className="text-[9px] font-mono text-slate-400">
                              D{r.day}
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Metric 4: Long-term Badge Rank */}
              <div className="xl:col-span-3 min-w-0">
                <NinjaBadgeProgress
                  completedDays={allKpis.completedDays}
                  theme={theme}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Today's Tasks — full width below KPI's */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col"
          >
            <TodayTasksCard
              tasks={tasks}
              theme={theme}
              onAddTask={onAddTask}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              onToggleTaskStatus={onToggleTaskStatus}
              isSyncing={isSyncing}
            />
          </motion.div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          2. SECTION: TRENDS & MOVING AVERAGE
      ───────────────────────────────────────────────────────────── */}
      <section aria-label="Consistency Trends & Moving Average">
        <TrendsVisual
          records={filteredRecords}
          theme={theme}
          onToggleRecordStatus={onToggleRecordStatus}
        />
      </section>
    </motion.div>
  );
};
