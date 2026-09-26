import { HabitItem } from '../types';

export const HABIT_WEEKDAYS = [
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
  { value: 0, short: 'Sun', long: 'Sunday' },
] as const;

export function parseHabitDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function habitDateKey(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function addHabitDays(key: string, amount: number): string {
  const date = parseHabitDateKey(key);
  date.setUTCDate(date.getUTCDate() + amount);
  return habitDateKey(date);
}

export function getHabitStartKey(habit: HabitItem): string {
  const created = new Date(habit.createdAt);
  if (Number.isNaN(created.getTime())) return '0000-01-01';
  return habitDateKey(
    new Date(
      Date.UTC(created.getUTCFullYear(), created.getUTCMonth(), created.getUTCDate())
    )
  );
}

export function normalizeRepeatDays(habit: HabitItem): number[] {
  if (habit.frequency === 'daily') return [0, 1, 2, 3, 4, 5, 6];
  if (habit.frequency === 'weekdays') return [1, 2, 3, 4, 5];
  const raw = Array.isArray(habit.repeatDays) ? habit.repeatDays : [];
  return [...new Set(raw.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
}

export function isHabitDue(habit: HabitItem, dateKey: string): boolean {
  if (dateKey < getHabitStartKey(habit)) return false;
  return normalizeRepeatDays(habit).includes(parseHabitDateKey(dateKey).getUTCDay());
}

export function getHabitScheduleLabel(habit: HabitItem): string {
  if (habit.frequency === 'daily') return 'Every day';
  if (habit.frequency === 'weekdays') return 'Weekdays';

  const days = normalizeRepeatDays(habit);
  if (days.length === 0) return 'Custom schedule';
  const ordered = HABIT_WEEKDAYS.filter((day) => days.includes(day.value));
  return ordered.map((day) => day.short).join(', ');
}

function rateForWindow(habit: HabitItem, today: string, days: number): {
  completed: number;
  due: number;
  rate: number;
} {
  const checked = new Set(habit.checkIns);
  let completed = 0;
  let due = 0;

  for (let offset = 0; offset < days; offset += 1) {
    const key = addHabitDays(today, -offset);
    if (!isHabitDue(habit, key)) continue;
    due += 1;
    if (checked.has(key)) completed += 1;
  }

  return {
    completed,
    due,
    rate: due ? Math.round((completed / due) * 100) : 0,
  };
}

export function getHabitCurrentStreak(habit: HabitItem, today: string): number {
  const checked = new Set(habit.checkIns);
  let cursor = today;
  let streak = 0;
  const startKey = getHabitStartKey(habit);

  for (let i = 0; i < 3660 && cursor >= startKey; i += 1) {
    if (!isHabitDue(habit, cursor)) {
      cursor = addHabitDays(cursor, -1);
      continue;
    }
    if (!checked.has(cursor)) break;
    streak += 1;
    cursor = addHabitDays(cursor, -1);
  }
  return streak;
}

export function getHabitBestStreak(habit: HabitItem, today: string): number {
  const checked = new Set(habit.checkIns);
  const startKey = getHabitStartKey(habit);
  let cursor = startKey;
  let best = 0;
  let current = 0;

  for (let i = 0; i < 3660 && cursor <= today; i += 1) {
    if (isHabitDue(habit, cursor)) {
      if (checked.has(cursor)) {
        current += 1;
        best = Math.max(best, current);
      } else {
        current = 0;
      }
    }
    cursor = addHabitDays(cursor, 1);
  }

  return best;
}

export function getHabitAllTimeStats(habit: HabitItem, today: string): {
  completed: number;
  due: number;
  rate: number;
} {
  const checked = new Set(habit.checkIns);
  const startKey = getHabitStartKey(habit);
  let cursor = startKey;
  let due = 0;
  let completed = 0;

  for (let i = 0; i < 3660 && cursor <= today; i += 1) {
    if (isHabitDue(habit, cursor)) {
      due += 1;
      if (checked.has(cursor)) completed += 1;
    }
    cursor = addHabitDays(cursor, 1);
  }

  return {
    completed,
    due,
    rate: due ? Math.round((completed / due) * 100) : 0,
  };
}

export function getHabitStats(habit: HabitItem, today: string) {
  const thirty = rateForWindow(habit, today, 30);
  const ninety = rateForWindow(habit, today, 90);
  const allTime = getHabitAllTimeStats(habit, today);

  return {
    currentStreak: getHabitCurrentStreak(habit, today),
    bestStreak: getHabitBestStreak(habit, today),
    thirty,
    ninety,
    allTime,
    totalCheckIns: habit.checkIns.filter((key) => key <= today).length,
  };
}
