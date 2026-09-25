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

export const LONG_TERM_BADGES: LongTermBadge[] = [
  {
    id: 'trainee',
    name: 'Ninja Trainee',
    shortName: 'Trainee',
    minDays: 0,
    minRate: 0,
    horizon: 'Start',
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
  {
    id: 'year-one-shinobi',
    name: 'Year-One Shinobi',
    shortName: '1 Year',
    minDays: 365,
    minRate: 80,
    horizon: '1Y',
    description: 'A complete year with an 80%+ overall completion standard.',
    accent: 'blue',
  },
  {
    id: 'two-year-master',
    name: 'Two-Year Master',
    shortName: '2 Years',
    minDays: 730,
    minRate: 82,
    horizon: '2Y',
    description: 'Two years of sustained practice with a higher reliability bar.',
    accent: 'violet',
  },
  {
    id: 'three-year-elite',
    name: 'Three-Year Elite',
    shortName: '3 Years',
    minDays: 1095,
    minRate: 84,
    horizon: '3Y',
    description: 'Three years logged while keeping completion above 84%.',
    accent: 'red',
  },
  {
    id: 'four-year-grandmaster',
    name: 'Four-Year Grandmaster',
    shortName: '4 Years',
    minDays: 1460,
    minRate: 86,
    horizon: '4Y',
    description: 'Four years of long-horizon discipline at an elite completion rate.',
    accent: 'violet',
  },
  {
    id: 'five-year-legend',
    name: 'Five-Year Ninja Legend',
    shortName: '5Y Legend',
    minDays: 1825,
    minRate: 88,
    horizon: '5Y',
    description: 'Five years logged with an 88%+ all-time completion rate.',
    accent: 'red',
  },
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

  const dayProgress = Math.min(100, (totalDays / next.minDays) * 100);
  const rateProgress = next.minRate === 0 ? 100 : Math.min(100, (completionRate / next.minRate) * 100);

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
