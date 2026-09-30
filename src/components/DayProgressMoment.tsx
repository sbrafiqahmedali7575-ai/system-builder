import React, {useEffect, useMemo, useState} from 'react';
import {animate as animateValue, motion} from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck2,
  Check,
  Flame,
  RefreshCw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import {getDayProgressLine} from '../data/obstacleDayLines';
import {DayProgressStats, DaySubmitResult} from '../types';

interface DayProgressMomentProps {
  status: 'COMPLETED' | 'NOT_COMPLETED';
  completedTaskCount: number;
  totalTaskCount: number;
  completedHabitCount: number;
  totalHabitCount: number;
  nextTaskTitle?: string | null;
  previousStatus: DaySubmitResult['previousStatus'];
  isNewSuccess: boolean;
  statsBefore: DayProgressStats;
  statsAfter: DayProgressStats;
  onUpdateAgain: () => void;
  onFocusTask?: () => void;
  onContinue: () => void;
}

const AnimatedScore: React.FC<{
  label: string;
  before: number;
  after: number;
  delay: number;
  icon: React.ReactNode;
}> = ({label, before, after, delay, icon}) => {
  const [displayValue, setDisplayValue] = useState(before);
  const delta = after - before;

  useEffect(() => {
    setDisplayValue(before);
    const controls = animateValue(before, after, {
      delay,
      duration: delta === 0 ? 0.3 : 0.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (value) => setDisplayValue(Math.round(Number(value))),
    });
    return () => controls.stop();
  }, [before, after, delay, delta]);

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl border border-emerald-200/80 bg-white/92 px-3 py-3 text-left shadow-sm dark:border-emerald-900/70 dark:bg-slate-900/85"
      initial={{opacity: 0, y: 10, scale: 0.97}}
      animate={{opacity: 1, y: 0, scale: 1}}
      transition={{delay, duration: 0.35, ease: [0.16, 1, 0.3, 1]}}
    >
      {delta > 0 && (
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 bg-emerald-400/10"
          initial={{opacity: 0}}
          animate={{opacity: [0, 1, 0]}}
          transition={{delay: delay + 0.28, duration: 0.6}}
        />
      )}

      <div className="relative flex items-center justify-between gap-2">
        <span className="text-emerald-600 dark:text-emerald-300">{icon}</span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${
            delta > 0
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {delta > 0 ? `+${delta}` : 'Current'}
        </span>
      </div>

      <div className="relative mt-1.5 text-2xl font-black tabular-nums tracking-tight text-slate-950 dark:text-white">
        {displayValue}
      </div>
      <div className="relative mt-0.5 text-[9px] font-black uppercase tracking-[0.11em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
    </motion.div>
  );
};

