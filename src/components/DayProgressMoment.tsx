import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import { getDayProgressLine } from '../data/obstacleDayLines';

interface DayProgressMomentProps {
  status: 'COMPLETED' | 'NOT_COMPLETED';
  completedTaskCount: number;
  totalTaskCount: number;
  completedHabitCount: number;
  totalHabitCount: number;
  onContinue: () => void;
}

export const DayProgressMoment: React.FC<DayProgressMomentProps> = ({
  status,
  completedTaskCount,
  totalTaskCount,
  completedHabitCount,
  totalHabitCount,
  onContinue,
}) => {
  const isCompleted = status === 'COMPLETED';
  const line = useMemo(() => getDayProgressLine(status), [status]);

  return (
    <div className="relative overflow-hidden p-5 sm:p-6 text-center">
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
            ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-300'
            : 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-300'
        }`}
        initial={{ opacity: 0, y: 10, scale: 0.88 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        {isCompleted ? <Check className="size-8" strokeWidth={2.6} /> : <ArrowUpRight className="size-8" strokeWidth={2.4} />}

        <motion.span
          aria-hidden="true"
          className={`absolute -right-2 -top-2 size-3 rounded-full ${
            isCompleted ? 'bg-emerald-400' : 'bg-blue-400'
          }`}
          animate={{ y: [0, -9, -14], opacity: [0, 1, 0], scale: [0.6, 1, 0.6] }}
          transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.4 }}
        />
        <motion.span
          aria-hidden="true"
          className={`absolute -left-3 top-4 size-2 rounded-full ${
            isCompleted ? 'bg-blue-400' : 'bg-indigo-400'
          }`}
          animate={{ x: [0, 8, 16], opacity: [0, 1, 0], scale: [0.6, 1, 0.7] }}
          transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 0.3, delay: 0.25 }}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.45 }}
      >
        <div className={`mt-4 text-[10px] font-black uppercase tracking-[0.18em] ${
          isCompleted
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-blue-600 dark:text-blue-400'
        }`}>
          {isCompleted ? 'Day Completed • Moving Forward' : 'Day Reviewed • Next Move Ready'}
        </div>

        <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950 dark:text-white">
          {isCompleted ? 'Progress locked in.' : 'Reset. Refocus. Continue.'}
        </h2>

        <motion.p
          className="mx-auto mt-3 max-w-sm text-[15px] font-semibold leading-relaxed text-slate-700 dark:text-slate-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.55 }}
        >
          {line}
        </motion.p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          <span>{isCompleted ? 'Completed today:' : 'Progress today:'} {completedTaskCount}/{totalTaskCount} tasks</span>
          {totalHabitCount > 0 && (
            <>
              <span aria-hidden="true">•</span>
              <span>{completedHabitCount}/{totalHabitCount} habits</span>
            </>
          )}
        </div>

        {isCompleted ? (
          <div className="mx-auto mt-5 max-w-xs">
            <div className="relative h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 via-emerald-500 to-emerald-400"
                initial={{ width: '8%' }}
                animate={{ width: '100%' }}
                transition={{ delay: 0.2, duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-slate-500 dark:text-slate-400">
              <span>Today</span>
              <ArrowRight className="size-3.5" />
              <span>Next Step</span>
            </div>
          </div>
        ) : (
          <div className="mx-auto mt-5 max-w-sm">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3.5 dark:border-blue-900/60 dark:bg-blue-950/25">
              <div className="flex items-center justify-between gap-2">
                {['Review', 'Adjust', 'Act'].map((step, index) => (
                  <React.Fragment key={step}>
                    <motion.div
                      className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.45 + index * 0.22, duration: 0.35 }}
                    >
                      <motion.div
                        className="flex size-8 items-center justify-center rounded-full border border-blue-200 bg-white text-[11px] font-black text-blue-700 shadow-sm dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"
                        initial={{ scale: 0.72 }}
                        animate={{ scale: [0.72, 1.08, 1] }}
                        transition={{ delay: 0.5 + index * 0.22, duration: 0.45 }}
                      >
                        {index + 1}
                      </motion.div>
                      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
                        {step}
                      </span>
                    </motion.div>
                    {index < 2 && (
                      <motion.div
                        aria-hidden="true"
                        className="h-px flex-1 bg-gradient-to-r from-blue-300 to-indigo-300 dark:from-blue-700 dark:to-indigo-700"
                        initial={{ scaleX: 0, opacity: 0 }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        transition={{ delay: 0.65 + index * 0.22, duration: 0.35 }}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>

              <motion.p
                className="mt-3 text-xs font-bold leading-relaxed text-slate-600 dark:text-slate-300"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.05, duration: 0.4 }}
              >
                Next move: choose one unfinished task, make it the first priority, and start fresh.
              </motion.p>
            </div>
          </div>
        )}

        <motion.button
          type="button"
          onClick={onContinue}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-500 active:scale-[0.99]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.4 }}
        >
          {isCompleted ? 'Continue Forward' : 'Move to the Next Step'}
          <ArrowRight className="size-4" />
        </motion.button>
      </motion.div>
    </div>
  );
};
