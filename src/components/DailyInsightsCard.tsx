import React from 'react';
import { Award, Hourglass } from 'lucide-react';
import { DashboardTheme } from '../types';

interface DailyInsightsCardProps {
  theme: DashboardTheme;
  overallCompletionPercentage: number;
  completedDays: number;
  totalDays: number;
  countdownDaysRemaining: number;
  countdownReason: string;
  countdownTargetLabel: string;
  onOpenCountdown?: () => void;
}

export const DailyInsightsCard: React.FC<DailyInsightsCardProps> = ({
  theme,
  overallCompletionPercentage,
  completedDays,
  totalDays,
  countdownDaysRemaining,
  countdownReason,
  countdownTargetLabel,
  onOpenCountdown,
}) => {
  const isDark = theme === 'dark';

  return (
    <div
      aria-label="Daily Insights"
      className={`system-task-card ui-motion-section h-full min-h-0 overflow-hidden p-2 rounded-2xl border flex flex-col transition-all ${
        isDark
          ? 'bg-slate-900/80 border-slate-800'
          : 'bg-slate-50/70 border-slate-200/80'
      }`}
    >
      <div className="shrink-0 grid grid-cols-2 gap-1">
        <div
          className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 px-2 py-1.5"
          title={`Overall Completion: ${overallCompletionPercentage.toFixed(1)}% · ${completedDays}/${totalDays} days completed`}
        >
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-black text-slate-400">
            <Award className="w-3 h-3 text-blue-500" />
            Overall
          </div>
          <div className="mt-0.5 text-sm font-black font-mono text-blue-600 dark:text-blue-300">
            {overallCompletionPercentage.toFixed(1)}%
          </div>
          <div className="text-[8px] font-bold text-slate-400">
            {completedDays}/{totalDays} days
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenCountdown}
          disabled={!onOpenCountdown}
          className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 px-2 py-1.5 text-left transition-colors enabled:hover:bg-slate-100/80 dark:enabled:hover:bg-slate-800/80 disabled:cursor-default"
          title={`${countdownReason} · Target: ${countdownTargetLabel}${onOpenCountdown ? ' · Click to edit' : ''}`}
          aria-label={`${countdownDaysRemaining} days remaining. ${countdownReason}.`}
        >
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-black text-slate-400">
            <Hourglass className="w-3 h-3 text-blue-500" />
            Countdown
          </div>
          <div className="mt-0.5 text-sm font-black font-mono text-blue-600 dark:text-blue-300">
            {countdownDaysRemaining}
          </div>
          <div className="text-[8px] font-bold text-slate-400">
            days left
          </div>
        </button>
      </div>
    </div>
  );
};
