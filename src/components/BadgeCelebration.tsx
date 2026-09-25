import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Check, Shield, Sparkles, Star, X, Zap } from 'lucide-react';
import { DashboardTheme } from '../types';
import { BadgeTier, LongTermBadge } from '../utils/badgeSystem';
import { BadgeIcon } from './BadgeIcon';

interface BadgeCelebrationProps {
  badge: LongTermBadge | null;
  completedDays: number;
  theme: DashboardTheme;
  onClose: () => void;
}

const badgeTierGradient: Record<BadgeTier, string> = {
  bronze: 'from-amber-800 via-amber-700 to-orange-500',
  gold: 'from-yellow-500 via-yellow-400 to-amber-300',
  success: 'from-emerald-700 via-emerald-500 to-green-400',
};

const badgeTierBorder: Record<BadgeTier, string> = {
  bronze: 'border-amber-600/75',
  gold: 'border-yellow-400/80',
  success: 'border-emerald-400/80',
};

const badgeTierConfetti: Record<BadgeTier, string[]> = {
  bronze: ['#92400e', '#b45309', '#d97706', '#f59e0b', '#ffffff'],
  gold: ['#ca8a04', '#eab308', '#facc15', '#fde047', '#ffffff'],
  success: ['#047857', '#059669', '#10b981', '#34d399', '#ffffff'],
};

const particlePositions = [
  ['8%', '18%'], ['16%', '72%'], ['27%', '10%'], ['35%', '84%'], ['48%', '14%'],
  ['58%', '79%'], ['68%', '9%'], ['75%', '86%'], ['88%', '24%'], ['93%', '68%'],
];

