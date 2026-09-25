import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, ChevronDown, LockKeyhole, Shield, Sparkles, Star, Trophy } from 'lucide-react';
import { DashboardTheme } from '../types';
import { getBadgeProgress, LONG_TERM_BADGES, LongTermBadge } from '../utils/badgeSystem';
import { AnimatedProgressRing } from './AnimatedProgressRing';
import { BadgeCelebration } from './BadgeCelebration';

interface NinjaBadgeProgressProps {
  totalDays: number;
  completionRate: number;
  theme: DashboardTheme;
}

const BADGE_STORAGE_KEY = 'SYSTEM_BUILDER_HIGHEST_BADGE_DAY_V2';
const LEGACY_BADGE_STORAGE_KEY = 'SYSTEM_BUILDER_HIGHEST_BADGE_V1';

const accentStyles: Record<LongTermBadge['accent'], { ring: string; soft: string; text: string; glow: string }> = {
  blue: {
    ring: 'ring-blue-400/40',
    soft: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-600 dark:text-blue-300',
    glow: 'shadow-blue-500/20',
  },
  red: {
    ring: 'ring-red-400/40',
    soft: 'bg-red-50 dark:bg-red-950/40',
    text: 'text-red-600 dark:text-red-300',
    glow: 'shadow-red-500/20',
  },
  amber: {
    ring: 'ring-amber-400/40',
    soft: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-600 dark:text-amber-300',
    glow: 'shadow-amber-500/20',
  },
  violet: {
    ring: 'ring-violet-400/40',
    soft: 'bg-violet-50 dark:bg-violet-950/40',
    text: 'text-violet-600 dark:text-violet-300',
    glow: 'shadow-violet-500/20',
  },
};

