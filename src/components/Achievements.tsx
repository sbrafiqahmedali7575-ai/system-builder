import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  Flame,
  Star,
  Zap,
  ShieldCheck,
  Trophy,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  TrendingUp,
  BookmarkCheck,
  CalendarCheck,
  Target,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DailyRecord, DashboardTheme } from '../types';
import { calculateKPIStats } from '../utils/daxMeasures';

export interface BadgeDefinition {
  id: string;
  name: string;
  category: 'STREAK' | 'CONSISTENCY' | 'MILESTONE' | 'RESILIENCE' | 'REFLECTION';
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  requirementText: string;
  isUnlocked: boolean;
  progressCurrent: number;
  progressTarget: number;
  unlockedAtDate?: string;
}

interface AchievementsProps {
  records: DailyRecord[];
  theme: DashboardTheme;
}

export const Achievements: React.FC<AchievementsProps> = ({ records, theme }) => {
  const isDark = theme === 'dark';
  const [filterMode, setFilterMode] = useState<'ALL' | 'UNLOCKED' | 'IN_PROGRESS'>('ALL');
  const [activeBadgeId, setActiveBadgeId] = useState<string | null>(null);

  // Compute records statistics
  const kpis = useMemo(() => calculateKPIStats(records), [records]);
  const sortedRecords = useMemo(() => [...records].sort((a, b) => a.day - b.day), [records]);

  // Specific milestone calculations
  const notesCount = useMemo(() => {
    return records.filter((r) => r.notes && r.notes.trim().length > 0).length;
  }, [records]);

  const hasComeback = useMemo(() => {
    // Check if user completed a day directly after a missed/pending day
    for (let i = 1; i < sortedRecords.length; i++) {
      if (!sortedRecords[i - 1].isCompleted && sortedRecords[i].isCompleted) {
        return true;
      }
    }
    return false;
  }, [sortedRecords]);

  const hasFlawlessWeek = useMemo(() => {
    // Check any 7 consecutive days where all 7 are completed
    if (sortedRecords.length < 7) return false;
    for (let i = 0; i <= sortedRecords.length - 7; i++) {
      const window7 = sortedRecords.slice(i, i + 7);
      if (window7.every((r) => r.isCompleted)) {
        return true;
      }
    }
    return false;
  }, [sortedRecords]);

  // Evaluate All Badges
  const badges: BadgeDefinition[] = useMemo(() => {
    const list: BadgeDefinition[] = [
      {
        id: 'ignition',
        name: 'Ignition · Day One',
        category: 'MILESTONE',
        tier: 'BRONZE',
        icon: Zap,
        description: 'Broke inertia by executing and recording your very first daily commitment.',
        requirementText: 'Complete at least 1 daily commitment',
        isUnlocked: kpis.completedDays >= 1,
        progressCurrent: Math.min(1, kpis.completedDays),
        progressTarget: 1,
        unlockedAtDate: sortedRecords.find((r) => r.isCompleted)?.date,
      },
      {
        id: 'streak-7',
        name: '7-Day Streak',
        category: 'STREAK',
        tier: 'SILVER',
        icon: Flame,
        description: 'Maintained an unbroken daily chain for a full consecutive week of deliberate effort.',
        requirementText: 'Reach a streak of 7 consecutive days',
        isUnlocked: kpis.maxStreak >= 7,
        progressCurrent: Math.min(7, kpis.maxStreak),
        progressTarget: 7,
      },
      {
        id: 'consistent-performer',
        name: 'Consistent Performer',
        category: 'CONSISTENCY',
        tier: 'GOLD',
        icon: Star,
        description: 'Achieved an outstanding 80%+ commitment completion rate across active practice.',
        requirementText: 'Maintain ≥ 80% completion rate (min. 10 days)',
        isUnlocked: kpis.totalDays >= 10 && kpis.completionRate >= 80,
        progressCurrent: kpis.totalDays >= 10 ? Math.round(kpis.completionRate) : kpis.totalDays,
        progressTarget: kpis.totalDays >= 10 ? 80 : 10,
      },
      {
        id: 'comeback-champion',
        name: 'Comeback Champion',
        category: 'RESILIENCE',
        tier: 'BRONZE',
        icon: ShieldCheck,
        description: 'Returned immediately after a setback without letting a missed day break your momentum.',
        requirementText: 'Keep a commitment immediately after a pending day',
        isUnlocked: hasComeback,
        progressCurrent: hasComeback ? 1 : 0,
        progressTarget: 1,
      },
      {
        id: 'streak-14',
        name: 'Fortnight of Focus',
        category: 'STREAK',
        tier: 'GOLD',
        icon: Trophy,
        description: 'Two continuous weeks of sustained focus, developing real self-trust and personal mastery.',
        requirementText: 'Reach a streak of 14 consecutive days',
        isUnlocked: kpis.maxStreak >= 14,
        progressCurrent: Math.min(14, kpis.maxStreak),
        progressTarget: 14,
      },
      {
        id: 'flawless-week',
        name: 'Flawless 7/7',
        category: 'CONSISTENCY',
        tier: 'SILVER',
        icon: CalendarCheck,
        description: 'Executed 7 consecutive scheduled days with a 100% completion record.',
        requirementText: 'Complete every single day in any 7-day period',
        isUnlocked: hasFlawlessWeek,
        progressCurrent: hasFlawlessWeek ? 7 : Math.min(6, kpis.maxStreak),
        progressTarget: 7,
      },
      {
        id: 'reflective-practitioner',
        name: 'Reflective Practitioner',
        category: 'REFLECTION',
        tier: 'BRONZE',
        icon: BookmarkCheck,
        description: 'Cultivated mindful awareness by capturing notes and reflections alongside commitments.',
        requirementText: 'Add reflections/notes to 5 daily records',
        isUnlocked: notesCount >= 5,
        progressCurrent: Math.min(5, notesCount),
        progressTarget: 5,
      },
      {
        id: 'month-of-mastery',
        name: 'Month of Mastery',
        category: 'MILESTONE',
        tier: 'PLATINUM',
        icon: Target,
        description: 'Documented 30 days of continuous personal growth and steady daily improvement.',
        requirementText: 'Track 30 total daily records',
        isUnlocked: kpis.totalDays >= 30,
        progressCurrent: Math.min(30, kpis.totalDays),
        progressTarget: 30,
      },
    ];

    return list;
  }, [kpis, sortedRecords, notesCount, hasComeback, hasFlawlessWeek]);

  // Filtered badges
  const filteredBadges = useMemo(() => {
    if (filterMode === 'UNLOCKED') return badges.filter((b) => b.isUnlocked);
    if (filterMode === 'IN_PROGRESS') return badges.filter((b) => !b.isUnlocked);
    return badges;
  }, [badges, filterMode]);

  const unlockedCount = badges.filter((b) => b.isUnlocked).length;
  const totalCount = badges.length;
  const completionPercentage = Math.round((unlockedCount / totalCount) * 100);

  const handleBadgeClick = (badge: BadgeDefinition) => {
    setActiveBadgeId(badge.id === activeBadgeId ? null : badge.id);
    if (badge.isUnlocked) {
      try {
        confetti({
          particleCount: 30,
          spread: 55,
          origin: { y: 0.75 },
          colors: ['#2563eb', '#ef4444', '#fbbf24'],
        });
      } catch {
        // Safe fallback
      }
    }
  };

  const getTierBadgeStyle = (tier: BadgeDefinition['tier'], isUnlocked: boolean) => {
    if (!isUnlocked) {
      return {
        tagBg: isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500',
        iconBg: isDark ? 'bg-slate-800/80 text-slate-500' : 'bg-slate-200/80 text-slate-400',
        border: isDark ? 'border-slate-800 hover:border-slate-700' : 'border-slate-200 hover:border-slate-300',
        cardBg: isDark ? 'bg-slate-900/30' : 'bg-slate-50/70',
      };
    }

    switch (tier) {
      case 'PLATINUM':
        return {
          tagBg: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
          iconBg: 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-purple-500/20',
          border: 'border-purple-500/40 hover:border-purple-500/70',
          cardBg: isDark ? 'bg-slate-900/70' : 'bg-purple-50/40',
        };
      case 'GOLD':
        return {
          tagBg: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
          iconBg: 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-amber-500/20',
          border: 'border-amber-500/40 hover:border-amber-500/70',
          cardBg: isDark ? 'bg-slate-900/70' : 'bg-amber-50/40',
        };
      case 'SILVER':
        return {
          tagBg: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
          iconBg: 'bg-gradient-to-br from-teal-400 to-blue-600 text-white shadow-teal-500/20',
          border: 'border-teal-500/40 hover:border-teal-500/70',
          cardBg: isDark ? 'bg-slate-900/70' : 'bg-teal-50/40',
        };
      case 'BRONZE':
      default:
        return {
          tagBg: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
          iconBg: 'bg-gradient-to-br from-blue-500 to-teal-700 text-white shadow-blue-500/20',
          border: 'border-blue-500/40 hover:border-blue-500/70',
          cardBg: isDark ? 'bg-slate-900/70' : 'bg-blue-50/40',
        };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`p-2.5 sm:p-3 rounded-2xl border space-y-3 ${
        isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
      }`}
    >
      {/* 1. Top Header & Progress Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDark
                ? 'bg-blue-950/50 text-blue-400 border border-blue-900/50'
                : 'bg-blue-50 text-blue-700 border border-blue-200/80'
            }`}
          >
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-1">
              <h2
                className={`text-base sm:text-lg font-bold tracking-tight ${
                  isDark ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                Achievements &amp; Consistency Badges
              </h2>
              <span
                className={`px-1 py-0.5 rounded font-mono font-bold text-xs ${
                  unlockedCount > 0
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-slate-700/40 text-slate-400'
                }`}
              >
                {unlockedCount} / {totalCount} Unlocked
              </span>
            </div>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Visual milestones earned through consistent daily action and disciplined practice
            </p>
          </div>
        </div>

        {/* Filter Toggle Buttons */}
        <div className="flex items-center space-x-1 self-start sm:self-auto">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-1.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterMode === 'ALL'
                ? isDark
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'bg-teal-600 text-white shadow-xs'
                : isDark
                ? 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                : 'bg-slate-100 text-slate-700 hover:text-slate-950 border border-slate-200'
            }`}
          >
            All ({badges.length})
          </button>
          <button
            onClick={() => setFilterMode('UNLOCKED')}
            className={`px-1.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterMode === 'UNLOCKED'
                ? isDark
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'bg-teal-600 text-white shadow-xs'
                : isDark
                ? 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                : 'bg-slate-100 text-slate-700 hover:text-slate-950 border border-slate-200'
            }`}
          >
            Unlocked ({unlockedCount})
          </button>
          <button
            onClick={() => setFilterMode('IN_PROGRESS')}
            className={`px-1.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterMode === 'IN_PROGRESS'
                ? isDark
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'bg-teal-600 text-white shadow-xs'
                : isDark
                ? 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                : 'bg-slate-100 text-slate-700 hover:text-slate-950 border border-slate-200'
            }`}
          >
            In Progress ({totalCount - unlockedCount})
          </button>
        </div>
      </div>

      {/* 2. Overall Progress Bar */}
      <div
        className={`p-2 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 ${
          isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-center space-x-1.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold font-mono text-xs">
            {completionPercentage}%
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200 dark:text-slate-100">
              Badge Mastery Level
            </div>
            <div className="text-[11px] text-slate-500">
              {unlockedCount === totalCount
                ? 'All badges unlocked! Exceptional dedication.'
                : `${totalCount - unlockedCount} more badge${totalCount - unlockedCount === 1 ? '' : 's'} available to claim`}
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-md w-full">
          <div className="w-full bg-slate-800/40 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700/30">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completionPercentage}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="h-full bg-gradient-to-r from-teal-500 via-blue-400 to-amber-400 rounded-full"
            />
          </div>
        </div>
      </div>

      {/* 3. Grid of Achievement Badges with Framer Motion pop-in */}
      <motion.div
        layout
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2"
      >
        <AnimatePresence mode="popLayout">
          {filteredBadges.map((badge, idx) => {
            const Icon = badge.icon;
            const style = getTierBadgeStyle(badge.tier, badge.isUnlocked);
            const isSelected = activeBadgeId === badge.id;
            const progressPercent = Math.min(
              100,
              Math.round((badge.progressCurrent / badge.progressTarget) * 100)
            );

            return (
              <motion.div
                key={badge.id}
                layout="position"
                initial={{ scale: 0.85, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.85, opacity: 0 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{
                  duration: 0.28,
                  delay: Math.min(idx * 0.04, 0.2),
                  type: 'spring',
                  stiffness: 350,
                  damping: 24,
                }}
                onClick={() => handleBadgeClick(badge)}
                className={`p-2 rounded-xl border relative transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  style.border
                } ${style.cardBg} ${
                  isSelected ? 'ring-2 ring-blue-500 shadow-md' : 'shadow-xs'
                }`}
              >
                <div>
                  {/* Top Bar: Tier & Status */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[10px] font-mono font-bold px-1 py-0.5 rounded tracking-wider uppercase ${style.tagBg}`}
                    >
                      {badge.tier}
                    </span>

                    <div className="flex items-center space-x-0.5">
                      {badge.isUnlocked ? (
                        <span className="flex items-center space-x-0.5 text-[11px] font-bold text-blue-500 dark:text-blue-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Unlocked</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-0.5 text-[11px] font-medium text-slate-500">
                          <Lock className="w-3 h-3" />
                          <span>Locked</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Icon & Title */}
                  <div className="flex items-center space-x-1.5 mb-1.5">
                    <motion.div
                      whileHover={{ rotate: 10, scale: 1.1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-md ${style.iconBg}`}
                    >
                      <Icon className="w-5 h-5" />
                    </motion.div>

                    <div>
                      <h3
                        className={`text-sm font-bold tracking-tight line-clamp-0.5 ${
                          badge.isUnlocked
                            ? isDark
                              ? 'text-slate-100'
                              : 'text-slate-900'
                            : isDark
                            ? 'text-slate-400'
                            : 'text-slate-600'
                        }`}
                      >
                        {badge.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 line-clamp-0.5">
                        {badge.requirementText}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p
                    className={`text-xs mt-1 leading-relaxed ${
                      badge.isUnlocked
                        ? isDark
                          ? 'text-slate-300'
                          : 'text-slate-700'
                        : isDark
                        ? 'text-slate-500'
                        : 'text-slate-500'
                    }`}
                  >
                    {badge.description}
                  </p>
                </div>

                {/* Bottom: Progress Bar / Unlock Date */}
                <div className="mt-2 pt-1.5 border-t border-slate-700/20 dark:border-slate-800">
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="text-slate-500 font-medium">Progress</span>
                    <span
                      className={`font-mono font-bold ${
                        badge.isUnlocked
                          ? 'text-blue-500 dark:text-blue-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {badge.progressCurrent} / {badge.progressTarget}
                    </span>
                  </div>

                  <div className="w-full bg-slate-700/30 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className={`h-full rounded-full ${
                        badge.isUnlocked
                          ? 'bg-blue-500'
                          : 'bg-teal-500/70'
                      }`}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* 4. Philosophy Callout Footer */}
      <div
        className={`p-2 rounded-xl border flex items-center space-x-1.5 text-xs ${
          isDark
            ? 'bg-slate-950/40 border-slate-800 text-slate-400'
            : 'bg-teal-50/60 border-teal-200 text-teal-900'
        }`}
      >
        <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          <strong>System Builder Principle:</strong> Each badge represents self-trust built one day at a time. The goal is steady improvement, turning small actions into enduring habits.
        </span>
      </div>
    </motion.div>
  );
};
