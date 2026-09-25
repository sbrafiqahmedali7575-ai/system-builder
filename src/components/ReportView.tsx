import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Award } from 'lucide-react';
import { DailyRecord, FilterState, DashboardTheme, TaskItem } from '../types';
import { calculateKPIStats } from '../utils/daxMeasures';
import { isTodayDate } from '../utils/dateUtils';
import { TrendsVisual } from './TrendsVisual';
import { TodayTasksCard } from './TodayTasksCard';
import { NinjaBadgeProgress } from './NinjaBadgeProgress';

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
        className={`ninja-focus-panel p-2.5 sm:p-3.5 rounded-3xl border transition-all ${
          isDark
            ? 'bg-slate-900/60 border-slate-800'
            : 'bg-white border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
        }`}
      >
        <div className="space-y-2.5">
          {/* Card 1: KPI's — full-width horizontal summary */}
          <div
            className={`ninja-kpi-shell p-2 sm:p-2.5 rounded-2xl border transition-all ${
              isDark
                ? 'bg-slate-900/80 border-slate-800'
                : 'bg-slate-50/70 border-slate-200/80'
            }`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-1.5 sm:gap-2">
              {/* Metric 1: Overall Completion */}
              <div
                className={`p-2 rounded-xl border flex flex-col justify-between min-h-[118px] ${
                  isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/80 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
                    Overall Completion
                  </span>
                  <Award className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div className="my-1 flex items-baseline space-x-1">
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
                  <span className="text-xs text-slate-400 font-medium">Standard 80%</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {allKpis.completionRate >= 80
                    ? 'Target ≥80% achieved'
                    : `${(80 - allKpis.completionRate).toFixed(1)}% to 80% mastery`}
                </p>
              </div>

              {/* Metric 2: Active Streak */}
              <div
                className={`p-2 rounded-xl border flex flex-col justify-between min-h-[118px] ${
                  isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/80 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
                    Active Streak
                  </span>
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="my-1 flex items-baseline space-x-1">
                  <span className="text-2xl font-extrabold font-mono text-amber-600 dark:text-amber-400">
                    {allKpis.currentStreak} Days
                  </span>
                  <span className="text-xs text-slate-400">active</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Max: {allKpis.maxStreak} days
                </p>
              </div>

              {/* Metric 3: Recent 7-Day Cadence */}
              <div
                className={`p-2 rounded-xl border flex flex-col justify-between min-h-[118px] ${
                  isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/80 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
                    Recent 7-Day Cadence
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 font-semibold font-mono text-xs">
                    {last7Records.filter((r) => r.isCompleted).length}/7 Done
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1 p-1.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800">
                  {last7Records.map((r) => {
                    const isToday = isTodayDate(r.date);
                    return (
                      <div
                        key={r.id}
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
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Metric 4: Long-term Badge Rank */}
              <NinjaBadgeProgress
                totalDays={allKpis.totalDays}
                completionRate={allKpis.completionRate}
                theme={theme}
              />
            </div>
          </div>

          {/* Card 2: Today's Tasks — full width below KPI's */}
          <div className="flex flex-col">
            <TodayTasksCard
              tasks={tasks}
              theme={theme}
              onAddTask={onAddTask}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              onToggleTaskStatus={onToggleTaskStatus}
              isSyncing={isSyncing}
            />
          </div>
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
