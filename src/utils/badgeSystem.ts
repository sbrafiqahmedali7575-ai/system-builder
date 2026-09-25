export interface LongTermBadge {
  id: string;
  name: string;
  shortName: string;
  minDays: number;
  minRate: number;
  horizon: string;
  description: string;
  accent: 'blue' | 'red' | 'amber' | 'violet';
}

const QUARTERLY_ACCENTS: LongTermBadge['accent'][] = ['amber', 'blue', 'red', 'violet'];

const QUARTERLY_BADGES: LongTermBadge[] = Array.from({ length: 18 }, (_, index) => {
  const minDays = 270 + index * 90;
  // Raise the completion standard gradually from 79% at 270 days to 88% at 1800 days.
  const minRate = Math.min(88, 79 + Math.floor((index + 1) / 2));
  const isFinalMilestone = minDays === 1800;

  return {
    id: `day-${minDays}`,
    name: isFinalMilestone ? '1800-Day Ninja Legend' : `${minDays}-Day Shinobi`,
    shortName: `${minDays}D`,
    minDays,
    minRate,
    horizon: `${minDays}D`,
    description: isFinalMilestone
      ? 'Twenty 90-day quarters of long-horizon discipline with an 88%+ overall completion rate.'
      : `Reach ${minDays} logged days while maintaining at least ${minRate}% overall completion.`,
    accent: isFinalMilestone ? 'red' : QUARTERLY_ACCENTS[index % QUARTERLY_ACCENTS.length],
  };
});

export const LONG_TERM_BADGES: LongTermBadge[] = [
  {
    id: 'trainee',
    name: 'Ninja Trainee',
    shortName: 'Trainee',
    minDays: 0,
    minRate: 0,
    horizon: '0D',
    description: 'Your starting rank. Build the habit of showing up and logging the day.',
    accent: 'blue',
  },
  {
    id: 'first-scroll',
    name: 'First Scroll',
    shortName: 'First Scroll',
    minDays: 7,
    minRate: 60,
    horizon: '7D',
    description: 'One week logged with a steady completion baseline.',
    accent: 'amber',
  },
  {
    id: 'day-15',
    name: '15-Day Rookie Shinobi',
    shortName: '15D Shinobi',
    minDays: 15,
    minRate: 65,
    horizon: '15D',
    description: 'Fifteen logged days while maintaining at least 65% overall completion.',
    accent: 'blue',
  },
  {
    id: 'shuriken-bronze',
    name: 'Bronze Shuriken',
    shortName: 'Bronze',
    minDays: 30,
    minRate: 70,
    horizon: '30D',
    description: 'A full month of tracking with dependable execution.',
    accent: 'amber',
  },
  {
    id: 'day-45',
    name: '45-Day Trail Ninja',
    shortName: '45D Ninja',
    minDays: 45,
    minRate: 72,
    horizon: '45D',
    description: 'Forty-five logged days while maintaining at least 72% overall completion.',
    accent: 'blue',
  },
  {
    id: 'day-60',
    name: '60-Day Steel Shuriken',
    shortName: '60D Shuriken',
    minDays: 60,
    minRate: 73,
    horizon: '60D',
    description: 'Sixty logged days while maintaining at least 73% overall completion.',
    accent: 'violet',
  },
  {
    id: 'day-75',
    name: '75-Day Shadow Scout',
    shortName: '75D Scout',
    minDays: 75,
    minRate: 74,
    horizon: '75D',
    description: 'Seventy-five logged days while maintaining at least 74% overall completion.',
    accent: 'red',
  },
  {
    id: 'silent-scout',
    name: 'Silent Scout',
    shortName: 'Scout',
    minDays: 90,
    minRate: 75,
    horizon: '90D',
    description: 'Quarter-year discipline with a strong completion standard.',
    accent: 'blue',
  },
  {
    id: 'crimson-guardian',
    name: 'Crimson Guardian',
    shortName: 'Guardian',
    minDays: 180,
    minRate: 78,
    horizon: '180D',
    description: 'Half a year of tracked execution and resilient consistency.',
    accent: 'red',
  },
  ...QUARTERLY_BADGES,
];

export function getBadgeProgress(totalDays: number, completionRate: number) {
  let current = LONG_TERM_BADGES[0];
  for (const badge of LONG_TERM_BADGES) {
    if (totalDays >= badge.minDays && completionRate >= badge.minRate) {
      current = badge;
    }
  }

  const currentIndex = LONG_TERM_BADGES.findIndex((badge) => badge.id === current.id);
  const next = LONG_TERM_BADGES[currentIndex + 1] ?? null;

  if (!next) {
    return {
      current,
      next,
      dayProgress: 100,
      rateProgress: 100,
      unlockProgress: 100,
      daysRemaining: 0,
      rateRemaining: 0,
    };
  }

  // Progress is measured inside the current milestone interval so each 90-day
  // quarter has a meaningful 0-100% journey instead of staying near 100%.
  const daySpan = Math.max(1, next.minDays - current.minDays);
  const dayProgress = Math.min(100, Math.max(0, ((totalDays - current.minDays) / daySpan) * 100));

  const rateSpan = next.minRate - current.minRate;
  const rateProgress =
    rateSpan <= 0
      ? completionRate >= next.minRate
        ? 100
        : 0
      : Math.min(100, Math.max(0, ((completionRate - current.minRate) / rateSpan) * 100));

  return {
    current,
    next,
    dayProgress,
    rateProgress,
    unlockProgress: Math.min(dayProgress, rateProgress),
    daysRemaining: Math.max(0, next.minDays - totalDays),
    rateRemaining: Math.max(0, next.minRate - completionRate),
  };
}