export const NinjaBadgeProgress: React.FC<NinjaBadgeProgressProps> = ({ totalDays, completionRate, theme }) => {
  const isDark = theme === 'dark';
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [celebrationBadge, setCelebrationBadge] = useState<LongTermBadge | null>(null);
  const initializedRef = useRef(false);
  const progress = useMemo(() => getBadgeProgress(totalDays, completionRate), [totalDays, completionRate]);
  const currentStyle = accentStyles[progress.current.accent];
  const closeCelebration = useCallback(() => setCelebrationBadge(null), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentMilestoneDays = progress.current.minDays;
    let storedMilestoneDays: number | null = null;

    const stored = window.localStorage.getItem(BADGE_STORAGE_KEY);
    if (stored !== null) {
      const parsed = Number.parseInt(stored, 10);
      if (Number.isFinite(parsed)) storedMilestoneDays = parsed;
    }

    // Migrate the old index-based tracker silently. Because the roadmap now has
    // many quarterly badges, old array indexes no longer map safely to ranks.
    if (storedMilestoneDays === null) {
      const legacyStored = window.localStorage.getItem(LEGACY_BADGE_STORAGE_KEY);
      if (legacyStored !== null) {
        window.localStorage.removeItem(LEGACY_BADGE_STORAGE_KEY);
      }
    }

    // First visit after this roadmap upgrade: adopt the user's current milestone
    // silently so newly inserted historical quarter badges don't replay as "new".
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (storedMilestoneDays === null) {
        window.localStorage.setItem(BADGE_STORAGE_KEY, String(currentMilestoneDays));
        return;
      }
    }

    const highestAcknowledgedDays = storedMilestoneDays ?? 0;
    if (currentMilestoneDays > highestAcknowledgedDays) {
      window.localStorage.setItem(BADGE_STORAGE_KEY, String(currentMilestoneDays));
      setCelebrationBadge(progress.current);
    }
  }, [progress.current]);

  const nextTarget = progress.next;
  const overallRingValue = nextTarget ? progress.unlockProgress : 100;

  return (
    <>
      <div className="space-y-2">
        <motion.button
          type="button"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.995 }}
          onClick={() => setShowRoadmap((value) => !value)}
          className={`w-full text-left p-2 rounded-xl border min-h-[118px] relative overflow-hidden cursor-pointer group transition-all ${
            isDark
              ? 'bg-slate-900/60 border-slate-800 hover:border-blue-700/60'
              : 'bg-white border-slate-200/80 shadow-2xs hover:border-blue-300 hover:shadow-md'
          }`}
          aria-expanded={showRoadmap}
        >
          <div className="absolute -right-5 -top-5 w-20 h-20 rounded-full bg-blue-500/8 group-hover:scale-125 transition-transform duration-500" />
          <div className="absolute right-8 -bottom-8 w-16 h-16 rotate-45 border-8 border-red-500/8 rounded-xl" />
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-blue-500 via-amber-400 to-red-500 opacity-70" />

          <div className="relative flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <motion.div
                key={progress.current.id}
                initial={{ scale: 0.72, rotate: -12, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                className={`w-8 h-8 rounded-xl flex items-center justify-center ring-2 ${currentStyle.ring} ${currentStyle.soft} shadow-lg ${currentStyle.glow}`}
              >
                <Shield className={`w-4 h-4 ${currentStyle.text}`} />
              </motion.div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.16em] font-extrabold text-slate-500 dark:text-slate-400">Current Badge</p>
                <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight truncate">{progress.current.name}</h4>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${showRoadmap ? 'rotate-180' : ''}`} />
          </div>

          <div className="relative mt-1.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div>
                <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-300">{totalDays}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1">days logged</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="text-sm font-black text-red-500">{completionRate.toFixed(1)}%</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400">completion</span>
              </div>
            </div>

            <AnimatedProgressRing
              value={overallRingValue}
              size={54}
              strokeWidth={5}
              progressClassName={nextTarget ? 'text-blue-500' : 'text-amber-500'}
              label={`${Math.round(overallRingValue)}%`}
              sublabel={nextTarget ? 'next' : 'done'}
              delay={0.08}
            />
          </div>

          {nextTarget ? (
            <div className="relative mt-1.5">
              <div className="flex items-center justify-between text-[10px] mb-0.5 gap-1">
                <span className="font-bold text-slate-600 dark:text-slate-300 truncate">Next: {nextTarget.name}</span>
                <span className="font-mono text-slate-400 shrink-0">{Math.round(progress.unlockProgress)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.unlockProgress}%` }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-amber-400 to-red-500"
                />
              </div>
            </div>
          ) : (
            <div className="relative mt-1.5 flex items-center gap-1 text-[10px] font-extrabold text-amber-600 dark:text-amber-300">
              <Trophy className="w-3 h-3" /> Quarterly path completed
            </div>
          )}
        </motion.button>

        <AnimatePresence initial={false}>
          {showRoadmap && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -4 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -4 }}
              className={`overflow-hidden rounded-xl border ${
                isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50/90 border-slate-200'
              }`}
            >
              <div className="p-2">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">5-Year Badge Roadmap</span>
                  </div>
                  {nextTarget && (
                    <span className="text-[9px] text-slate-400 font-mono">
                      Need {progress.daysRemaining}d + {progress.rateRemaining.toFixed(1)}pp
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-7 lg:grid-cols-9 xl:grid-cols-12 gap-1">
                  {LONG_TERM_BADGES.map((badge, index) => {
                    const unlocked = totalDays >= badge.minDays && completionRate >= badge.minRate;
                    const isCurrent = badge.id === progress.current.id;
                    return (
                      <div key={badge.id} className="min-w-0 text-center" title={`${badge.name}: ${badge.minDays} days + ${badge.minRate}% completion`}>
                        <motion.div
                          whileHover={{ y: -2, scale: 1.04 }}
                          animate={isCurrent ? { boxShadow: ['0 0 0 rgba(59,130,246,0)', '0 0 16px rgba(59,130,246,.42)', '0 0 0 rgba(59,130,246,0)'] } : undefined}
                          transition={isCurrent ? { duration: 2.2, repeat: Infinity } : undefined}
                          className={`mx-auto w-7 h-7 rounded-lg flex items-center justify-center border ${
                            isCurrent
                              ? 'bg-blue-600 text-white border-blue-500 ring-2 ring-blue-300/60'
                              : unlocked
                              ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 border-amber-300 dark:border-amber-800'
                              : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          {index === LONG_TERM_BADGES.length - 1 ? (
                            <Trophy className="w-3.5 h-3.5" />
                          ) : unlocked ? (
                            <Star className="w-3.5 h-3.5" />
                          ) : (
                            <LockKeyhole className="w-3 h-3" />
                          )}
                        </motion.div>
                        <p className="mt-0.5 text-[8px] font-bold text-slate-500 dark:text-slate-400 truncate">{badge.horizon}</p>
                      </div>
                    );
                  })}
                </div>

                {nextTarget ? (
                  <div className="mt-2 grid grid-cols-[auto_1fr] gap-2 items-center">
                    <div className="flex gap-1.5">
                      <AnimatedProgressRing
                        value={progress.dayProgress}
                        size={48}
                        strokeWidth={5}
                        progressClassName="text-blue-500"
                        label={`${Math.round(progress.dayProgress)}%`}
                        sublabel="days"
                        delay={0.1}
                      />
                      <AnimatedProgressRing
                        value={progress.rateProgress}
                        size={48}
                        strokeWidth={5}
                        progressClassName="text-red-500"
                        label={`${Math.round(progress.rateProgress)}%`}
                        sublabel="rate"
                        delay={0.18}
                      />
                    </div>

                    <div className="space-y-1.5 min-w-0">
                      <div>
                        <div className="flex justify-between text-[9px] font-bold text-slate-500 mb-0.5">
                          <span>Days requirement</span><span>{totalDays}/{nextTarget.minDays}</span>
                        </div>
                        <div className="h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress.dayProgress}%` }}
                            transition={{ duration: 0.8, delay: 0.08 }}
                            className="h-full bg-blue-500 rounded-full"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[9px] font-bold text-slate-500 mb-0.5">
                          <span>Completion requirement</span><span>{completionRate.toFixed(1)}/{nextTarget.minRate}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress.rateProgress}%` }}
                            transition={{ duration: 0.8, delay: 0.16 }}
                            className="h-full bg-red-500 rounded-full"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 rounded-xl border border-amber-300/70 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/30 p-2 flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    <div>
                      <p className="text-[10px] font-black text-amber-700 dark:text-amber-300">Quarterly legend path complete</p>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400">Keep protecting the streak and your long-term completion standard.</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BadgeCelebration
        badge={celebrationBadge}
        totalDays={totalDays}
        completionRate={completionRate}
        theme={theme}
        onClose={closeCelebration}
      />
    </>
  );
};
