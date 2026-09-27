import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getKolkataTimeInfo,
  isHabitDueForDate,
  parseScheduledMinutes,
} from '../server/scheduler';

test('scheduler time parsing accepts valid times and fails safe to 21:00', () => {
  assert.equal(parseScheduledMinutes('09:30'), 570);
  assert.equal(parseScheduledMinutes('23:59'), 1439);
  assert.equal(parseScheduledMinutes('25:00'), 1260);
  assert.equal(parseScheduledMinutes('bad-value'), 1260);
});

test('Kolkata date boundaries are calculated in IST', () => {
  const instant = new Date('2026-09-26T20:00:00.000Z');
  const info = getKolkataTimeInfo(instant);
  assert.equal(info.dateKey, '2026-09-27');
  assert.equal(info.timeStr, '01:30');
});

test('habit scheduling handles daily, weekdays, custom, skips and extras', () => {
  const base = {
    createdAt: '2026-09-01T00:00:00.000Z',
    skippedDates: [],
    extraDates: [],
  };

  assert.equal(
    isHabitDueForDate({ ...base, frequency: 'daily' }, '2026-09-27'),
    true
  );
  assert.equal(
    isHabitDueForDate({ ...base, frequency: 'weekdays' }, '2026-09-27'),
    false
  );
  assert.equal(
    isHabitDueForDate(
      { ...base, frequency: 'custom', repeatDays: [0] },
      '2026-09-27'
    ),
    true
  );
  assert.equal(
    isHabitDueForDate(
      { ...base, frequency: 'daily', skippedDates: ['2026-09-27'] },
      '2026-09-27'
    ),
    false
  );
  assert.equal(
    isHabitDueForDate(
      {
        ...base,
        frequency: 'weekdays',
        extraDates: ['2026-09-27'],
      },
      '2026-09-27'
    ),
    true
  );
});
