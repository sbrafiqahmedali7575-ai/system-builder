import type { DailyRecord, TaskItem } from '../types';
import { toInputDateValue } from './taskDateUtils';

export const SYSTEM_BUILDER_START_DATE_KEY = '2026-08-01';
const DAY_MS = 24 * 60 * 60 * 1000;

export function addDateKeyDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return dateKey;
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function recordDateKey(record: DailyRecord): string {
  return toInputDateValue(record.date);
}

export function calculateCalendarStreakStats(
  records: DailyRecord[],
  currentDateKey?: string
): { currentStreak: number; maxStreak: number } {
  const byDate = new Map<string, boolean>();

  records.forEach((record) => {
    const key = recordDateKey(record);
    if (key) byDate.set(key, record.isCompleted);
  });

  const dates = [...byDate.keys()].sort();
  let maxStreak = 0;
  let running = 0;
  let previousDate: string | null = null;

  for (const dateKey of dates) {
    const completed = byDate.get(dateKey) === true;
    const consecutive =
      previousDate !== null && addDateKeyDays(previousDate, 1) === dateKey;

    if (completed) {
      running = consecutive ? running + 1 : 1;
      maxStreak = Math.max(maxStreak, running);
    } else {
      running = 0;
    }

    previousDate = dateKey;
  }

  if (dates.length === 0) {
    return { currentStreak: 0, maxStreak: 0 };
  }

  const referenceDate = currentDateKey || dates[dates.length - 1];
  let anchor =
    byDate.get(referenceDate) === true
      ? referenceDate
      : addDateKeyDays(referenceDate, -1);

  if (byDate.get(anchor) !== true) {
    return { currentStreak: 0, maxStreak };
  }

  let currentStreak = 0;
  while (byDate.get(anchor) === true) {
    currentStreak += 1;
    anchor = addDateKeyDays(anchor, -1);
  }

  return {
    currentStreak,
    maxStreak: Math.max(maxStreak, currentStreak),
  };
}

export function calculateAchievedWeeks(
  tasks: TaskItem[],
  currentDateKey: string
): number {
  if (tasks.length === 0) return 0;

  const getMonday = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const weekday = date.getUTCDay();
    return addDateKeyDays(dateKey, weekday === 0 ? -6 : 1 - weekday);
  };

  const dailyRate = (dateKey: string) => {
    const dayTasks = tasks.filter((task) => task.taskKey === dateKey);
    if (dayTasks.length === 0) return 0;
    return (
      dayTasks.filter((task) => task.isCompleted).length / dayTasks.length
    ) * 100;
  };

  const firstTaskDate = tasks
    .map((task) => task.taskKey)
    .filter(Boolean)
    .sort()[0];

  if (!firstTaskDate) return 0;

  let weekStart = getMonday(firstTaskDate);
  const currentWeekStart = getMonday(currentDateKey);
  let achieved = 0;
  let guard = 0;

  while (weekStart < currentWeekStart && guard < 5200) {
    const score =
      Array.from({ length: 7 }, (_, index) =>
        dailyRate(addDateKeyDays(weekStart, index))
      ).reduce((sum, rate) => sum + rate, 0) / 7;

    if (score >= 80) achieved += 1;
    weekStart = addDateKeyDays(weekStart, 7);
    guard += 1;
  }

  return achieved;
}

export function calculateOverallCompletion(
  records: DailyRecord[],
  currentDateKey: string,
  startDateKey = SYSTEM_BUILDER_START_DATE_KEY
): { completedDays: number; totalDays: number; completionRate: number } {
  const [sy, sm, sd] = startDateKey.split('-').map(Number);
  const [cy, cm, cd] = currentDateKey.split('-').map(Number);
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const currentUtc = Date.UTC(cy, cm - 1, cd);
  const totalDays = Math.max(
    0,
    Math.floor((currentUtc - startUtc) / DAY_MS) + 1
  );

  const completedDates = new Set(
    records
      .filter((record) => record.isCompleted)
      .map(recordDateKey)
      .filter(
        (dateKey) =>
          dateKey >= startDateKey && dateKey <= currentDateKey
      )
  );

  const completedDays = completedDates.size;
  const completionRate =
    totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

  return { completedDays, totalDays, completionRate };
}
