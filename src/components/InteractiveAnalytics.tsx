import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  CheckCircle2,
  Clock,
  Calendar,
  Lock,
  Sparkles,
  TrendingUp,
  Target,
  Award,
  ChevronRight,
} from 'lucide-react';
import { DailyRecord, DashboardTheme, KPIStats } from '../types';
import { standardizeDate, parseDateToTimestamp, isTodayDate } from '../utils/dateUtils';
import confetti from 'canvas-confetti';

interface InteractiveAnalyticsProps {
  records: DailyRecord[];
  kpis: KPIStats;
  theme: DashboardTheme;
  onToggleRecordStatus: (id: string) => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const InteractiveAnalytics: React.FC<InteractiveAnalyticsProps> = ({
  records,
  kpis,
  theme,
  onToggleRecordStatus,
}) => {
  const isDark = theme === 'dark';
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Sort chronological for heatmap
  const sortedRecords = [...records].sort((a, b) => a.day - b.day);

  // Calculate day-of-week stats (Mon-Sun)
  const dayOfWeekStats = React.useMemo(() => {
    const stats: Record<string, { total: number; completed: number }> = {
      Mon: { total: 0, completed: 0 },
      Tue: { total: 0, completed: 0 },
      Wed: { total: 0, completed: 0 },
      Thu: { total: 0, completed: 0 },
      Fri: { total: 0, completed: 0 },
      Sat: { total: 0, completed: 0 },
      Sun: { total: 0, completed: 0 },
    };

    records.forEach((r) => {
      const ts = parseDateToTimestamp(r.date);
      if (ts) {
        const d = new Date(ts);
        const dayName = DAY_NAMES[d.getDay()];
        if (stats[dayName]) {
          stats[dayName].total += 1;
          if (r.isCompleted) {
            stats[dayName].completed += 1;
          }
        }
      }
    });

    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((name) => {
      const { total, completed } = stats[name];
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { name, total, completed, rate };
    });
  }, [records]);

  // Target calculation for 80%
  const targetPercent = 80;
  const currentRate = kpis.completionRate;
  const isTargetMet = currentRate >= targetPercent;
  
  // Calculate how many additional consecutive completed days are needed to hit 80%
  // Formula: (completed + x) / (total + x) >= 0.8  =>  x >= (0.8 * total - completed) / 0.2
  const daysNeededForTarget = React.useMemo(() => {
    if (isTargetMet) return 0;
    const numerator = 0.8 * kpis.totalDays - kpis.completedDays;
    if (numerator <= 0) return 0;
    return Math.ceil(numerator / 0.2);
  }, [kpis.totalDays, kpis.completedDays, isTargetMet]);

  const handleTileClick = (record: DailyRecord) => {
    if (!isTodayDate(record.date)) {
      return;
    }
    if (!record.isCompleted) {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#2563eb', '#2563eb', '#f59e0b', '#3b82f6'],
        });
      } catch (e) {
        // ignore
      }
    }
    onToggleRecordStatus(record.id);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 w-full">
      {/* 1. Habit Streak Matrix / Heatmap (Interactive 2-Column Span on Desktop) */}
      <div
        className={`lg:col-span-2 p-2.5 sm:p-3 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
          isDark
            ? 'bg-slate-900/60 border-slate-800 text-slate-200'
            : 'bg-white border-slate-200/80 text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
        }`}
      >
        <div>
          <div className="flex flex-wrap items-center justify-between gap-1 pb-1.5 mb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-1">
              <div className="p-1 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/50">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Commitment Matrix
                </h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Tap today&apos;s tile to toggle status. Previous dates are locked.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>Completed ({kpis.completedDays})</span>
              </span>
              <span className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-full inline-block ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}></span>
                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Not Completed ({kpis.pendingDays})</span>
              </span>
            </div>
          </div>

          {/* Interactive Tiles Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-7 lg:grid-cols-7 gap-1.5 my-1">
            {sortedRecords.map((r) => {
              const isSelected = selectedRecordId === r.id;
              const isToday = isTodayDate(r.date);
              return (
                <div
                  key={r.id}
                  className="relative group"
                  onMouseEnter={() => setSelectedRecordId(r.id)}
                  onMouseLeave={() => setSelectedRecordId(null)}
                >
                  <motion.button
                    onClick={() => handleTileClick(r)}
                    whileHover={isToday ? { scale: 1.08, y: -2 } : undefined}
                    whileTap={isToday ? { scale: 0.88 } : undefined}
                    transition={{ type: 'spring', stiffness: 450, damping: 20 }}
                    className={`w-full aspect-square rounded-lg flex flex-col items-center justify-center p-1 transition-colors relative border ${
                      isToday ? 'cursor-pointer ring-2 ring-amber-400 ring-offset-1 dark:ring-offset-slate-900' : 'cursor-default'
                    } ${
                      r.isCompleted
                        ? isDark
                          ? 'bg-blue-950/40 border-blue-500/50 hover:border-blue-400 text-blue-300 shadow-xs shadow-blue-950/50'
                          : 'bg-blue-50 border-blue-300 hover:border-blue-500 text-blue-800 shadow-xs'
                        : isDark
                        ? 'bg-slate-800/60 border-slate-700 text-slate-400'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                    title={`Day ${r.day} (${r.date}): ${r.isCompleted ? 'Completed' : 'Not Completed'}${isToday ? ' (Today - Click to toggle)' : ' (Previous date - Locked)'}${r.notes ? ` - ${r.notes}` : ''}`}
                  >
                    <div className="flex items-center gap-0.5">
                      <span className="text-[10px] font-mono font-bold tracking-tight opacity-75">
                        D{r.day}
                      </span>
                      {isToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      )}
                    </div>
                    <div className="mt-0.5">
                      <AnimatePresence mode="wait">
                        {r.isCompleted ? (
                          <motion.div
                            key="completed"
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, rotate: 45 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                          >
                            <CheckCircle2 className="w-4 h-4 text-blue-500" />
                          </motion.div>
                        ) : isToday ? (
                          <motion.div
                            key="pending"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0 }}
                            className={`w-2 h-2 rounded-full ${isDark ? 'bg-amber-400' : 'bg-teal-500'}`}
                          />
                        ) : (
                          <motion.div
                            key="locked-past"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0 }}
                            className="text-slate-400 dark:text-slate-600"
                          >
                            <Lock className="w-2.5 h-2.5 opacity-50" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.button>

                  {/* Hover Floating Tooltip */}
                  {isSelected && (
                    <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 p-1.5 rounded-lg shadow-xl text-xs pointer-events-none animate-in fade-in zoom-in-95 duration-150 bg-slate-950 text-white border border-slate-700">
                      <div className="flex items-center justify-between pb-0.5 mb-0.5 border-b border-slate-800">
                        <div className="flex items-center gap-1">
                          <span className="font-bold">Day {r.day}</span>
                          {isToday && (
                            <span className="text-[9px] font-bold px-0.5 rounded bg-amber-400 text-slate-950">
                              TODAY
                            </span>
                          )}
                        </div>
                        <span className={`px-1 py-0.2 rounded text-[9px] font-bold uppercase ${
                          r.isCompleted ? 'bg-blue-500/20 text-blue-400' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {r.isCompleted ? 'Completed' : 'Not Completed'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-mono">{standardizeDate(r.date)}</p>
                      {r.notes ? (
                        <p className="mt-0.5 text-[10px] text-slate-400 italic line-clamp-1">
                          &ldquo;{r.notes}&rdquo;
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[10px] text-slate-500 italic">No notes recorded</p>
                      )}
                      <p className={`mt-1 text-[9px] font-semibold ${
                        isToday ? 'text-teal-400' : 'text-slate-500 flex items-center gap-0.5'
                      }`}>
                        {isToday ? 'Click to toggle status' : 'Locked (Previous date)'}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Heatmap Footer Stats */}
        <div className={`mt-1.5 pt-1.5 border-t flex flex-wrap items-center justify-between gap-1 text-xs font-medium ${
          isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'
        }`}>
          <span className="flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            Active Streak: <strong className={isDark ? 'text-amber-400' : 'text-amber-600'}>{kpis.currentStreak} Days</strong>
            <span className="opacity-60">· Best: {kpis.maxStreak}d</span>
          </span>
          <span className="font-mono text-[11px]">
            {kpis.totalDays} Total Tracked Days
          </span>
        </div>
      </div>

      {/* 2. Target Progress & Day-of-Week Breakdown (1-Column on Desktop) */}
      <div className="flex flex-col gap-2">
        {/* 80% Target Progress Card */}
        <div
          className={`p-2 sm:p-2.5 rounded-xl border transition-all duration-200 shadow-xs flex flex-col justify-between ${
            isDark
              ? 'bg-slate-900/50 border-slate-800 text-slate-200'
              : 'bg-white border-teal-200/80 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-1">
              <div className="p-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                <Target className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold tracking-tight">80% Target Trajectory</h3>
            </div>
            <span
              className={`px-1 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                isTargetMet
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : currentRate >= 50
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              }`}
            >
              {isTargetMet ? 'Target Met' : 'In Progress'}
            </span>
          </div>

          <div className="my-1.5 space-y-1">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-extrabold font-sans">
                  {currentRate.toFixed(1)}%
                </span>
                <span className="text-xs text-slate-400 ml-0.5">Current</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-teal-600 dark:text-teal-400">
                  Target: 80.0%
                </span>
              </div>
            </div>

            {/* Target Progress Bar with 80% Marker */}
            <div className="relative pt-0.5">
              <div className={`w-full h-3 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                <motion.div
                  initial={false}
                  animate={{ width: `${Math.min(100, Math.max(0, currentRate))}%` }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className={`h-full rounded-full ${
                    isTargetMet ? 'bg-blue-500' : 'bg-teal-600'
                  }`}
                />
              </div>
              {/* Target 80% Pin */}
              <div
                className="absolute top-0 w-0.5 h-5 bg-amber-400 z-10"
                style={{ left: '80%' }}
                title="80% Goal Threshold"
              />
            </div>

            <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {isTargetMet ? (
                <span className="text-blue-500 font-semibold flex items-center gap-0.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Outstanding discipline! Target of 80% maintained.
                </span>
              ) : (
                <span>
                  Needs <strong>{daysNeededForTarget} more consecutive completed days</strong> to reach the 80.0% target.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Day-of-Week Breakdown Card */}
        <div
          className={`p-2 sm:p-2.5 rounded-xl border transition-all duration-200 shadow-xs flex-1 flex flex-col justify-between ${
            isDark
              ? 'bg-slate-900/50 border-slate-800 text-slate-200'
              : 'bg-white border-teal-200/80 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Day-of-Week Consistency
            </span>
            <span className="text-[10px] text-slate-400">Weekly Rhythm</span>
          </div>

          <div className="grid grid-cols-7 gap-0.5 my-1">
            {dayOfWeekStats.map((item) => (
              <div key={item.name} className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 mb-0.5">{item.name}</span>
                <div className={`w-full h-14 rounded flex flex-col justify-end p-0.5 ${
                  isDark ? 'bg-slate-800/80' : 'bg-slate-100'
                }`}>
                  <motion.div
                    initial={false}
                    animate={{ height: `${item.total === 0 ? 0 : Math.max(15, item.rate)}%` }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className={`w-full rounded ${
                      item.total === 0
                        ? 'bg-transparent'
                        : item.rate >= 80
                        ? 'bg-blue-500'
                        : item.rate >= 50
                        ? 'bg-teal-500'
                        : 'bg-amber-500'
                    }`}
                    title={`${item.name}: ${item.completed}/${item.total} (${item.rate}%)`}
                  />
                </div>
                <span className="text-[9px] font-mono font-bold mt-0.5 text-slate-500">
                  {item.total > 0 ? `${item.rate}%` : '—'}
                </span>
              </div>
            ))}
          </div>

          <p className={`text-[11px] pt-1 border-t ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
            Identifies weekly patterns to strengthen daily commitment consistency.
          </p>
        </div>
      </div>
    </div>
  );
};
