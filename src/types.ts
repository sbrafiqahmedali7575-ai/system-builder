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
  responseSubmittedAt?: string; // Explicit app/email response timestamp; auto-default uses this when day closes
  responseSource?: 'APP' | 'EMAIL' | 'AUTO_DEFAULT';
  updatedAt?: string; // ISO 8601 UTC timestamp
}

export type MatrixQuadrant = 'urgent-important' | 'important' | 'urgent' | 'neither';

export type HabitFrequency = 'daily' | 'weekdays' | 'custom';

export interface HabitItem {
  id: string;
  name: string;
  emoji: string;
  frequency: HabitFrequency;
  repeatDays?: number[]; // 0=Sunday ... 6=Saturday; used when frequency='custom'
  color: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';
  checkIns: string[]; // YYYY-MM-DD date keys
  createdAt: string;
  updatedAt?: string;
}

export interface TaskItem {
  id: string;
  taskKey: string; // e.g. "2026-08-26" (Today's Date)
  taskOfTheDay: string; // Description or objective of the task
  isCompleted: boolean; // Completion status
  priority?: 'High' | 'Medium' | 'Normal';
  timeEstimate?: string;
  category?: string;
  notes?: string;
  updatedAt?: string;
  completedAt?: string;
  matrixQuadrant?: MatrixQuadrant;
}

export type DashboardTheme = 'powerbi' | 'dark' | 'executive' | 'modern';

export interface FilterState {
  status: 'ALL' | 'COMPLETED' | 'PENDING';
  searchQuery: string;
  dateRange: 'ALL' | '7D' | '14D' | '30D';
}

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
