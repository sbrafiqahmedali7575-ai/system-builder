import assert from 'node:assert/strict';
import type { DailyRecord } from '../src/types';
import {
  calculateAchievedWeeks,
  calculateCalendarStreakStats,
  calculateOverallCompletion,
} from '../src/utils/progressAnalytics';

const record = (date: string, isCompleted: boolean, day: number): DailyRecord => ({
  id: date,
  day,
  date,
  isCompleted,
  result: isCompleted ? 'TRUE' : 'FALSE',
  change: 0,
});

{
  const records = [
    record('2026-09-27', true, 1),
    record('2026-09-28', true, 2),
    record('2026-09-30', true, 3),
  ];

  assert.deepEqual(calculateCalendarStreakStats(records, '2026-09-30'), {
    currentStreak: 1,
    maxStreak: 2,
  });
}

{
  const records = [
    record('2026-09-27', true, 1),
    record('2026-09-28', true, 2),
  ];

  assert.deepEqual(calculateCalendarStreakStats(records, '2026-09-29'), {
    currentStreak: 2,
    maxStreak: 2,
  });
}

{
  const records = [
    record('2026-09-27', true, 1),
    record('2026-09-28', true, 2),
    record('2026-09-29', false, 3),
  ];

  assert.equal(
    calculateCalendarStreakStats(records, '2026-09-30').currentStreak,
    0
  );
}

{
  const records: DailyRecord[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 8, 21 + index));
    const dateKey = date.toISOString().slice(0, 10);
    return {
      ...record(dateKey, true, index + 1),
      dayCompletion: index === 0 ? 81 : 100,
    };
  });

  assert.equal(calculateAchievedWeeks(records, '2026-09-28'), 1);
}

{
  const records: DailyRecord[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 8, 21 + index));
    const dateKey = date.toISOString().slice(0, 10);
    return {
      ...record(dateKey, true, index + 1),
      dayCompletion: 80,
    };
  });

  assert.equal(
    calculateAchievedWeeks(records, '2026-09-28'),
    0,
    'A weekly DayCompletion average of exactly 80% must not count as achieved.'
  );
}

{
  const records = [
    record('2026-08-01', true, 1),
    record('2026-08-02', false, 2),
    record('2026-08-03', true, 3),
  ];

  assert.deepEqual(calculateOverallCompletion(records, '2026-08-03'), {
    completedDays: 2,
    totalDays: 3,
    completionRate: 67,
  });
}

console.log('progressAnalytics tests passed');
