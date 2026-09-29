export type BadgeTier = 'bronze' | 'gold' | 'success';

export interface LongTermBadge {
  id: string;
  name: string;
  shortName: string;
  minDays: number;
  horizon: string;
  description: string;
  accent: 'blue' | 'red' | 'amber' | 'violet';
  tier: BadgeTier;
}

function badge(
  id: string,
  name: string,
  shortName: string,
  minDays: number,
  accent: LongTermBadge['accent'],
  tier: BadgeTier
): LongTermBadge {
  return {
    id,
    name,
    shortName,
    minDays,
    horizon: `${minDays}D`,
    description:
      minDays === 0
        ? 'Your starting role. Build the habit of completing focused analytics work.'
        : `Complete ${minDays.toLocaleString('en-US')} days to unlock the ${name} badge.`,
    accent,
    tier,
  };
}

export const LONG_TERM_BADGES: LongTermBadge[] = [
  // Bronze tier — foundation and early-career analytics roles.
  badge('trainee', 'Analytics Learner', 'Learner', 0, 'blue', 'bronze'),
  badge('data-trainee', 'Data Trainee', 'Trainee', 7, 'amber', 'bronze'),
  badge('day-15', 'Data Intern', 'Intern', 15, 'blue', 'bronze'),
  badge('analytics-associate', 'Analytics Associate', 'Associate', 30, 'amber', 'bronze'),
  badge('day-45', 'Junior Data Analyst', 'Junior Analyst', 45, 'blue', 'bronze'),
  badge('day-60', 'Reporting Analyst', 'Reporting', 60, 'violet', 'bronze'),
  badge('day-75', 'Data Analyst I', 'Analyst I', 75, 'red', 'bronze'),
  badge('bi-analyst', 'BI Analyst', 'BI Analyst', 90, 'blue', 'bronze'),
  badge('data-analyst-ii', 'Data Analyst II', 'Analyst II', 180, 'red', 'bronze'),

  // Gold tier — established and senior individual-contributor roles.
  badge('day-270', 'Business Analyst', 'Business Analyst', 270, 'amber', 'gold'),
  badge('day-360', 'Senior Reporting Analyst', 'Sr Reporting', 360, 'blue', 'gold'),
  badge('day-450', 'Senior Data Analyst', 'Senior Analyst', 450, 'red', 'gold'),
  badge('day-540', 'Senior BI Analyst', 'Senior BI', 540, 'violet', 'gold'),
  badge('day-630', 'Analytics Specialist', 'Specialist', 630, 'amber', 'gold'),
  badge('day-720', 'Analytics Consultant', 'Consultant', 720, 'blue', 'gold'),
  badge('day-810', 'Analytics Engineer', 'Analytics Eng', 810, 'red', 'gold'),
  badge('day-900', 'Analytics Strategist', 'Strategist', 900, 'violet', 'gold'),
  badge('day-990', 'Principal Data Analyst', 'Principal', 990, 'amber', 'gold'),

  // Success tier — leadership, architecture and mastery roles.
  badge('day-1080', 'Lead Data Analyst', 'Lead Analyst', 1080, 'blue', 'success'),
  badge('day-1170', 'BI Lead', 'BI Lead', 1170, 'red', 'success'),
  badge('day-1260', 'Analytics Lead', 'Analytics Lead', 1260, 'violet', 'success'),
  badge('day-1350', 'Analytics Manager', 'Manager', 1350, 'amber', 'success'),
  badge('day-1440', 'Senior Analytics Manager', 'Senior Manager', 1440, 'blue', 'success'),
  badge('day-1530', 'Analytics Architect', 'Architect', 1530, 'red', 'success'),
  badge('day-1620', 'Head of Analytics', 'Head Analytics', 1620, 'violet', 'success'),
  badge('day-1710', 'Analytics Director', 'Director', 1710, 'amber', 'success'),
  badge('day-1800', 'Analytics Master', 'Analytics Master', 1800, 'red', 'success'),
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
