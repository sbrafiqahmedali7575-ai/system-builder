import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Check,
  Flame,
  Plus,
  Repeat2,
  Trash2,
} from 'lucide-react';
import { HabitFrequency, HabitItem } from '../types';
import { CONFIGURED_TIMEZONE, getIsoDateKeyInTimezone } from '../utils/taskDateUtils';

interface HabitTrackerProps {
  habits: HabitItem[];
  onAddHabit: (habit: Omit<HabitItem, 'id'>) => Promise<void>;
  onUpdateHabit: (habit: HabitItem) => Promise<void>;
  onDeleteHabit: (habitId: string) => Promise<void>;
}

const COLORS: HabitItem['color'][] = ['blue', 'emerald', 'amber', 'rose', 'violet'];

const colorClasses: Record<HabitItem['color'], { dot: string; active: string; soft: string }> = {
  blue: { dot: 'bg-blue-500', active: 'bg-blue-600 text-white border-blue-600', soft: 'bg-blue-50 border-blue-200' },
  emerald: { dot: 'bg-emerald-500', active: 'bg-emerald-600 text-white border-emerald-600', soft: 'bg-emerald-50 border-emerald-200' },
  amber: { dot: 'bg-amber-500', active: 'bg-amber-500 text-white border-amber-500', soft: 'bg-amber-50 border-amber-200' },
  rose: { dot: 'bg-rose-500', active: 'bg-rose-500 text-white border-rose-500', soft: 'bg-rose-50 border-rose-200' },
  violet: { dot: 'bg-violet-500', active: 'bg-violet-600 text-white border-violet-600', soft: 'bg-violet-50 border-violet-200' },
};

function parseKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function keyFromDate(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function addDays(key: string, amount: number): string {
  const date = parseKey(key);
  date.setUTCDate(date.getUTCDate() + amount);
  return keyFromDate(date);
}

function isHabitDue(habit: HabitItem, dateKey: string): boolean {
  if (habit.frequency === 'daily') return true;
  const day = parseKey(dateKey).getUTCDay();
  return day !== 0 && day !== 6;
}

function getCurrentStreak(habit: HabitItem, today: string): number {
  const checked = new Set(habit.checkIns);
  let cursor = today;
  let streak = 0;

  for (let i = 0; i < 365; i += 1) {
    if (!isHabitDue(habit, cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (!checked.has(cursor)) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function getSuccessRate(habit: HabitItem, today: string): number {
  let due = 0;
  let completed = 0;
  const checked = new Set(habit.checkIns);
  for (let offset = 0; offset < 30; offset += 1) {
    const key = addDays(today, -offset);
    if (!isHabitDue(habit, key)) continue;
    due += 1;
    if (checked.has(key)) completed += 1;
  }
  return due ? Math.round((completed / due) * 100) : 0;
}

export const HabitTracker: React.FC<HabitTrackerProps> = ({
  habits,
  onAddHabit,
  onUpdateHabit,
  onDeleteHabit,
}) => {
  const today = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('✓');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [color, setColor] = useState<HabitItem['color']>('blue');
  const [showAdd, setShowAdd] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const weekDates = useMemo(() => {
    const anchor = parseKey(weekAnchor);
    const day = anchor.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = addDays(weekAnchor, mondayOffset);
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  }, [weekAnchor]);

  const completedThisWeek = habits.reduce(
    (sum, habit) =>
      sum + weekDates.filter((dateKey) => isHabitDue(habit, dateKey) && habit.checkIns.includes(dateKey)).length,
    0
  );
  const dueThisWeek = habits.reduce(
    (sum, habit) => sum + weekDates.filter((dateKey) => isHabitDue(habit, dateKey)).length,
    0
  );

  const createHabit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onAddHabit({
      name: trimmed,
      emoji: emoji.trim() || '✓',
      frequency,
      color,
      checkIns: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setName('');
    setEmoji('✓');
    setFrequency('daily');
    setColor('blue');
    setShowAdd(false);
  };

  const toggleCheckIn = async (habit: HabitItem, dateKey: string) => {
    if (!isHabitDue(habit, dateKey) || dateKey > today) return;
    try {
      setBusyId(habit.id);
      const exists = habit.checkIns.includes(dateKey);
      const checkIns = exists
        ? habit.checkIns.filter((key) => key !== dateKey)
        : [...habit.checkIns, dateKey].sort();
      await onUpdateHabit({ ...habit, checkIns, updatedAt: new Date().toISOString() });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] font-black text-blue-600">Consistency workspace</p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight">Habit Tracker</h2>
          <p className="mt-1 text-sm font-semibold text-[#766653]">
            Weekly check-ins, streaks, and a rolling 30-day success rate.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-[#dfd1b6] bg-[#fffaf0] px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-wider font-black text-[#8b7a66]">This week</div>
            <div className="text-sm font-black text-[#3f3426]">
              {completedThisWeek}/{dueThisWeek || 0}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAdd((value) => !value)}
            className="h-10 px-3 rounded-xl bg-blue-600 text-white font-black text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Habit
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="rounded-2xl border border-[#dfd1b6] bg-[#fff8e8] p-4">
          <div className="grid grid-cols-1 md:grid-cols-[72px_minmax(0,1fr)_150px_auto] gap-2">
            <input
              value={emoji}
              onChange={(event) => setEmoji(event.target.value.slice(0, 3))}
              className="h-10 rounded-xl border border-[#dfd1b6] bg-white/80 px-3 text-center text-lg outline-none"
              aria-label="Habit emoji"
            />
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void createHabit();
              }}
              placeholder="Habit name"
              className="h-10 rounded-xl border border-[#dfd1b6] bg-white/80 px-3 text-sm font-semibold outline-none focus:border-blue-400"
            />
            <select
              value={frequency}
              onChange={(event) => setFrequency(event.target.value as HabitFrequency)}
              className="h-10 rounded-xl border border-[#dfd1b6] bg-white/80 px-3 text-sm font-bold outline-none"
            >
              <option value="daily">Every day</option>
              <option value="weekdays">Weekdays</option>
            </select>
            <button
              type="button"
              onClick={() => void createHabit()}
              disabled={!name.trim()}
              className="h-10 rounded-xl bg-blue-600 text-white px-4 font-black text-sm disabled:opacity-40"
            >
              Save
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-bold text-[#8b7a66]">Color</span>
            {COLORS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setColor(item)}
                className={`w-7 h-7 rounded-full ${colorClasses[item].dot} ${color === item ? 'ring-2 ring-offset-2 ring-[#3f3426]' : ''}`}
                aria-label={`Use ${item} habit color`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#ded0b4] bg-[#fffaf0] overflow-hidden">
        <div className="px-3 py-3 border-b border-black/8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}
            className="px-3 py-1.5 rounded-lg border border-[#dfd1b6] text-xs font-black hover:bg-black/5"
          >
            Previous
          </button>
          <div className="text-sm font-black">
            {parseKey(weekDates[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
            {' – '}
            {parseKey(weekDates[6]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekAnchor(today)}
              className="px-3 py-1.5 rounded-lg border border-[#dfd1b6] text-xs font-black hover:bg-black/5"
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}
              className="px-3 py-1.5 rounded-lg border border-[#dfd1b6] text-xs font-black hover:bg-black/5"
            >
              Next
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[230px_repeat(7,1fr)_90px_90px] border-b border-black/8 bg-[#fbf4e3]">
              <div className="p-3 text-[10px] uppercase tracking-wider font-black text-[#8b7a66]">Habit</div>
              {weekDates.map((dateKey) => {
                const date = parseKey(dateKey);
                return (
                  <div key={dateKey} className="p-2 text-center">
                    <div className="text-[10px] font-black uppercase text-[#8b7a66]">
                      {date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}
                    </div>
                    <div className={`mt-1 mx-auto w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                      dateKey === today ? 'bg-blue-600 text-white' : 'text-[#3f3426]'
                    }`}>
                      {date.getUTCDate()}
                    </div>
                  </div>
                );
              })}
              <div className="p-3 text-center text-[10px] uppercase tracking-wider font-black text-[#8b7a66]">Streak</div>
              <div className="p-3 text-center text-[10px] uppercase tracking-wider font-black text-[#8b7a66]">30 Day</div>
            </div>

            {habits.length === 0 ? (
              <div className="py-14 text-center">
                <Repeat2 className="w-8 h-8 mx-auto text-[#b7a58d]" />
                <div className="mt-2 text-sm font-black">No habits yet</div>
                <div className="text-xs font-semibold text-[#8b7a66]">Add a small repeatable behavior to begin.</div>
              </div>
            ) : (
              habits.map((habit) => {
                const streak = getCurrentStreak(habit, today);
                const rate = getSuccessRate(habit, today);
                return (
                  <div
                    key={habit.id}
                    className={`grid grid-cols-[230px_repeat(7,1fr)_90px_90px] border-b last:border-b-0 border-black/8 ${
                      busyId === habit.id ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="p-3 flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-lg ${colorClasses[habit.color].soft}`}>
                        {habit.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-black truncate">{habit.name}</div>
                        <div className="text-[10px] font-bold text-[#8b7a66]">
                          {habit.frequency === 'daily' ? 'Every day' : 'Weekdays'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void onDeleteHabit(habit.id)}
                        className="w-7 h-7 rounded-lg text-[#a18f78] hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center"
                        title="Delete habit"
                        aria-label={`Delete ${habit.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {weekDates.map((dateKey) => {
                      const due = isHabitDue(habit, dateKey);
                      const isFuture = dateKey > today;
                      const checked = habit.checkIns.includes(dateKey);
                      return (
                        <div key={dateKey} className="flex items-center justify-center border-l border-black/5">
                          <button
                            type="button"
                            disabled={!due || isFuture}
                            onClick={() => void toggleCheckIn(habit, dateKey)}
                            className={`w-8 h-8 rounded-full border flex items-center justify-center transition ${
                              !due || isFuture
                                ? 'border-transparent bg-black/[0.025] cursor-not-allowed opacity-50'
                                : checked
                                ? colorClasses[habit.color].active
                                : 'border-[#cdbfa8] bg-white hover:border-blue-400'
                            }`}
                            title={isFuture ? 'Future check-ins are locked' : due ? (checked ? 'Remove check-in' : 'Check in') : 'Not scheduled'}
                            aria-label={`${habit.name} on ${dateKey}`}
                          >
                            {checked && <Check className="w-4 h-4" />}
                          </button>
                        </div>
                      );
                    })}

                    <div className="border-l border-black/5 flex items-center justify-center">
                      <span className="inline-flex items-center gap-1 text-xs font-black">
                        <Flame className="w-3.5 h-3.5 text-orange-500" />
                        {streak}
                      </span>
                    </div>
                    <div className="border-l border-black/5 flex items-center justify-center">
                      <span className="inline-flex items-center gap-1 text-xs font-black">
                        <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                        {rate}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
