import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Check, Rocket, ScanSearch, SlidersHorizontal, Sparkles } from 'lucide-react';
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
            ? 'border-emerald-200 bg-emerald-50 text-emerald-600 shadow-emerald-100/70 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:shadow-emerald-950/30'
            : 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-300'
        }`}
        initial={{ opacity: 0, y: 10, scale: 0.88 }}
        animate={{ opacity: 1, y: 0, scale: isCompleted ? [0.88, 1.12, 1] : 1 }}
        transition={{ delay: 0.15, duration: isCompleted ? 0.7 : 0.45, ease: [0.16, 1, 0.3, 1] }}
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
          {isCompleted ? 'Day Completed • Momentum Earned' : 'Day Reviewed • Next Move Ready'}
        </div>

        <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950 dark:text-white">
          {isCompleted ? 'Today is secured. Keep building.' : 'Reset. Refocus. Continue.'}
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
          <div className="mx-auto mt-5 max-w-sm">
            <motion.div
              className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-3.5 shadow-sm dark:border-emerald-900/60 dark:from-emerald-950/35 dark:via-slate-900 dark:to-blue-950/30"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.45 }}
            >
              <div className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
                <Sparkles className="size-4" />
                <span>Daily win secured</span>
              </div>

              <div className="mt-3 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
                {['Complete', 'Compound', 'Continue'].map((step, index) => (
                  <React.Fragment key={step}>
                    <motion.div
                      className="flex min-w-0 flex-col items-center gap-1.5"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.68 + index * 0.18, duration: 0.35 }}
                    >
                      <motion.div
                        className={`flex size-8 items-center justify-center rounded-full border text-[11px] font-black shadow-sm ${
                          index === 0
                            ? 'border-emerald-300 bg-emerald-500 text-white dark:border-emerald-600 dark:bg-emerald-500'
                            : 'border-blue-200 bg-white text-blue-700 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300'
                        }`}
                        initial={{ scale: 0.72 }}
                        animate={{ scale: [0.72, 1.08, 1] }}
                        transition={{ delay: 0.72 + index * 0.18, duration: 0.42 }}
                      >
                        {index === 0 ? <Check className="size-4" strokeWidth={2.8} /> : index + 1}
                      </motion.div>
                      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-600 dark:text-slate-300">
                        {step}
                      </span>
                    </motion.div>
                    {index < 2 && (
                      <motion.div
                        aria-hidden="true"
                        className="h-px w-6 bg-gradient-to-r from-emerald-300 to-blue-300 dark:from-emerald-700 dark:to-blue-700"
                        initial={{ scaleX: 0, opacity: 0 }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        transition={{ delay: 0.84 + index * 0.18, duration: 0.35 }}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>

              <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950/60">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 via-emerald-500 to-emerald-400"
                  initial={{ width: '8%' }}
                  animate={{ width: '100%' }}
                  transition={{ delay: 0.28, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                />
                <motion.div
                  aria-hidden="true"
                  className="absolute inset-y-0 w-12 -skew-x-12 bg-white/45"
                  initial={{ left: '-18%' }}
                  animate={{ left: '110%' }}
                  transition={{ delay: 1.1, duration: 0.85, ease: 'easeInOut' }}
                />
              </div>

              <motion.p
                className="mt-3 text-xs font-bold leading-relaxed text-slate-600 dark:text-slate-300"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.15, duration: 0.4 }}
              >
                You completed what was in your control today. Carry that momentum into the next step.
              </motion.p>
            </motion.div>
          </div>
        ) : (
          <div className="mx-auto mt-5 max-w-sm">
            <motion.div
              className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-3.5 shadow-sm dark:border-blue-900/60 dark:from-blue-950/35 dark:via-slate-900 dark:to-indigo-950/30"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.45, duration: 0.42 }}
            >
              <motion.div
                aria-hidden="true"
                className="absolute inset-y-0 w-20 -skew-x-12 bg-blue-200/20 dark:bg-blue-400/10"
                initial={{ left: '-28%' }}
                animate={{ left: '120%' }}
                transition={{ delay: 0.55, duration: 1.35, ease: 'easeInOut' }}
              />

              <div className="relative grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1.5">
                {[
                  { label: 'Review', Icon: ScanSearch },
                  { label: 'Adjust', Icon: SlidersHorizontal },
                  { label: 'Act', Icon: Rocket },
                ].map(({ label, Icon }, index) => (
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
                          index === 2
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
                            className="absolute inset-[-5px] rounded-full border border-blue-400/60"
                            initial={{ opacity: 0.8, scale: 0.75 }}
                            animate={{ opacity: 0, scale: 1.45 }}
                            transition={{ delay: 1.0, duration: 0.8, ease: 'easeOut' }}
                          />
                        )}
                      </motion.div>
                      <span className={`text-[10px] font-black uppercase tracking-[0.12em] ${
                        index === 2
                          ? 'text-indigo-700 dark:text-indigo-300'
                          : 'text-blue-700 dark:text-blue-300'
                      }`}>
                        {label}
                      </span>
                    </motion.div>

                    {index < 2 && (
                      <motion.div
                        aria-hidden="true"
                        className="relative flex items-center justify-center text-blue-400 dark:text-blue-500"
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
                className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.72, duration: 0.25 }}
              >
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500"
                  initial={{ width: '10%' }}
                  animate={{ width: '100%' }}
                  transition={{ delay: 0.78, duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
                />
                <motion.span
                  aria-hidden="true"
                  className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-white shadow-md ring-2 ring-blue-500"
                  initial={{ left: '6%' }}
                  animate={{ left: '96%' }}
                  transition={{ delay: 0.82, duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
                />
              </motion.div>

              <motion.p
                className="mt-3 text-xs font-bold leading-relaxed text-slate-600 dark:text-slate-300"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.15, duration: 0.38 }}
              >
                Review what blocked you, adjust one thing, then act on the next priority.
              </motion.p>
            </motion.div>
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
          {isCompleted ? 'Carry the Momentum Forward' : 'Move to the Next Step'}
          <ArrowRight className="size-4" />
        </motion.button>
      </motion.div>
    </div>
  );
};
