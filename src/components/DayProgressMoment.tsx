import React, { useEffect, useMemo, useState } from 'react';
import { animate as animateValue, motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarCheck2, Check, Flame, RefreshCw, Rocket, ScanSearch, SlidersHorizontal, Sparkles, Trophy } from 'lucide-react';
import { getDayProgressLine } from '../data/obstacleDayLines';
import { DayProgressStats, DaySubmitResult } from '../types';

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
}> = ({ label, before, after, delay, icon }) => {
  const reduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(before);
  const delta = after - before;

  useEffect(() => {
    setDisplayValue(before);
    const controls = animateValue(before, after, {
      delay: reduceMotion ? 0 : delay,
      duration: reduceMotion ? 0 : delta === 0 ? 0.35 : 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (value) => setDisplayValue(Math.round(Number(value))),
    });
    return () => controls.stop();
  }, [before, after, delay, delta]);

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl border border-emerald-200/80 bg-white/90 px-2.5 py-2.5 text-left shadow-sm dark:border-emerald-900/70 dark:bg-slate-900/85"
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
    >
      {delta > 0 && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 bg-emerald-400/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ delay: delay + 0.35, duration: 0.7 }}
        />
      )}
      <div className="relative flex items-center justify-between gap-2">
        <span className="text-emerald-600 dark:text-emerald-300">{icon}</span>
        <motion.span
          className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${
            delta > 0
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: delta > 0 ? [0.7, 1.18, 1] : 1 }}
          transition={{ delay: delay + 0.45, duration: 0.38 }}
        >
          {delta > 0 ? `+${delta}` : 'Current'}
        </motion.span>
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
  previousStatus: _previousStatus,
  isNewSuccess: _isNewSuccess,
  statsBefore,
  statsAfter,
  onUpdateAgain,
  onFocusTask,
  onContinue,
}) => {
  const reduceMotion = useReducedMotion();
  const isCompleted = status === 'COMPLETED';
  const line = useMemo(() => getDayProgressLine(status), [status]);

  const statusLabel = isCompleted
    ? 'Day Completed • Momentum Earned'
    : 'Day Reviewed • Next Move Ready';
  const headline = isCompleted ? 'Use the momentum.' : 'Use the obstacle.';
  const principleLabel = isCompleted
    ? 'Principles 9–10 • Five Essential Lessons'
    : 'Principles 3–7';
  const guidance = isCompleted
    ? 'Review what worked, preserve one thing, then carry it into the next day.'
    : 'Review what blocked you, adjust one thing, then act on the next priority.';
  const nextMove = isCompleted
    ? 'Carry today’s system into tomorrow.'
    : nextTaskTitle || 'Choose one clear next action.';
  const nextMoveHint = isCompleted
    ? 'Keep the method that worked today and make tomorrow’s first action obvious.'
    : 'Start here. One clear action is enough to restart momentum.';
  const flowSteps = isCompleted
    ? [
        { label: 'Complete', Icon: Check },
        { label: 'Compound', Icon: Sparkles },
        { label: 'Continue', Icon: ArrowRight },
      ]
    : [
        { label: 'Review', Icon: ScanSearch },
        { label: 'Adjust', Icon: SlidersHorizontal },
        { label: 'Act', Icon: Rocket },
      ];
  const primaryAction = isCompleted ? onContinue : onFocusTask || onContinue;
  const primaryLabel = isCompleted
    ? 'Continue to Dashboard'
    : nextTaskTitle && onFocusTask
    ? 'Focus on this task'
    : 'Back to Dashboard';

  return (
    <div className="relative overflow-hidden p-5 text-center sm:p-6">


      <motion.div
        aria-hidden="true"
        className={`absolute inset-x-8 top-16 h-px ${
          isCompleted
            ? 'bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent'
            : 'bg-gradient-to-r from-transparent via-blue-400/70 to-transparent'
        }`}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />

      <motion.div
        aria-hidden="true"
        className={`absolute top-[61px] size-3 rounded-full shadow-lg ${
          isCompleted ? 'bg-emerald-500' : 'bg-blue-500'
        }`}
        initial={{ left: '12%', opacity: 0, scale: 0.6 }}
        animate={{ left: '86%', opacity: [0, 1, 1], scale: [0.6, 1, 0.9] }}
        transition={{ duration: 1.35, ease: [0.22, 1, 0.36, 1] }}
      />

      <motion.div
        className={`relative mx-auto flex size-16 items-center justify-center rounded-2xl border shadow-lg ${
          isCompleted
            ? 'border-emerald-200 bg-emerald-50 text-emerald-600 shadow-emerald-100/70 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:shadow-emerald-950/30'
            : 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-300'
        }`}
        initial={{ opacity: 0, y: 10, scale: 0.88 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: isCompleted ? [0.88, 1.12, 1] : 1,
        }}
        transition={{
          delay: 0.15,
          duration: isCompleted ? 0.7 : 0.45,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {isCompleted && (
          <>
            <motion.span
              aria-hidden="true"
              className="absolute inset-[-10px] rounded-[22px] border border-emerald-300/70 dark:border-emerald-700/60"
              initial={{ opacity: 0.8, scale: 0.72 }}
              animate={{ opacity: 0, scale: 1.35 }}
              transition={{ delay: 0.28, duration: 0.9, ease: 'easeOut' }}
            />
            <motion.span
              aria-hidden="true"
              className="absolute inset-[-3px] rounded-[18px] border border-emerald-400/50"
              initial={{ opacity: 0.65, scale: 0.88 }}
              animate={{ opacity: 0, scale: 1.18 }}
              transition={{ delay: 0.42, duration: 0.75, ease: 'easeOut' }}
            />
          </>
        )}

        {isCompleted ? (
          <Check className="size-8" strokeWidth={2.6} />
        ) : (
          <ArrowUpRight className="size-8" strokeWidth={2.4} />
        )}

        <motion.span
          aria-hidden="true"
          className={`absolute -right-2 -top-2 size-3 rounded-full ${
            isCompleted ? 'bg-emerald-400' : 'bg-blue-400'
          }`}
          animate={{ y: [0, -9, -14], opacity: [0, 1, 0], scale: [0.6, 1, 0.6] }}
          transition={{
            duration: 1.6,
            repeat: reduceMotion ? 0 : Infinity,
            repeatDelay: 0.4,
          }}
        />
        <motion.span
          aria-hidden="true"
          className={`absolute -left-3 top-4 size-2 rounded-full ${
            isCompleted ? 'bg-blue-400' : 'bg-indigo-400'
          }`}
          animate={{ x: [0, 8, 16], opacity: [0, 1, 0], scale: [0.6, 1, 0.7] }}
          transition={{
            duration: 1.8,
            repeat: reduceMotion ? 0 : Infinity,
            repeatDelay: 0.3,
            delay: 0.25,
          }}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.45 }}
      >
        <div
          className={`mt-4 text-[10px] font-black uppercase tracking-[0.18em] ${
            isCompleted
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-blue-600 dark:text-blue-400'
          }`}
        >
          {statusLabel}
        </div>

        <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950 dark:text-white">
          {headline}
        </h2>

        <motion.div
          className={`mx-auto mt-3 max-w-sm rounded-2xl border px-4 py-4 shadow-sm sm:max-w-xl ${
            isCompleted
              ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-blue-50 dark:border-emerald-900/60 dark:from-emerald-950/35 dark:via-slate-900 dark:to-blue-950/25'
              : 'border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:border-blue-900/60 dark:from-blue-950/35 dark:via-slate-900 dark:to-indigo-950/25'
          }`}
          initial={{ opacity: 0, y: 18, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: [0.95, 1.025, 1] }}
          transition={{ delay: 0.46, duration: 0.56, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            className={`text-[9px] font-black uppercase tracking-[0.16em] ${
              isCompleted
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-indigo-600 dark:text-indigo-300'
            }`}
          >
            {principleLabel}
          </div>

          <motion.p
            className="mt-2 flex min-h-[3.75rem] items-center justify-center text-[16px] font-extrabold leading-relaxed tracking-[-0.015em] text-slate-900 dark:text-white"
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.62, duration: 0.42 }}
          >
            {line}
          </motion.p>

          <motion.div
            aria-hidden="true"
            className={`mx-auto mt-3 h-0.5 rounded-full ${
              isCompleted
                ? 'bg-gradient-to-r from-emerald-500 via-blue-500 to-emerald-500'
                : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500'
            }`}
            initial={{ width: '10%', opacity: 0 }}
            animate={{ width: '100%', opacity: 1 }}
            transition={{ delay: 0.66, duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
          />
        </motion.div>

        <div className="mt-4 flex min-h-5 flex-wrap items-center justify-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          <span>
            {isCompleted ? 'Completed today:' : 'Progress today:'}{' '}
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

        <div className="mx-auto mt-4 max-w-sm sm:max-w-xl">
          <motion.div
            className={`relative overflow-hidden rounded-2xl border p-3.5 shadow-sm ${
              isCompleted
                ? 'border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-blue-50 dark:border-emerald-900/60 dark:from-emerald-950/35 dark:via-slate-900 dark:to-blue-950/30'
                : 'border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:border-blue-900/60 dark:from-blue-950/35 dark:via-slate-900 dark:to-indigo-950/30'
            }`}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.45, duration: 0.42 }}
          >
            <motion.div
              aria-hidden="true"
              className={`absolute inset-y-0 w-20 -skew-x-12 ${
                isCompleted
                  ? 'bg-emerald-200/20 dark:bg-emerald-400/10'
                  : 'bg-blue-200/20 dark:bg-blue-400/10'
              }`}
              initial={{ left: '-28%' }}
              animate={{ left: '120%' }}
              transition={{ delay: 0.55, duration: 1.35, ease: 'easeInOut' }}
            />

            <div className="relative grid grid-cols-2 gap-2 sm:grid-cols-4">
              <AnimatedScore
                label="Successful Days"
                before={statsBefore.successfulDays}
                after={statsAfter.successfulDays}
                delay={0.58}
                icon={<Trophy className="size-4" />}
              />
              <AnimatedScore
                label="Current Streak"
                before={statsBefore.currentStreak}
                after={statsAfter.currentStreak}
                delay={0.72}
                icon={<Flame className="size-4" />}
              />
              <AnimatedScore
                label="Achieved Weeks"
                before={statsBefore.achievedWeeks}
                after={statsAfter.achievedWeeks}
                delay={0.86}
                icon={<CalendarCheck2 className="size-4" />}
              />
              <AnimatedScore
                label="Best Streak"
                before={statsBefore.bestStreak}
                after={statsAfter.bestStreak}
                delay={1.0}
                icon={<Sparkles className="size-4" />}
              />
            </div>

            <div className="relative mt-3 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1.5">
              {flowSteps.map(({ label, Icon }, index) => (
                <React.Fragment key={label}>
                  <motion.div
                    className="flex min-w-0 flex-col items-center gap-1.5"
                    initial={{ opacity: 0, x: -16, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{
                      delay: 0.5 + index * 0.2,
                      duration: 0.42,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <motion.div
                      className={`relative flex size-9 items-center justify-center rounded-full border shadow-sm ${
                        isCompleted
                          ? index === 2
                            ? 'border-emerald-400 bg-gradient-to-br from-emerald-500 to-blue-600 text-white shadow-emerald-200/70 dark:border-emerald-500 dark:shadow-emerald-950/40'
                            : 'border-emerald-200 bg-white text-emerald-700 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300'
                          : index === 2
                          ? 'border-indigo-400 bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-blue-200/70 dark:border-indigo-500 dark:shadow-blue-950/40'
                          : 'border-blue-200 bg-white text-blue-700 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300'
                      }`}
                      initial={{ scale: 0.72 }}
                      animate={{
                        scale: index === 2 ? [0.72, 1.16, 1] : [0.72, 1.08, 1],
                        y: index === 2 ? [0, -2, 0] : 0,
                      }}
                      transition={{ delay: 0.54 + index * 0.2, duration: 0.48 }}
                    >
                      <Icon className="size-4" strokeWidth={index === 2 ? 2.5 : 2.2} />
                      {index === 2 && (
                        <motion.span
                          aria-hidden="true"
                          className={`absolute inset-[-5px] rounded-full border ${
                            isCompleted
                              ? 'border-emerald-400/60'
                              : 'border-blue-400/60'
                          }`}
                          initial={{ opacity: 0.8, scale: 0.75 }}
                          animate={{ opacity: 0, scale: 1.45 }}
                          transition={{ delay: 1.0, duration: 0.8, ease: 'easeOut' }}
                        />
                      )}
                    </motion.div>
                    <span
                      className={`text-[10px] font-black uppercase tracking-[0.12em] ${
                        isCompleted
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : index === 2
                          ? 'text-indigo-700 dark:text-indigo-300'
                          : 'text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      {label}
                    </span>
                  </motion.div>

                  {index < 2 && (
                    <motion.div
                      aria-hidden="true"
                      className={`relative flex items-center justify-center ${
                        isCompleted
                          ? 'text-emerald-400 dark:text-emerald-500'
                          : 'text-blue-400 dark:text-blue-500'
                      }`}
                      initial={{ opacity: 0, scaleX: 0.5 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      transition={{ delay: 0.68 + index * 0.2, duration: 0.3 }}
                    >
                      <motion.div
                        animate={{ x: [0, 4, 0] }}
                        transition={{
                          delay: 0.9 + index * 0.18,
                          duration: 0.75,
                          repeat: 2,
                          ease: 'easeInOut',
                        }}
                      >
                        <ArrowRight className="size-4" strokeWidth={2.6} />
                      </motion.div>
                    </motion.div>
                  )}
                </React.Fragment>
              ))}
            </div>

            <motion.div
              className={`relative mt-3 h-1.5 overflow-hidden rounded-full ${
                isCompleted
                  ? 'bg-emerald-100 dark:bg-emerald-950/60'
                  : 'bg-blue-100 dark:bg-blue-950/60'
              }`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.72, duration: 0.25 }}
            >
              <motion.div
                className={`absolute inset-y-0 left-0 rounded-full ${
                  isCompleted
                    ? 'bg-gradient-to-r from-emerald-500 via-blue-500 to-emerald-500'
                    : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500'
                }`}
                initial={{ width: '10%' }}
                animate={{ width: '100%' }}
                transition={{ delay: 0.78, duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
              />
              <motion.span
                aria-hidden="true"
                className={`absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-white shadow-md ring-2 ${
                  isCompleted ? 'ring-emerald-500' : 'ring-blue-500'
                }`}
                initial={{ left: '6%' }}
                animate={{ left: '96%' }}
                transition={{ delay: 0.82, duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
              />
            </motion.div>

            <motion.p
              className="mt-3 flex min-h-[2.5rem] items-center justify-center text-xs font-bold leading-relaxed text-slate-600 dark:text-slate-300"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.15, duration: 0.38 }}
            >
              {guidance}
            </motion.p>

            <motion.div
              className={`relative mt-4 overflow-hidden rounded-2xl border-2 p-4 text-left ${
                isCompleted
                  ? 'border-emerald-400 bg-gradient-to-br from-white via-emerald-50 to-blue-50 shadow-[0_18px_42px_rgba(16,185,129,0.18)] dark:border-emerald-600 dark:from-slate-900 dark:via-emerald-950/35 dark:to-blue-950/35'
                  : 'border-indigo-400 bg-gradient-to-br from-white via-indigo-50 to-blue-50 shadow-[0_18px_42px_rgba(79,70,229,0.22)] dark:border-indigo-600 dark:from-slate-900 dark:via-indigo-950/35 dark:to-blue-950/35'
              }`}
              initial={{ opacity: 0, y: 24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: [0.9, 1.035, 1] }}
              transition={{ delay: 1.16, duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 ${
                  isCompleted
                    ? 'bg-[radial-gradient(circle_at_50%_18%,rgba(16,185,129,0.18),transparent_58%)]'
                    : 'bg-[radial-gradient(circle_at_50%_18%,rgba(99,102,241,0.22),transparent_58%)]'
                }`}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0.35] }}
                transition={{ delay: 1.18, duration: 0.85 }}
              />

              <div className="relative">
                <div
                  className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] ${
                    isCompleted
                      ? 'text-emerald-600 dark:text-emerald-300'
                      : 'text-indigo-600 dark:text-indigo-300'
                  }`}
                >
                  <motion.span
                    className={`size-2.5 rounded-full ${
                      isCompleted ? 'bg-emerald-500' : 'bg-indigo-500'
                    }`}
                    animate={{ scale: [1, 1.45, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{
                      duration: 1.05,
                      repeat: reduceMotion ? 0 : Infinity,
                    }}
                  />
                  Your next move
                </div>

                <motion.div
                  className={`mt-2 flex min-h-[4.25rem] items-center rounded-xl border bg-white/80 px-3 py-3 shadow-sm dark:bg-slate-950/35 ${
                    isCompleted
                      ? 'border-emerald-200/80 dark:border-emerald-800/70'
                      : 'border-indigo-200/80 dark:border-indigo-800/70'
                  }`}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.34, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                >
                  <motion.p
                    className="text-[17px] font-black leading-snug tracking-tight text-slate-950 dark:text-white"
                    initial={{ opacity: 0.35 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.46, duration: 0.3 }}
                  >
                    {nextMove}
                  </motion.p>
                </motion.div>

                <p className="mt-2 flex min-h-[2.5rem] items-center text-[11px] font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                  {nextMoveHint}
                </p>

                <motion.div
                  aria-hidden="true"
                  className={`mx-auto mt-2 flex h-8 w-8 items-center justify-center ${
                    isCompleted
                      ? 'text-emerald-500 dark:text-emerald-300'
                      : 'text-indigo-500 dark:text-indigo-300'
                  }`}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.62, duration: 0.3 }}
                >
                  <motion.div
                    className="flex flex-col items-center"
                    animate={{ y: [0, 4, 0] }}
                    transition={{
                      delay: 1.72,
                      duration: 0.8,
                      repeat: reduceMotion ? 0 : Infinity,
                      repeatDelay: 0.35,
                    }}
                  >
                    <span
                      className={`h-4 w-px ${
                        isCompleted
                          ? 'bg-gradient-to-b from-emerald-300 to-emerald-500 dark:from-emerald-700 dark:to-emerald-400'
                          : 'bg-gradient-to-b from-indigo-300 to-indigo-500 dark:from-indigo-700 dark:to-indigo-400'
                      }`}
                    />
                    <ArrowDown className="-mt-0.5 size-4" strokeWidth={2.8} />
                  </motion.div>
                </motion.div>

                <motion.button
                  type="button"
                  onClick={primaryAction}
                  className={`relative inline-flex min-h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-4 text-sm font-black text-white shadow-lg transition active:scale-[0.99] ${
                    isCompleted
                      ? 'bg-gradient-to-r from-emerald-600 via-emerald-600 to-blue-600 shadow-emerald-200/70 hover:from-emerald-500 hover:via-emerald-500 hover:to-blue-500 dark:shadow-emerald-950/45'
                      : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 shadow-indigo-200/70 hover:from-blue-500 hover:via-indigo-500 hover:to-indigo-600 dark:shadow-indigo-950/45'
                  }`}
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 1.74, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <span className="relative">{primaryLabel}</span>
                  <ArrowRight className="relative size-4" strokeWidth={2.8} />
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        </div>

        <div className={`mt-4 grid gap-2 max-[360px]:gap-1.5 ${
          isCompleted ? 'grid-cols-1' : 'grid-cols-2'
        }`}>
          {!isCompleted && (
            <motion.button
              type="button"
              onClick={onUpdateAgain}
              className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white/80 px-2.5 text-[11px] font-black leading-tight text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.99] max-[360px]:px-2 max-[360px]:text-[10px] dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.35 }}
            >
              <RefreshCw className="size-3.5 shrink-0" />
              <span className="text-center">Update Day Again</span>
            </motion.button>
          )}

          <motion.button
            type="button"
            onClick={onContinue}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-2.5 text-[11px] font-black leading-tight text-white shadow-sm transition hover:bg-blue-500 active:scale-[0.99] max-[360px]:px-2 max-[360px]:text-[10px]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.4 }}
          >
            <span className="text-center">
              {isCompleted ? 'Exit' : nextTaskTitle ? 'Back to Dashboard' : 'Move to the Next Step'}
            </span>
            <ArrowRight className="size-4 shrink-0" />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};
