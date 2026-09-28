import React from 'react';
import { Award, Hourglass, Trophy } from 'lucide-react';
import { DashboardTheme } from '../types';
import { AnimatedProgressRing } from './AnimatedProgressRing';
import { PomodoroTimer } from './PomodoroTimer';

interface CommandCenterSidebarProps {
  theme: DashboardTheme;
  currentDayFormatted: string;
  currentDayName: string;
  overallCompletionPercentage: number;
  achievedWeeks: number;
  completedDays: number;
  totalDays: number;
  countdownDaysRemaining: number;
  countdownReason: string;
  countdownTargetLabel: string;
  currentTaskTitle: string;
  onOpenCountdown?: () => void;
}

export const CommandCenterSidebar: React.FC<CommandCenterSidebarProps> = ({
  theme,
  currentDayFormatted,
  currentDayName,
  overallCompletionPercentage,
  achievedWeeks,
  completedDays,
  totalDays,
  countdownDaysRemaining,
  countdownReason,
  countdownTargetLabel,
  currentTaskTitle,
  onOpenCountdown,
}) => {
  const isDark = theme === 'dark';

  return (
    <aside
      aria-label="Command Center"
      className={`system-secondary-panel h-full min-h-0 overflow-hidden p-3 rounded-xl border flex flex-col transition-all ${
        isDark
          ? 'bg-slate-900/80 border-slate-800'
          : 'bg-slate-50/70 border-slate-200/80'
      }`}
    >
      <div className="shrink-0 pb-1.5 mb-1.5 border-b border-slate-200/80 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Command Center
        </h2>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-slate-400">
          <span>Current day</span>
          <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">
            {currentDayFormatted}
          </span>
          <span>•</span>
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            {currentDayName}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
        <div className="min-w-0 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/50 p-2 flex items-center gap-2">
          <AnimatedProgressRing
            value={overallCompletionPercentage}
            size={50}
            strokeWidth={5}
            label={`${Math.round(overallCompletionPercentage)}%`}
            trackClassName="text-slate-200 dark:text-slate-800"
            progressClassName="text-blue-500"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide font-semibold text-slate-400">
              <Award className="w-3 h-3 text-blue-500" />
              Overall
            </div>
            <div className="mt-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-200">
              {overallCompletionPercentage.toFixed(1)}%
            </div>
            <div className="text-[11px] font-bold text-slate-400">
              {completedDays}/{totalDays} days
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/50 p-2 flex flex-col justify-center">
          <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide font-semibold text-slate-400">
            <Trophy className="w-3 h-3 text-blue-500" />
            Achieved Weeks
          </div>
          <div className="mt-1 text-2xl leading-none font-semibold font-mono text-slate-800 dark:text-slate-100">
            {achievedWeeks}
          </div>
          <div className="mt-0.5 text-[11px] font-bold text-slate-400">
            Target: 100 weeks
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenCountdown}
          disabled={!onOpenCountdown}
          className="min-w-0 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/50 p-2 text-left transition-colors enabled:hover:bg-slate-50 dark:enabled:hover:bg-slate-900 disabled:cursor-default"
          title={`${countdownReason} · Target: ${countdownTargetLabel}${onOpenCountdown ? ' · Click to edit' : ''}`}
          aria-label={`${countdownDaysRemaining} days remaining. ${countdownReason}.`}
        >
          <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide font-semibold text-slate-400">
            <Hourglass className="w-3 h-3 text-blue-500" />
            Countdown
          </div>
          <div className="mt-1 text-2xl leading-none font-semibold font-mono text-blue-600 dark:text-blue-300">
            {countdownDaysRemaining}
          </div>
          <div className="mt-0.5 text-[11px] font-bold text-slate-400">
            days left
          </div>
          <div className="mt-1 truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {countdownTargetLabel}
          </div>
        </button>
      </div>

      <div className="mt-1.5 min-h-0 flex-1">
        <PomodoroTimer
          className="h-full"
          currentTaskTitle={currentTaskTitle}
          integrated
        />
      </div>
    </aside>
  );
};
