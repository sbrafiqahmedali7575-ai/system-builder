import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, ChevronDown, Trophy } from 'lucide-react';
import { DashboardTheme } from '../types';
import { BadgeTier, getBadgeProgress, LONG_TERM_BADGES, LongTermBadge } from '../utils/badgeSystem';
import { CONFIGURED_TIMEZONE } from '../utils/taskDateUtils';
import { BadgeCelebration } from './BadgeCelebration';
import { BadgeIcon } from './BadgeIcon';

interface NinjaBadgeProgressProps {
  completedDays: number;
  theme: DashboardTheme;
}

const BADGE_STORAGE_KEY = 'SYSTEM_BUILDER_HIGHEST_COMPLETED_BADGE_DAY_V3';
const LEGACY_BADGE_STORAGE_KEYS = [
  'SYSTEM_BUILDER_HIGHEST_BADGE_DAY_V2',
  'SYSTEM_BUILDER_HIGHEST_BADGE_V1',
];

const WEEKLY_CAREER_PRINCIPLES = [
  'Build rare and valuable skills before chasing passion.',
  'Career capital creates better options, autonomy, and opportunity.',
  'Deliberate practice is where real professional growth happens.',
  'Earn control by becoming valuable enough to deserve it.',
  'A meaningful mission becomes clearer after mastering your craft.',
  'Focus on craftsmanship: make your work difficult to ignore.',
  'Ask what value you can create, not what work owes you.',
] as const;

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

const achievedTierStyles: Record<
  BadgeTier,
  {
    ring: string;
    soft: string;
    text: string;
    glow: string;
    fill: string;
    label: string;
    currentGlow: string;
  }
> = {
  bronze: {
    ring: 'ring-amber-700/45 dark:ring-amber-500/45',
    soft: 'bg-amber-100 dark:bg-amber-950/50',
    text: 'text-amber-800 dark:text-amber-300',
    glow: 'shadow-amber-700/20',
    fill: 'bg-amber-700 dark:bg-amber-600 text-white',
    label: 'text-amber-800 dark:text-amber-300',
    currentGlow: 'rgba(180,83,9,.42)',
  },
  gold: {
    ring: 'ring-yellow-400/60 dark:ring-yellow-400/50',
    soft: 'bg-yellow-50 dark:bg-yellow-950/45',
    text: 'text-yellow-700 dark:text-yellow-300',
    glow: 'shadow-yellow-500/20',
    fill: 'bg-yellow-400 dark:bg-yellow-500 text-yellow-950',
    label: 'text-yellow-700 dark:text-yellow-300',
    currentGlow: 'rgba(250,204,21,.48)',
  },
  success: {
    ring: 'ring-emerald-400/55 dark:ring-emerald-400/50',
    soft: 'bg-emerald-50 dark:bg-emerald-950/45',
    text: 'text-emerald-700 dark:text-emerald-300',
    glow: 'shadow-emerald-500/20',
    fill: 'bg-emerald-500 dark:bg-emerald-500 text-white',
    label: 'text-emerald-700 dark:text-emerald-300',
    currentGlow: 'rgba(16,185,129,.46)',
  },
};

