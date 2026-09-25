export interface LongTermBadge {
  id: string;
  name: string;
  shortName: string;
  minDays: number;
  horizon: string;
  description: string;
  accent: 'blue' | 'red' | 'amber' | 'violet';
}

const QUARTERLY_BADGES: LongTermBadge[] = [
  {
    id: 'day-270',
    name: 'Dashboard Developer',
    shortName: 'Dashboard Dev',
    minDays: 270,
    horizon: '270D',
    description: 'Complete 270 days to unlock the Dashboard Developer badge.',
    accent: 'amber',
  },
  {
    id: 'day-360',
    name: 'DAX Practitioner',
    shortName: 'DAX',
    minDays: 360,
    horizon: '360D',
    description: 'Complete 360 days to unlock the DAX Practitioner badge.',
    accent: 'blue',
  },
  {
    id: 'day-450',
    name: 'Data Modeler',
    shortName: 'Data Modeler',
    minDays: 450,
    horizon: '450D',
    description: 'Complete 450 days to unlock the Data Modeler badge.',
    accent: 'red',
  },
  {
    id: 'day-540',
    name: 'Reporting Analyst',
    shortName: 'Reporting',
    minDays: 540,
    horizon: '540D',
    description: 'Complete 540 days to unlock the Reporting Analyst badge.',
    accent: 'violet',
  },
  {
    id: 'day-630',
    name: 'Insight Analyst',
    shortName: 'Insights',
    minDays: 630,
    horizon: '630D',
    description: 'Complete 630 days to unlock the Insight Analyst badge.',
    accent: 'amber',
  },
  {
    id: 'day-720',
    name: 'Business Analyst',
    shortName: 'Business',
    minDays: 720,
    horizon: '720D',
    description: 'Complete 720 days to unlock the Business Analyst badge.',
    accent: 'blue',
  },
  {
    id: 'day-810',
    name: 'KPI Specialist',
    shortName: 'KPI',
    minDays: 810,
    horizon: '810D',
    description: 'Complete 810 days to unlock the KPI Specialist badge.',
    accent: 'red',
  },
  {
    id: 'day-900',
    name: 'Customer Analyst',
    shortName: 'Customer',
    minDays: 900,
    horizon: '900D',
    description: 'Complete 900 days to unlock the Customer Analyst badge.',
    accent: 'violet',
  },
  {
    id: 'day-990',
    name: 'Sales Analyst',
    shortName: 'Sales',
    minDays: 990,
    horizon: '990D',
    description: 'Complete 990 days to unlock the Sales Analyst badge.',
    accent: 'amber',
  },
  {
    id: 'day-1080',
    name: 'Operations Analyst',
    shortName: 'Operations',
    minDays: 1080,
    horizon: '1080D',
    description: 'Complete 1,080 days to unlock the Operations Analyst badge.',
    accent: 'blue',
  },
  {
    id: 'day-1170',
    name: 'Finance Analyst',
    shortName: 'Finance',
    minDays: 1170,
    horizon: '1170D',
    description: 'Complete 1,170 days to unlock the Finance Analyst badge.',
    accent: 'red',
  },
  {
    id: 'day-1260',
    name: 'Product Analyst',
    shortName: 'Product',
    minDays: 1260,
    horizon: '1260D',
    description: 'Complete 1,260 days to unlock the Product Analyst badge.',
    accent: 'violet',
  },
  {
    id: 'day-1350',
    name: 'Marketing Analyst',
    shortName: 'Marketing',
    minDays: 1350,
    horizon: '1350D',
    description: 'Complete 1,350 days to unlock the Marketing Analyst badge.',
    accent: 'amber',
  },
  {
    id: 'day-1440',
    name: 'Analytics Engineer',
    shortName: 'Analytics Eng',
    minDays: 1440,
    horizon: '1440D',
    description: 'Complete 1,440 days to unlock the Analytics Engineer badge.',
    accent: 'blue',
  },
  {
    id: 'day-1530',
    name: 'BI Developer',
    shortName: 'BI Developer',
    minDays: 1530,
    horizon: '1530D',
    description: 'Complete 1,530 days to unlock the BI Developer badge.',
    accent: 'red',
  },
  {
    id: 'day-1620',
    name: 'Senior Data Analyst',
    shortName: 'Senior Analyst',
    minDays: 1620,
    horizon: '1620D',
    description: 'Complete 1,620 days to unlock the Senior Data Analyst badge.',
    accent: 'violet',
  },
  {
    id: 'day-1710',
    name: 'Analytics Lead',
    shortName: 'Analytics Lead',
    minDays: 1710,
    horizon: '1710D',
    description: 'Complete 1,710 days to unlock the Analytics Lead badge.',
    accent: 'amber',
  },
  {
    id: 'day-1800',
    name: 'Analytics Master',
    shortName: 'Analytics Master',
    minDays: 1800,
    horizon: '1800D',
    description: 'Complete 1,800 days to finish the long-term Data Analyst mastery path.',
    accent: 'red',
  },
];

export const LONG_TERM_BADGES: LongTermBadge[] = [
  {
    id: 'trainee',
    name: 'Data Explorer',
    shortName: 'Explorer',
    minDays: 0,
    horizon: '0D',
    description: 'Your starting badge. Build the habit of completing focused analytics work.',
    accent: 'blue',
  },
  {
    id: 'first-scroll',
    name: 'SQL Starter',
    shortName: 'SQL Starter',
    minDays: 7,
    horizon: '7D',
    description: 'Complete 7 days to unlock the SQL Starter badge.',
    accent: 'amber',
  },
  {
    id: 'day-15',
    name: 'Excel Explorer',
    shortName: 'Excel',
    minDays: 15,
    horizon: '15D',
    description: 'Complete 15 days to unlock the Excel Explorer badge.',
    accent: 'blue',
  },
  {
    id: 'shuriken-bronze',
    name: 'Query Builder',
    shortName: 'Query Builder',
    minDays: 30,
    horizon: '30D',
    description: 'Complete 30 days to unlock the Query Builder badge.',
    accent: 'amber',
  },
  {
    id: 'day-45',
    name: 'Data Cleaner',
    shortName: 'Data Cleaner',
    minDays: 45,
    horizon: '45D',
    description: 'Complete 45 days to unlock the Data Cleaner badge.',
    accent: 'blue',
  },
  {
    id: 'day-60',
    name: 'Data Wrangler',
    shortName: 'Wrangler',
    minDays: 60,
    horizon: '60D',
    description: 'Complete 60 days to unlock the Data Wrangler badge.',
    accent: 'violet',
  },
  {
    id: 'day-75',
    name: 'EDA Practitioner',
    shortName: 'EDA',
    minDays: 75,
    horizon: '75D',
    description: 'Complete 75 days to unlock the Exploratory Data Analysis badge.',
    accent: 'red',
  },
  {
    id: 'silent-scout',
    name: 'SQL Analyst',
    shortName: 'SQL Analyst',
    minDays: 90,
    horizon: '90D',
    description: 'Complete 90 days to unlock the SQL Analyst badge.',
    accent: 'blue',
  },
  {
    id: 'crimson-guardian',
    name: 'BI Analyst',
    shortName: 'BI Analyst',
    minDays: 180,
    horizon: '180D',
    description: 'Complete 180 days to unlock the Business Intelligence Analyst badge.',
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
