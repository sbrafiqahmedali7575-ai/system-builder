export interface LongTermBadge {
  id: string;
  name: string;
  shortName: string;
  minDays: number;
  horizon: string;
  description: string;
  accent: 'blue' | 'red' | 'amber' | 'violet';
}

const QUARTERLY_ACCENTS: LongTermBadge['accent'][] = ['amber', 'blue', 'red', 'violet'];

const QUARTERLY_BADGES: LongTermBadge[] = Array.from({ length: 18 }, (_, index) => {
  const minDays = 270 + index * 90;
  const isFinalMilestone = minDays === 1800;

  return {
    id: `day-${minDays}`,
    name: isFinalMilestone ? '1800-Day Ninja Legend' : `${minDays}-Day Shinobi`,
    shortName: `${minDays}D`,
    minDays,
    horizon: `${minDays}D`,
    description: isFinalMilestone
      ? 'Complete 1,800 days to finish the long-term Ninja badge path.'
      : `Complete ${minDays} days to unlock this badge.`,
    accent: isFinalMilestone ? 'red' : QUARTERLY_ACCENTS[index % QUARTERLY_ACCENTS.length],
  };
});

export const LONG_TERM_BADGES: LongTermBadge[] = [
  {
    id: 'trainee',
    name: 'Ninja Trainee',
    shortName: 'Trainee',
    minDays: 0,
    horizon: '0D',
    description: 'Your starting rank. Complete days consistently to advance.',
    accent: 'blue',
  },
  {
    id: 'first-scroll',
    name: 'First Scroll',
    shortName: 'First Scroll',
    minDays: 7,
    horizon: '7D',
    description: 'Complete 7 days to unlock your first milestone badge.',
    accent: 'amber',
  },
  {
    id: 'day-15',
    name: '15-Day Rookie Shinobi',
    shortName: '15D Shinobi',
    minDays: 15,
    horizon: '15D',
    description: 'Complete 15 days to strengthen your consistency habit.',
    accent: 'blue',
  },
  {
    id: 'shuriken-bronze',
    name: 'Bronze Shuriken',
    shortName: 'Bronze',
    minDays: 30,
    horizon: '30D',
    description: 'Complete 30 days to earn the Bronze Shuriken.',
    accent: 'amber',
  },
  {
    id: 'day-45',
    name: '45-Day Trail Ninja',
    shortName: '45D Ninja',
    minDays: 45,
    horizon: '45D',
    description: 'Complete 45 days to unlock the Trail Ninja badge.',
    accent: 'blue',
  },
  {
    id: 'day-60',
    name: '60-Day Steel Shuriken',
    shortName: '60D Shuriken',
    minDays: 60,
    horizon: '60D',
    description: 'Complete 60 days to earn the Steel Shuriken badge.',
    accent: 'violet',
  },
  {
    id: 'day-75',
    name: '75-Day Shadow Scout',
    shortName: '75D Scout',
    minDays: 75,
    horizon: '75D',
    description: 'Complete 75 days to unlock the Shadow Scout badge.',
    accent: 'red',
  },
  {
    id: 'silent-scout',
    name: 'Silent Scout',
    shortName: 'Scout',
    minDays: 90,
    horizon: '90D',
    description: 'Complete 90 days to finish your first quarter of done days.',
    accent: 'blue',
  },
  {
    id: 'crimson-guardian',
    name: 'Crimson Guardian',
    shortName: 'Guardian',
    minDays: 180,
    horizon: '180D',
    description: 'Complete 180 days to reach the half-year done-day milestone.',
    accent: 'red',
  },
  ...QUARTERLY_BADGES,
];

export function getBadgeProgress(completedDays: number) {
  let current = LONG_TERM_BADGES[0];

  for (const badge of LONG_TERM_BADGES) {
    if (completedDays >= badge.minDays) {
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
      unlockProgress: 100,
      daysRemaining: 0,
    };
  }

  const daySpan = Math.max(1, next.minDays - current.minDays);
  const dayProgress = Math.min(
    100,
    Math.max(0, ((completedDays - current.minDays) / daySpan) * 100)
  );

  return {
    current,
    next,
    dayProgress,
    unlockProgress: dayProgress,
    daysRemaining: Math.max(0, next.minDays - completedDays),
  };
}