export const DayProgressMoment: React.FC<DayProgressMomentProps> = ({
  status,
  completedTaskCount,
  totalTaskCount,
  completedHabitCount,
  totalHabitCount,
  nextTaskTitle,
  previousStatus,
  isNewSuccess,
  statsBefore,
  statsAfter,
  onUpdateAgain,
  onFocusTask,
  onContinue,
}) => {
  const isCompleted = status === 'COMPLETED';
  const line = useMemo(() => getDayProgressLine(status), [status]);

  return (
    <div className="relative overflow-hidden p-5 text-center sm:p-6">
      <motion.div
        className={`relative mx-auto flex size-16 items-center justify-center rounded-2xl border shadow-lg ${
          isCompleted
            ? 'border-emerald-200 bg-emerald-50 text-emerald-600 shadow-emerald-100/70 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:shadow-emerald-950/30'
            : 'border-blue-200 bg-blue-50 text-blue-600 shadow-blue-100/60 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-300 dark:shadow-blue-950/30'
        }`}
        initial={{opacity: 0, y: 10, scale: 0.86}}
        animate={{
          opacity: 1,
          y: 0,
          scale: isCompleted ? [0.86, 1.1, 1] : [0.86, 1.04, 1],
        }}
        transition={{duration: 0.62, ease: [0.16, 1, 0.3, 1]}}
      >
        {isCompleted ? (
          <Check className="size-8" strokeWidth={2.6} />
        ) : (
          <ArrowUpRight className="size-8" strokeWidth={2.4} />
        )}

        <motion.span
          aria-hidden="true"
          className={`absolute inset-[-6px] rounded-[22px] border ${
            isCompleted
              ? 'border-emerald-300/60 dark:border-emerald-700/50'
              : 'border-blue-300/50 dark:border-blue-700/45'
          }`}
          initial={{opacity: 0.7, scale: 0.8}}
          animate={{opacity: 0, scale: 1.3}}
          transition={{delay: 0.2, duration: 0.8, ease: 'easeOut'}}
        />
      </motion.div>

      <motion.div
        initial={{opacity: 0, y: 10}}
        animate={{opacity: 1, y: 0}}
        transition={{delay: 0.22, duration: 0.42}}
      >
        <div
          className={`mt-4 text-[10px] font-black uppercase tracking-[0.18em] ${
            isCompleted
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-blue-600 dark:text-blue-400'
          }`}
        >
          {isCompleted ? 'Day Completed • Momentum Earned' : 'Day Reviewed • Next Move Ready'}
        </div>

        <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950 dark:text-white">
          {isCompleted ? 'Progress locked in.' : 'Use the obstacle.'}
        </h2>

        <motion.div
          className={`mx-auto mt-4 max-w-sm rounded-2xl border px-4 py-4 shadow-sm ${
            isCompleted
              ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-blue-50 dark:border-emerald-900/60 dark:from-emerald-950/35 dark:via-slate-900 dark:to-blue-950/25'
              : 'border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:border-blue-900/60 dark:from-blue-950/35 dark:via-slate-900 dark:to-indigo-950/25'
          }`}
          initial={{opacity: 0, y: 14, scale: 0.97}}
          animate={{opacity: 1, y: 0, scale: 1}}
          transition={{delay: 0.38, duration: 0.45, ease: [0.16, 1, 0.3, 1]}}
        >
          <div
            className={`text-[9px] font-black uppercase tracking-[0.16em] ${
              isCompleted
                ? 'text-emerald-600 dark:text-emerald-300'
                : 'text-indigo-600 dark:text-indigo-300'
            }`}
          >
            {isCompleted
              ? 'Principles 9–10 • Five Essential Lessons'
              : 'Principles 3–7'}
          </div>

          <motion.p
            className="mt-2 text-[16px] font-extrabold leading-relaxed tracking-[-0.015em] text-slate-900 dark:text-white"
            initial={{opacity: 0, y: 6}}
            animate={{opacity: 1, y: 0}}
            transition={{delay: 0.52, duration: 0.4}}
          >
            {line}
          </motion.p>
        </motion.div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          <span>
            {completedTaskCount}/{totalTaskCount} tasks
          </span>
          {totalHabitCount > 0 && (
            <>
              <span aria-hidden="true">•</span>
              <span>
                {completedHabitCount}/{totalHabitCount} habits
              </span>
            </>
          )}
        </div>

        {isCompleted ? (
          <motion.div
            className="mx-auto mt-5 max-w-sm"
            initial={{opacity: 0, y: 10}}
            animate={{opacity: 1, y: 0}}
            transition={{delay: 0.6, duration: 0.4}}
          >
            <div className="mb-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.13em] text-emerald-700 dark:text-emerald-300">
              <Sparkles className="size-4" />
              <span>{isNewSuccess ? 'System Progress Updated' : 'Progress Confirmed'}</span>
            </div>

            {!isNewSuccess && previousStatus === 'COMPLETED' && (
              <p className="mb-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                Already counted today. Your totals remain accurate.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <AnimatedScore
                label="Successful Days"
                before={statsBefore.successfulDays}
                after={statsAfter.successfulDays}
                delay={0.72}
                icon={<Trophy className="size-4" />}
              />
              <AnimatedScore
                label="Current Streak"
                before={statsBefore.currentStreak}
                after={statsAfter.currentStreak}
                delay={0.84}
                icon={<Flame className="size-4" />}
              />
              <AnimatedScore
                label="Achieved Weeks"
                before={statsBefore.achievedWeeks}
                after={statsAfter.achievedWeeks}
                delay={0.96}
                icon={<CalendarCheck2 className="size-4" />}
              />
              <AnimatedScore
                label="Best Streak"
                before={statsBefore.bestStreak}
                after={statsAfter.bestStreak}
                delay={1.08}
                icon={<Sparkles className="size-4" />}
              />
            </div>
          </motion.div>
        ) : (
          nextTaskTitle && (
            <motion.div
              className="mx-auto mt-5 max-w-sm rounded-2xl border-2 border-indigo-300 bg-white p-4 text-left shadow-[0_14px_34px_rgba(79,70,229,0.14)] dark:border-indigo-700 dark:bg-slate-900"
              initial={{opacity: 0, y: 16, scale: 0.96}}
              animate={{opacity: 1, y: 0, scale: 1}}
              transition={{delay: 0.68, duration: 0.45, ease: [0.16, 1, 0.3, 1]}}
            >
              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
                Your next move
              </div>
              <p className="mt-2 text-[17px] font-black leading-snug tracking-tight text-slate-950 dark:text-white">
                {nextTaskTitle}
              </p>

              {onFocusTask && (
                <motion.button
                  type="button"
                  onClick={onFocusTask}
                  className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-sm font-black text-white shadow-md shadow-indigo-200/60 transition hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] dark:shadow-indigo-950/40"
                  whileHover={{y: -1}}
                  whileTap={{scale: 0.99}}
                >
                  Focus on this task
                  <ArrowRight className="size-4" strokeWidth={2.7} />
                </motion.button>
              )}
            </motion.div>
          )
        )}

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <motion.button
            type="button"
            onClick={onUpdateAgain}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            initial={{opacity: 0, y: 8}}
            animate={{opacity: 1, y: 0}}
            transition={{delay: 0.88, duration: 0.35}}
          >
            <RefreshCw className="size-3.5" />
            Update Day Again
          </motion.button>

          <motion.button
            type="button"
            onClick={onContinue}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-500 active:scale-[0.99]"
            initial={{opacity: 0, y: 8}}
            animate={{opacity: 1, y: 0}}
            transition={{delay: 0.96, duration: 0.35}}
          >
            {isCompleted ? 'Carry Momentum Forward' : 'Back to Dashboard'}
            <ArrowRight className="size-4" />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};
