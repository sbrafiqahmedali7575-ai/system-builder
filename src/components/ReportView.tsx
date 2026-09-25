import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Award } from 'lucide-react';
import { DailyRecord, FilterState, DashboardTheme, TaskItem } from '../types';
import { calculateKPIStats } from '../utils/daxMeasures';
import { isTodayDate } from '../utils/dateUtils';
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

  // Last 7 days records for consistency cadence
  const last7Records = useMemo(() => {
    return [...records].sort((a, b) => b.day - a.day).slice(0, 7).reverse();
  }, [records]);
  const last7CompletedDays = last7Records.filter((record) => record.isCompleted).length;
  const last7Performance = Math.min(100, (last7CompletedDays / 7) * 100);

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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-1.5 sm:gap-2">
              {/* Metric 1: Overall Completion */}
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.995 }}
                className={`p-2 rounded-xl border flex flex-col justify-between min-h-[118px] relative overflow-hidden group transition-all ${
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
                  <div className="min-w-0 w-full text-left" style={{ paddingLeft: '20%' }}>
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
                className={`p-2 rounded-xl border flex flex-col justify-between min-h-[118px] relative overflow-hidden group transition-all ${
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
                  <div className="min-w-0 w-full text-left" style={{ paddingLeft: '20%' }}>
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

              {/* Metric 3: Recent 7-Day Cadence */}
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.32, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.995 }}
                className={`p-2 rounded-xl border flex flex-col justify-between min-h-[118px] relative overflow-hidden group transition-all ${
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
                      value={last7Performance}
                      size={30}
                      strokeWidth={3}
                      progressClassName={
                        last7Performance >= 80
                          ? 'text-blue-500'
                          : last7Performance >= 50
                          ? 'text-amber-500'
                          : 'text-rose-500'
                      }
                      label={`${Math.round(last7Performance)}%`}
                      delay={0.12}
                    />
                    <span className="font-black uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-200">
                      Recent 7-Day Cadence
                    </span>
                  </div>
                  <span className="text-blue-600 dark:text-blue-400 font-bold font-mono text-xs shrink-0">
                    {last7CompletedDays}/7 Done
                  </span>
                </div>

                <div className="relative">
                  <div className="w-full min-w-0">
                    <div className="flex items-center justify-between gap-1 p-1.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800">
                      {last7Records.map((r) => {
                        const isToday = isTodayDate(r.date);
                        return (
                          <motion.div
                            key={r.id}
                            whileHover={{ y: -1, scale: 1.03 }}
                            className="flex-1 flex flex-col items-center gap-0.5"
                            title={`Day ${r.day} (${r.date}): ${r.isCompleted ? 'Completed' : 'Not Completed'}`}
                          >
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
              <NinjaBadgeProgress
                completedDays={allKpis.completedDays}
                theme={theme}
              />
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