export const NinjaBadgeProgress: React.FC<NinjaBadgeProgressProps> = ({ completedDays, theme }) => {
  const isDark = theme === 'dark';
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [celebrationBadge, setCelebrationBadge] = useState<LongTermBadge | null>(null);
  const [quoteClock, setQuoteClock] = useState(() => Date.now());
  const initializedRef = useRef(false);
  const progress = useMemo(() => getBadgeProgress(completedDays), [completedDays]);
  const currentStyle = achievedTierStyles[progress.current.tier];
  const closeCelebration = useCallback(() => setCelebrationBadge(null), []);

  useEffect(() => {
    const timer = window.setInterval(() => setQuoteClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const dailyCareerPrinciple = useMemo(() => {
    const weekday = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: CONFIGURED_TIMEZONE,
    }).format(new Date(quoteClock));

    const weekdayIndex: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    return WEEKLY_CAREER_PRINCIPLES[weekdayIndex[weekday] ?? 0];
  }, [quoteClock]);

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
      LEGACY_BADGE_STORAGE_KEYS.forEach((key) => {
        if (window.localStorage.getItem(key) !== null) {
          window.localStorage.removeItem(key);
        }
      });
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
  const nextStyle = nextTarget ? accentStyles[nextTarget.accent] : null;

  return (
    <>
      <motion.div layout className="space-y-2">
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
                <BadgeIcon badge={progress.current} className={`w-4 h-4 ${currentStyle.text}`} />
              </motion.div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.16em] font-black text-slate-700 dark:text-slate-200">Current Badge</p>
                <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight truncate">{progress.current.name}</h4>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 mt-0.5 text-slate-400 transition-transform shrink-0 ${showRoadmap ? 'rotate-180' : ''}`} />
          </div>

          <div className="relative mt-1.5">
            <div className="grid grid-cols-2 items-center gap-2">
              <div className="min-w-0" style={{ paddingLeft: '20%' }}>
                <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-300">{completedDays}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1">completed days</span>
              </div>

              <div className="min-w-0 pl-1 text-left">
                <p className="text-[8px] uppercase tracking-[0.14em] font-black text-slate-400 dark:text-slate-500">
                  Daily Career Principle
                </p>
                <p
                  className="mt-0.5 text-[9px] sm:text-[10px] font-semibold italic leading-snug text-slate-600 dark:text-slate-300"
                  title="Paraphrased from core ideas in So Good They Can't Ignore You by Cal Newport"
                >
                  “{dailyCareerPrinciple}”
                </p>
              </div>
            </div>
          </div>

          {nextTarget ? (
            <div className="relative mt-1.5">
              <div className={`flex items-center justify-between text-[10px] mb-1 gap-2 p-1.5 rounded-lg border ${
                isDark
                  ? 'bg-blue-950/20 border-blue-800/70'
                  : 'bg-blue-50/70 border-blue-200'
              }`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-extrabold text-slate-700 dark:text-slate-200 shrink-0">Next:</span>
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center ring-1 shrink-0 ${nextStyle?.ring || ''} ${nextStyle?.soft || ''}`}>
                    <BadgeIcon badge={nextTarget} className={`w-3 h-3 stroke-[1.25] ${nextStyle?.text || ''}`} />
                  </span>
                  <span className="font-extrabold text-slate-800 dark:text-white truncate">{nextTarget.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    Need {progress.daysRemaining} completed days
                  </span>
                  <span className="font-mono font-extrabold text-blue-600 dark:text-blue-300 whitespace-nowrap">
                    {Math.round(progress.unlockProgress)}%
                  </span>
                </div>
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
            <div className="relative mt-1.5 flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-300">
              <Trophy className="w-3 h-3" /> Analytics mastery path completed
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
                <div className="pb-0.5">
                  <div className="grid grid-cols-9 gap-x-1 gap-y-1.5">
                    {LONG_TERM_BADGES.map((badge) => {
                      const unlocked = completedDays >= badge.minDays;
                      const isCurrent = badge.id === progress.current.id;
                      const isNext = nextTarget?.id === badge.id;
                      const achievedStyle = achievedTierStyles[badge.tier];
                      return (
                        <motion.div
                          key={badge.id}
                          layout
                          whileHover={{ y: -1, scale: 1.04 }}
                          title={`${badge.name}: ${badge.minDays} completed days`}
                          className="min-w-0 flex flex-col items-center gap-0.5"
                        >
                          <motion.div
                            animate={
                              isCurrent
                                ? {
                                    boxShadow: [
                                      `0 0 0 ${achievedStyle.currentGlow.replace('.42', '0').replace('.48', '0').replace('.46', '0')}`,
                                      `0 0 9px ${achievedStyle.currentGlow}`,
                                      `0 0 0 ${achievedStyle.currentGlow.replace('.42', '0').replace('.48', '0').replace('.46', '0')}`,
                                    ],
                                  }
                                : undefined
                            }
                            transition={isCurrent ? { duration: 2.2, repeat: Infinity } : undefined}
                            className={`w-full h-4 rounded flex items-center justify-center transition-all ${
                              unlocked
                                ? `${achievedStyle.fill} ${
                                    isCurrent
                                      ? `ring-1 ${achievedStyle.ring} ring-offset-1 dark:ring-offset-slate-900`
                                      : ''
                                  }`
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                            }`}
                          >
                            <BadgeIcon
                              badge={badge}
                              className={`w-2 h-2 shrink-0 ${isNext ? 'stroke-[3]' : 'stroke-2'}`}
                            />
                          </motion.div>

                          <span className={`text-[7px] font-mono leading-none whitespace-nowrap ${
                            unlocked
                              ? `${isCurrent ? 'font-black' : 'font-bold'} ${achievedStyle.label}`
                              : 'text-slate-400'
                          }`}>
                            {badge.minDays}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {!nextTarget && (
                  <div className="mt-2 rounded-xl border border-emerald-300/70 dark:border-emerald-900 bg-emerald-50/80 dark:bg-emerald-950/30 p-2 flex items-center gap-2">
                    <Award className="w-5 h-5 text-emerald-500" />
                    <div>
                      <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-300">Analytics mastery path complete</p>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400">Keep completing days to protect your long-term badge rank.</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <BadgeCelebration
        badge={celebrationBadge}
        completedDays={completedDays}
        theme={theme}
        onClose={closeCelebration}
      />
    </>
  );
};
