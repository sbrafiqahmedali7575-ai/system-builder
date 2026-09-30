export interface DailyRecord {
  id: string;
  day: number;
  date: string; // e.g. "08-Sep-2026"
  isCompleted: boolean;
  result: 'TRUE' | 'FALSE';
  change: number; // e.g. -0.10, 0.25
  skill?: string;
  summary?: string;
  notes?: string;
  updatedAt?: string; // ISO 8601 UTC timestamp
}

export type MatrixQuadrant = 'urgent-important' | 'important' | 'urgent' | 'neither';

export type HabitFrequency = 'daily' | 'weekdays' | 'custom';

export interface HabitInactivePeriod {
  from: string; // YYYY-MM-DD, inclusive
  to?: string | null; // YYYY-MM-DD, inclusive; null while currently inactive
}

export interface HabitItem {
  id: string;
  name: string;
  emoji: string;
  frequency: HabitFrequency;
  repeatDays?: number[]; // 0=Sunday ... 6=Saturday; used when frequency='custom'
  skippedDates?: string[]; // One-off dates removed from the recurring schedule
  extraDates?: string[]; // One-off dates added to the recurring schedule
  color: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';
  checkIns: string[]; // YYYY-MM-DD date keys
  createdAt: string;
  updatedAt?: string;
  activeFrom?: string; // YYYY-MM-DD canonical habit start date
  isActive?: boolean; // Canonical active flag in the single-user model
  inactivePeriods?: HabitInactivePeriod[]; // Pause history; no HabitLogs are created inside these ranges
}

export interface TaskItem {
  id: string;
  taskKey: string; // e.g. "2026-08-26" (Today's Date)
  taskOfTheDay: string; // Description or objective of the task
  isCompleted: boolean; // Completion status
  priority?: 'High' | 'Medium' | 'Normal';
  timeEstimate?: string; // legacy alias retained for compatibility
  EstimationTime?: string; // Planned duration, e.g. 45m or 1h
  ActualTime?: string; // Actual duration spent, e.g. 50m or 1h 10m
  category?: string;
  notes?: string;
  updatedAt?: string;
  completedAt?: string;
  matrixQuadrant?: MatrixQuadrant;
  taskOrder?: number; // Canonical contiguous order within scheduledDate
}

export interface DayProgressStats {
  successfulDays: number;
  currentStreak: number;
  achievedWeeks: number;
  bestStreak: number;
}

export interface DaySubmitResult {
  status: 'COMPLETED' | 'NOT_COMPLETED';
  previousStatus: 'COMPLETED' | 'NOT_COMPLETED' | null;
  isNewSuccess: boolean;
  statsBefore: DayProgressStats;
  statsAfter: DayProgressStats;
}

export type ToolsDensity = 'compact' | 'comfortable';

export type DashboardTheme = 'powerbi' | 'dark' | 'executive' | 'modern';

export interface KPIStats {
  totalDays: number;
  completedDays: number;
  pendingDays: number;
  completionRate: number; // 0 to 100
  netChange: number;
  avgChange: number;
  currentStreak: number;
  maxStreak: number;
  uniqueSkillsCount: number;
  topSkill: string;
  positiveDaysCount: number;
  negativeDaysCount: number;
}
