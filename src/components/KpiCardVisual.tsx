import React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  Flame,
  TrendingUp,
} from 'lucide-react';
import { KPIStats, DashboardTheme } from '../types';

interface KpiCardVisualProps {
  kpis: KPIStats;
  theme: DashboardTheme;
  onSkillClick?: (skill: string) => void;
}

export const KpiCardVisual: React.FC<KpiCardVisualProps> = ({ kpis, theme }) => {
  const isDark = theme === 'dark';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5 w-full">
      {/* 1. Task Completion Days (Main Metric) */}
      <motion.div
        id="kpi-card-task-completion-days"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ y: -2 }}
        className={`p-2.5 sm:p-3 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
          isDark
            ? 'bg-slate-900/60 border-slate-800 text-slate-200'
            : 'bg-white border-slate-200/80 text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1 ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}>
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Completed Days
          </span>
          <span className={`text-[11px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-0.5`}>
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{kpis.totalDays} Total Days</span>
          </span>
        </div>

        <div className="my-1.5 sm:my-2">
          <div className="flex items-baseline space-x-1">
            <motion.span
              key={kpis.completedDays}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                isDark ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              {kpis.completedDays}
            </motion.span>
            <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              / {kpis.totalDays} days
            </span>
          </div>

          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {kpis.completedDays} Completed
            </span>
            <span className="mx-1 text-slate-300 dark:text-slate-700">·</span>
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
              {kpis.pendingDays} Not Completed
            </span>
          </p>
        </div>

        <div className={`text-[11px] flex items-center justify-between pt-1.5 border-t ${
          isDark ? 'text-slate-400 border-slate-800' : 'text-slate-500 border-slate-100'
        }`}>
          <span>Cadence consistency</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            {kpis.totalDays > 0 ? `${Math.round((kpis.completedDays / kpis.totalDays) * 100)}% active` : '0%'}
          </span>
        </div>
      </motion.div>

      {/* 2. Active Streak */}
      <motion.div
        id="kpi-card-learning-streak"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ y: -2 }}
        className={`p-2.5 sm:p-3 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
          isDark
            ? 'bg-slate-900/60 border-slate-800 text-slate-200'
            : 'bg-white border-slate-200/80 text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1 ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}>
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            Current Streak
          </span>
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            {kpis.currentStreak > 0 ? `${kpis.currentStreak} days streak` : '0 days streak'}
          </span>
        </div>

        <div className="my-1.5 sm:my-2">
          <div className="flex items-baseline space-x-1">
            <motion.span
              key={kpis.currentStreak}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                isDark ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              {kpis.currentStreak}
            </motion.span>
            <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              days continuous
            </span>
          </div>

          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Personal Best: <strong className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{kpis.maxStreak} Days</strong>
            <span className="mx-1 text-slate-300 dark:text-slate-700">·</span>
            Unbroken focus
          </p>
        </div>

        <div className={`text-[11px] flex items-center justify-between pt-1.5 border-t ${
          isDark ? 'text-slate-400 border-slate-800' : 'text-slate-500 border-slate-100'
        }`}>
          <span>Streak target</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {kpis.currentStreak >= 7 ? '7-Day Milestones Unlocked' : `${7 - kpis.currentStreak} days to 7-Day Badge`}
          </span>
        </div>
      </motion.div>

      {/* 3. Task Completion Rate vs 80% Target */}
      <motion.div
        id="kpi-card-task-completion-rate"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ y: -2 }}
        className={`p-2.5 sm:p-3 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
          isDark
            ? 'bg-slate-900/60 border-slate-800 text-slate-200'
            : 'bg-white border-slate-200/80 text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1 ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}>
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Completion Rate
          </span>
          <span
            className={`text-[11px] font-semibold ${
              kpis.completionRate >= 80
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {kpis.completionRate >= 80 ? 'Target Met (≥80%)' : 'Target: 80.0%'}
          </span>
        </div>

        <div className="my-1.5 sm:my-2">
          <div className="flex items-baseline space-x-1">
            <motion.span
              key={kpis.completionRate.toFixed(1)}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                isDark ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              {kpis.completionRate.toFixed(1)}%
            </motion.span>
            <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              performance
            </span>
          </div>

          {/* Clean Progress Bar with Framer Motion */}
          <div className={`w-full h-2 rounded-full overflow-hidden mt-1.5 ${
            isDark ? 'bg-slate-800' : 'bg-slate-100'
          }`}>
            <motion.div
              initial={false}
              animate={{ width: `${Math.min(100, Math.max(0, kpis.completionRate))}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={`h-full rounded-full ${
                kpis.completionRate >= 80
                  ? 'bg-blue-500'
                  : 'bg-blue-500'
              }`}
            />
          </div>
        </div>

        <div className={`text-[11px] flex items-center justify-between pt-1.5 border-t ${
          isDark ? 'text-slate-400 border-slate-800' : 'text-slate-500 border-slate-100'
        }`}>
          <span>Standard goal: 80.0%</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {kpis.pendingDays} Not Completed
          </span>
        </div>
      </motion.div>
    </div>
  );
};