export const BadgeCelebration: React.FC<BadgeCelebrationProps> = ({
  badge,
  completedDays,
  theme,
  onClose,
}) => {
  const isDark = theme === 'dark';
  const [revealStage, setRevealStage] = useState(0);

  useEffect(() => {
    if (!badge || typeof window === 'undefined') return;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timers: number[] = [];

    if (reducedMotion) {
      setRevealStage(3);
    } else {
      setRevealStage(0);
      timers.push(window.setTimeout(() => setRevealStage(1), 120));
      timers.push(window.setTimeout(() => setRevealStage(2), 520));
      timers.push(window.setTimeout(() => setRevealStage(3), 980));

      const colors = badgeTierConfetti[badge.tier];

      // Opening side cannons.
      timers.push(window.setTimeout(() => {
        confetti({
          particleCount: 95,
          angle: 56,
          spread: 78,
          startVelocity: 58,
          decay: 0.9,
          gravity: 0.92,
          scalar: 1.05,
          origin: { x: 0.02, y: 0.76 },
          colors,
          zIndex: 170,
        });
        confetti({
          particleCount: 95,
          angle: 124,
          spread: 78,
          startVelocity: 58,
          decay: 0.9,
          gravity: 0.92,
          scalar: 1.05,
          origin: { x: 0.98, y: 0.76 },
          colors,
          zIndex: 170,
        });
      }, 360));

      // Main badge reveal burst.
      timers.push(window.setTimeout(() => {
        confetti({
          particleCount: 190,
          spread: 118,
          startVelocity: 52,
          decay: 0.91,
          gravity: 0.78,
          scalar: 1.14,
          origin: { x: 0.5, y: 0.42 },
          colors,
          zIndex: 170,
        });
      }, 960));

      // Short victory shower after the badge lands.
      timers.push(window.setTimeout(() => {
        const end = Date.now() + 850;
        const shower = () => {
          confetti({
            particleCount: 5,
            angle: 70,
            spread: 58,
            startVelocity: 32,
            origin: { x: 0.12, y: 0.18 },
            colors,
            zIndex: 170,
          });
          confetti({
            particleCount: 5,
            angle: 110,
            spread: 58,
            startVelocity: 32,
            origin: { x: 0.88, y: 0.18 },
            colors,
            zIndex: 170,
          });
          if (Date.now() < end) requestAnimationFrame(shower);
        };
        shower();
      }, 1120));
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [badge, onClose]);

  return (
    <AnimatePresence>
      {badge && (
        <motion.div
          className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-5 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="badge-unlocked-title"
        >
          <motion.div
            className="absolute inset-0 bg-slate-950/88 backdrop-blur-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={onClose}
          />

          {/* Impact flash + expanding victory rings during the reveal. */}
          <AnimatePresence>
            {revealStage >= 2 && revealStage < 3 && (
              <motion.div
                className="pointer-events-none absolute inset-0 z-[1]"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <motion.div
                  className="absolute left-1/2 top-1/2 w-20 h-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-amber-300/80"
                  initial={{ scale: 0.25, opacity: 1 }}
                  animate={{ scale: 8.5, opacity: 0 }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                />
                <motion.div
                  className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.42),rgba(251,191,36,0.12)_25%,transparent_58%)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.46 }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {particlePositions.map(([left, top], index) => (
            <motion.div
              key={`${left}-${top}`}
              className={`pointer-events-none absolute z-[2] w-2.5 h-2.5 ${index % 3 === 0 ? 'rotate-45 bg-red-400' : index % 3 === 1 ? 'rounded-full bg-amber-300' : 'bg-blue-400'}`}
              style={{ left, top }}
              initial={{ opacity: 0, scale: 0, y: 12 }}
              animate={{ opacity: [0, 1, 0.35], scale: [0, 1.35, 0.9], y: [12, -10, 2], rotate: [0, 120, 240] }}
              transition={{ duration: 2.2, delay: 0.15 + index * 0.05, repeat: Infinity, repeatDelay: 0.65 }}
            />
          ))}

          <motion.div
            initial={{ opacity: 0, scale: 0.84, y: 24 }}
            animate={{
              opacity: 1,
              scale: revealStage === 2 ? [1, 1.018, 0.995, 1] : 1,
              y: 0,
            }}
            exit={{ opacity: 0, scale: 0.92, y: 10 }}
            transition={{
              opacity: { duration: 0.22 },
              y: { type: 'spring', stiffness: 240, damping: 22 },
              scale: { duration: 0.42 },
            }}
            className={`relative z-10 w-full max-w-lg overflow-hidden rounded-[28px] border shadow-[0_30px_100px_rgba(0,0,0,0.55)] ${
              isDark ? 'bg-slate-950 border-slate-700' : 'bg-white border-white'
            }`}
          >
            <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${badgeTierGradient[badge.tier]}`} />
            <div className="absolute -top-20 -right-20 w-52 h-52 rounded-full bg-blue-500/18 blur-3xl" />
            <div className="absolute -bottom-24 -left-20 w-56 h-56 rounded-full bg-red-500/18 blur-3xl" />

            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-20 w-8 h-8 rounded-full flex items-center justify-center bg-slate-900/10 dark:bg-white/10 text-slate-500 dark:text-slate-300 hover:bg-slate-900/15 dark:hover:bg-white/15"
              aria-label="Close badge celebration"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative px-5 pt-7 pb-5 sm:px-8 sm:pt-9 sm:pb-7 text-center">
              <div className="min-h-[30px] flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {revealStage === 0 && (
                    <motion.div
                      key="preparing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.75 }}
                      exit={{ opacity: 0 }}
                      className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400"
                    >
                      Mission Report
                    </motion.div>
                  )}
                  {revealStage === 1 && (
                    <motion.div
                      key="mission-complete"
                      initial={{ opacity: 0, scale: 0.78, y: 6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 1.08, y: -4 }}
                      transition={{ type: 'spring', stiffness: 360, damping: 20 }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-[0.2em]"
                    >
                      <Check className="w-3 h-3" /> Mission Complete
                    </motion.div>
                  )}
                  {revealStage === 2 && (
                    <motion.div
                      key="rank-ascending"
                      initial={{ opacity: 0, scale: 0.75 }}
                      animate={{ opacity: 1, scale: [0.75, 1.12, 1] }}
                      exit={{ opacity: 0, scale: 1.08 }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase tracking-[0.2em]"
                    >
                      <Zap className="w-3 h-3 fill-current" /> Rank Ascending
                    </motion.div>
                  )}
                  {revealStage >= 3 && (
                    <motion.div
                      key="unlocked"
                      initial={{ opacity: 0, scale: 0.72, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase tracking-[0.2em]"
                    >
                      <Sparkles className="w-3 h-3" /> New Rank Unlocked
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative mx-auto mt-5 w-36 h-36 flex items-center justify-center">
                <motion.div
                  className={`absolute inset-0 rounded-full bg-gradient-to-br ${badgeTierGradient[badge.tier]} opacity-25 blur-xl`}
                  animate={{ scale: [0.9, 1.22, 0.9], opacity: [0.18, 0.42, 0.18] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className={`absolute inset-2 rounded-full border-2 border-dashed ${badgeTierBorder[badge.tier]}`}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                />

                <AnimatePresence mode="wait">
                  {revealStage < 3 ? (
                    <motion.div
                      key="badge-silhouette"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{
                        opacity: revealStage === 2 ? [0.25, 0.85, 0.42] : 0.28,
                        scale: revealStage === 2 ? [0.74, 1.08, 0.92] : 0.72,
                        rotate: revealStage === 2 ? [-10, 5, 0] : -8,
                      }}
                      exit={{ opacity: 0, scale: 1.2 }}
                      className="w-24 h-24 rounded-[30px] bg-slate-800 dark:bg-slate-900 border border-white/10 shadow-2xl flex items-center justify-center text-slate-500"
                    >
                      <Shield className="w-11 h-11" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="badge-revealed"
                      initial={{ scale: 0.12, rotate: -42, opacity: 0 }}
                      animate={{ scale: [0.12, 1.32, 0.92, 1], rotate: [-42, 12, -4, 0], opacity: 1 }}
                      transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
                      className={`system-celebration-badge relative w-24 h-24 rounded-[30px] bg-gradient-to-br ${badgeTierGradient[badge.tier]} shadow-[0_18px_45px_rgba(37,99,235,0.34)] flex items-center justify-center text-white ring-4 ring-white/80 dark:ring-slate-800 overflow-hidden`}
                    >
                      <BadgeIcon badge={badge} className="relative z-10 w-11 h-11" />
                      <motion.div
                        className="pointer-events-none absolute inset-y-[-35%] -left-12 z-20 w-9 rotate-[18deg] bg-gradient-to-r from-transparent via-white/95 to-transparent blur-[1px]"
                        animate={{ x: [-40, 180] }}
                        transition={{ delay: 0.42, duration: 0.72, ease: 'easeInOut', repeat: 2, repeatDelay: 1.5 }}
                      />
                      <motion.div
                        className="absolute -right-1 -top-1 z-30 w-8 h-8 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow-lg"
                        initial={{ scale: 0, rotate: -120 }}
                        animate={{ scale: [0, 1.28, 1], rotate: [-120, 12, 0] }}
                        transition={{ delay: 0.42, duration: 0.5 }}
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <motion.div
                animate={revealStage >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                transition={{ delay: revealStage >= 3 ? 0.12 : 0, duration: 0.28 }}
                className={revealStage >= 3 ? '' : 'pointer-events-none'}
              >
                <h2
                  id="badge-unlocked-title"
                  className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-white"
                >
                  {badge.name}
                </h2>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {badge.description}
                </p>

                <div className="mt-5">
                  <div className="max-w-[220px] mx-auto rounded-2xl border border-blue-200/80 dark:border-blue-900/70 bg-blue-50/80 dark:bg-blue-950/30 px-4 py-3">
                    <p className="text-[9px] uppercase tracking-[0.16em] font-extrabold text-blue-500">Completed Days</p>
                    <p className="mt-0.5 text-2xl font-black font-mono text-blue-700 dark:text-blue-300">{completedDays}</p>
                  </div>
                </div>

                <motion.button
                  type="button"
                  onClick={onClose}
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className={`mt-5 w-full rounded-2xl px-4 py-3 bg-gradient-to-r ${badgeTierGradient[badge.tier]} text-white font-black text-sm shadow-lg flex items-center justify-center gap-2`}
                >
                  <Check className="w-4 h-4" /> Continue the Mission
                </motion.button>
                <p className="mt-2 text-[9px] text-slate-400">This badge celebration is shown once when the rank is first earned on this device.</p>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
