import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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
  todayTasks?: Array<{ id: string; title: string; isCompleted?: boolean }>;
  onCurrentTaskChange?: (taskId: string) => void;
  focusElapsedSeconds?: number;
  onFocusElapsedCommit?: (elapsedSeconds: number) => void | Promise<void>;
  onOpenCountdown?: () => void;
  focusMode?: boolean;
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
  todayTasks = [],
  onCurrentTaskChange,
  focusElapsedSeconds = 0,
  onFocusElapsedCommit,
  onOpenCountdown,
  focusMode = false,
}) => {
  const isDark = theme === 'dark';
  const reduceMotion = useReducedMotion();
  const AnimatedNumber = ({ value, suffix = '' }: { value: number; suffix?: string }) => {
    const [shown, setShown] = useState(reduceMotion ? value : 0);
    useEffect(() => {
      if (reduceMotion) { setShown(value); return; }
      const from = shown, delta = value - from, started = performance.now(), duration = 650;
      let frame = 0;
      const tick = (now:number) => { const p=Math.min(1,(now-started)/duration); const eased=1-Math.pow(1-p,3); setShown(Math.round(from+delta*eased)); if(p<1) frame=requestAnimationFrame(tick); };
      frame=requestAnimationFrame(tick); return()=>cancelAnimationFrame(frame);
    }, [value, reduceMotion]);
    return <>{shown}{suffix}</>;
  };

  return (
    <motion.aside
      aria-label="Command Center"
      initial={reduceMotion ? false : {opacity:0,y:12,scale:.992}}
      animate={{opacity:1,y:0,scale:1}}
      transition={{duration:.46,ease:[.16,1,.3,1]}}
      className={`system-secondary-panel h-full min-h-0 overflow-hidden rounded-lg border flex flex-col transition-colors ${
        isDark
          ? 'bg-slate-900 border-slate-800'
          : 'bg-white border-slate-200'
      }`}
    >
      <div className={`${focusMode ? "hidden" : ""} shrink-0 px-3 py-2 sm:py-2.5 border-b border-slate-100 dark:border-slate-800`}>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Command Center
        </h2>
      </div>

      <div className={`${focusMode ? "hidden" : "grid"} grid-cols-3 shrink-0 border-b border-slate-100 dark:border-slate-800 divide-x divide-slate-100 dark:divide-slate-800`}>
        <div className="command-kpi min-w-0 bg-white dark:bg-slate-900 px-1.5 sm:px-2.5 py-2 flex flex-col items-center justify-center text-center">
          <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <Award className="w-3 h-3 text-blue-500" />
            Overall
          </div>
          <div className="mt-1 text-base leading-none font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            <AnimatedNumber value={Math.round(overallCompletionPercentage)} suffix="%" />
          </div>
        </div>

        <div className="command-kpi min-w-0 bg-white dark:bg-slate-900 px-1.5 sm:px-2.5 py-2 flex flex-col items-center justify-center text-center">
          <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <Trophy className="w-3 h-3 text-blue-500" />
            Weeks
          </div>
          <div className="mt-1 text-base leading-none font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            <AnimatedNumber value={achievedWeeks} />
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenCountdown}
          disabled={!onOpenCountdown}
          className="command-kpi min-w-0 bg-white dark:bg-slate-900 px-1.5 sm:px-2.5 py-2 text-center transition-colors enabled:hover:bg-slate-50 dark:enabled:hover:bg-slate-800 disabled:cursor-default"
          title={`${countdownReason} · Target: ${countdownTargetLabel}${onOpenCountdown ? ' · Click to edit' : ''}`}
          aria-label={`$<AnimatedNumber value={countdownDaysRemaining} /> days remaining. ${countdownReason}.`}
        >
          <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <Hourglass className="w-3 h-3 text-blue-500" />
            Countdown
          </div>
          <div className="mt-1 text-base leading-none font-semibold tabular-nums text-blue-600 dark:text-blue-300">
            {countdownDaysRemaining}
          </div>
        </button>
      </div>

      <div className="p-1.5 sm:p-2 min-h-0 flex-1 bg-white dark:bg-slate-900">
        <PomodoroTimer
          className="h-full"
          currentTaskTitle={currentTaskTitle}
          todayTasks={todayTasks}
          onCurrentTaskChange={onCurrentTaskChange}
          initialElapsedSeconds={focusElapsedSeconds}
          onElapsedCommit={onFocusElapsedCommit}
          integrated
        />
      </div>
    </motion.aside>
  );
};
