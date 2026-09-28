import React from 'react';
import { Award, Hourglass, Trophy } from 'lucide-react';
import { DashboardTheme } from '../types';
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
      className={`system-secondary-panel h-full min-h-0 overflow-hidden rounded-lg border flex flex-col transition-colors ${
        isDark
          ? 'bg-slate-900 border-slate-800'
          : 'bg-white border-slate-200'
      }`}
    >
      <div className="shrink-0 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Command Center
        </h2>
      </div>

      <div className="grid grid-cols-3 shrink-0 border-b border-slate-100 dark:border-slate-800 divide-x divide-slate-100 dark:divide-slate-800">
        <div className="min-w-0 bg-white dark:bg-slate-900 px-2.5 py-2 flex flex-col justify-center">
          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <Award className="w-3 h-3 text-blue-500" />
            Overall
          </div>
          <div className="mt-1 text-base leading-none font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {Math.round(overallCompletionPercentage)}%
          </div>
          <div className="mt-0.5 text-xs font-normal text-slate-500 dark:text-slate-400">
            {completedDays}/{totalDays} days
          </div>
        </div>

        <div className="min-w-0 bg-white dark:bg-slate-900 px-2.5 py-2 flex flex-col justify-center">
          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <Trophy className="w-3 h-3 text-blue-500" />
            Achieved Weeks
          </div>
          <div className="mt-1 text-base leading-none font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {achievedWeeks}
          </div>
          <div className="mt-0.5 text-xs font-normal text-slate-500 dark:text-slate-400">
            Target: 100 weeks
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenCountdown}
          disabled={!onOpenCountdown}
          className="min-w-0 bg-white dark:bg-slate-900 px-2.5 py-2 text-left transition-colors enabled:hover:bg-slate-50 dark:enabled:hover:bg-slate-800 disabled:cursor-default"
          title={`${countdownReason} · Target: ${countdownTargetLabel}${onOpenCountdown ? ' · Click to edit' : ''}`}
          aria-label={`${countdownDaysRemaining} days remaining. ${countdownReason}.`}
        >
          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <Hourglass className="w-3 h-3 text-blue-500" />
            Countdown
          </div>
          <div className="mt-1 text-base leading-none font-semibold tabular-nums text-blue-600 dark:text-blue-300">
            {countdownDaysRemaining}
          </div>
          <div className="mt-0.5 text-xs font-normal text-slate-500 dark:text-slate-400">
            days left
          </div>
          <div className="mt-1 truncate text-xs font-normal text-slate-500 dark:text-slate-400">
            {countdownTargetLabel}
          </div>
        </button>
      </div>

      <div className="p-2 min-h-0 flex-1 bg-white dark:bg-slate-900">
        <PomodoroTimer
          className="h-full"
          currentTaskTitle={currentTaskTitle}
          integrated
        />
      </div>
    </aside>
  );
};
