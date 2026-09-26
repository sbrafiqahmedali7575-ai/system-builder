import React from 'react';
import { Award, Gauge, Hourglass } from 'lucide-react';
import { DashboardTheme } from '../types';
import { AnimatedProgressRing } from './AnimatedProgressRing';
import { PomodoroTimer } from './PomodoroTimer';

interface CommandCenterSidebarProps {
  theme: DashboardTheme;
  currentDayFormatted: string;
  currentDayName: string;
  overallCompletionPercentage: number;
  completedDays: number;
  totalDays: number;
  cadencePercentage: number;
  cadenceCompletedDays: number;
  countdownDaysRemaining: number;
  countdownReason: string;
  countdownTargetLabel: string;
  onOpenCountdown?: () => void;
}

export const CommandCenterSidebar: React.FC<CommandCenterSidebarProps> = ({
  theme,
  currentDayFormatted,
  currentDayName,
  overallCompletionPercentage,
  completedDays,
  totalDays,
  cadencePercentage,
  cadenceCompletedDays,
  countdownDaysRemaining,
  countdownReason,
  countdownTargetLabel,
  onOpenCountdown,
}) => {
  const isDark = theme === 'dark';

  return (
    <aside
      aria-label="Command Center"
      className={`system-task-card ui-motion-section h-full min-h-0 overflow-hidden p-2 rounded-2xl border flex flex-col transition-all ${
        isDark
          ? 'bg-slate-900/80 border-slate-800'
          : 'bg-slate-50/70 border-slate-200/80'
      }`}
    >
      <div className="shrink-0 pb-1.5 mb-1.5 border-b border-slate-200/80 dark:border-slate-800">
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
          Command Center
        </h2>
        <div className="mt-0.5 flex items-center gap-1 text-[9px] font-semibold text-slate-400">
          <span>Current day</span>
          <span className="font-mono font-black text-slate-600 dark:text-slate-300">
            {currentDayFormatted}
          </span>
          <span>•</span>
          <span className="font-black text-slate-600 dark:text-slate-300">
            {currentDayName}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 shrink-0">
        <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/50 bg-white/80 dark:bg-slate-950/50 p-2 flex items-center gap-2">
          <AnimatedProgressRing
            value={overallCompletionPercentage}
            size={50}
            strokeWidth={5}
            label={`${Math.round(overallCompletionPercentage)}%`}
            trackClassName="text-slate-200 dark:text-slate-800"
            progressClassName="text-blue-500"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[8px] uppercase tracking-wide font-black text-slate-400">
              <Award className="w-3 h-3 text-blue-500" />
              Overall
            </div>
            <div className="mt-0.5 text-[10px] font-black text-slate-700 dark:text-slate-200">
              {overallCompletionPercentage.toFixed(1)}%
            </div>
            <div className="text-[8px] font-bold text-slate-400">
              {completedDays}/{totalDays} days
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-violet-200/80 dark:border-violet-900/50 bg-white/80 dark:bg-slate-950/50 p-2 flex items-center gap-2">
          <AnimatedProgressRing
            value={cadencePercentage}
            size={50}
            strokeWidth={5}
            label={`${Math.round(cadencePercentage)}%`}
            trackClassName="text-slate-200 dark:text-slate-800"
            progressClassName="text-violet-500"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[8px] uppercase tracking-wide font-black text-slate-400">
              <Gauge className="w-3 h-3 text-violet-500" />
              Cadence
            </div>
            <div className="mt-0.5 text-[10px] font-black text-slate-700 dark:text-slate-200">
              {Math.round(cadencePercentage)}%
            </div>
            <div className="text-[8px] font-bold text-slate-400">
              {cadenceCompletedDays}/7 days
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenCountdown}
        disabled={!onOpenCountdown}
        className="mt-1.5 shrink-0 rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-white/80 dark:bg-slate-950/50 p-2 text-left transition-colors enabled:hover:bg-amber-50/70 dark:enabled:hover:bg-amber-950/20 disabled:cursor-default"
        title={`${countdownReason} · Target: ${countdownTargetLabel}${onOpenCountdown ? ' · Click to edit' : ''}`}
        aria-label={`${countdownDaysRemaining} days remaining. ${countdownReason}.`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-[8px] uppercase tracking-wide font-black text-slate-400">
            <Hourglass className="w-3 h-3 text-amber-500" />
            Countdown
          </div>
          <span className="text-[8px] font-bold text-slate-400 truncate">
            {countdownTargetLabel}
          </span>
        </div>
        <div className="mt-1 flex items-end justify-between gap-2">
          <div>
            <span className="text-2xl leading-none font-black font-mono text-blue-600 dark:text-blue-300">
              {countdownDaysRemaining}
            </span>
            <span className="ml-1 text-[9px] font-bold text-slate-400">
              days left
            </span>
          </div>
          <span className="max-w-[120px] truncate text-[9px] font-bold text-slate-600 dark:text-slate-300">
            {countdownReason}
          </span>
        </div>
      </button>

      <div className="mt-1.5 min-h-0 flex-1 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/50 p-2 flex flex-col justify-center">
        <div className="text-[8px] uppercase tracking-wide font-black text-slate-400 mb-1.5">
          Focus Timer
        </div>
        <div className="flex items-center justify-center">
          <PomodoroTimer />
        </div>
      </div>
    </aside>
  );
};
