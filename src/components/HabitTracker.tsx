import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Check,
  Flame,
  History,
  Pencil,
  Plus,
  Repeat2,
  Target,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { HabitFrequency, HabitItem, ToolsDensity } from '../types';
import { CONFIGURED_TIMEZONE, getIsoDateKeyInTimezone } from '../utils/taskDateUtils';
import {
  HABIT_WEEKDAYS,
  addHabitDays,
  getHabitMonthlySummaries,
  getHabitScheduleLabel,
  getHabitStats,
  getHabitWeeklyTrend,
  isHabitDue,
  parseHabitDateKey,
} from '../utils/habitUtils';

interface HabitTrackerProps {
  habits: HabitItem[];
  onAddHabit: (habit: Omit<HabitItem, 'id'>) => Promise<void>;
  onUpdateHabit: (habit: HabitItem) => Promise<void>;
  onDeleteHabit: (habitId: string) => Promise<void>;
  density?: ToolsDensity;
}

type HabitDraft = {
  name: string;
  emoji: string;
  frequency: HabitFrequency;
  repeatDays: number[];
  color: HabitItem['color'];
};

const COLORS: HabitItem['color'][] = ['blue', 'emerald', 'amber', 'rose', 'violet'];

const colorClasses: Record<
  HabitItem['color'],
  { dot: string; active: string; soft: string; text: string }
> = {
  blue: {
    dot: 'bg-blue-500',
    active: 'bg-blue-600 text-white border-blue-600',
    soft: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
  },
  emerald: {
    dot: 'bg-emerald-500',
    active: 'bg-emerald-600 text-white border-emerald-600',
    soft: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
  },
  amber: {
    dot: 'bg-amber-500',
    active: 'bg-amber-500 text-white border-amber-500',
    soft: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
  },
  rose: {
    dot: 'bg-rose-500',
    active: 'bg-rose-500 text-white border-rose-500',
    soft: 'bg-rose-50 border-rose-200',
    text: 'text-rose-700',
  },
  violet: {
    dot: 'bg-violet-500',
    active: 'bg-violet-600 text-white border-violet-600',
    soft: 'bg-violet-50 border-violet-200',
    text: 'text-violet-700',
  },
};

const EMPTY_DRAFT: HabitDraft = {
  name: '',
  emoji: '✓',
  frequency: 'daily',
  repeatDays: [],
  color: 'blue',
};

function getMonday(dateKey: string): string {
  const anchor = parseHabitDateKey(dateKey);
  const day = anchor.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addHabitDays(dateKey, mondayOffset);
}

export const HabitTracker: React.FC<HabitTrackerProps> = ({
  habits,
  onAddHabit,
  onUpdateHabit,
  onDeleteHabit,
  density = 'compact',
}) => {
  const today = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [formOpen, setFormOpen] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [draft, setDraft] = useState<HabitDraft>(EMPTY_DRAFT);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [historyHabitId, setHistoryHabitId] = useState<string | null>(null);
  const compact = density === 'compact';

  const weekDates = useMemo(() => {
    const monday = getMonday(weekAnchor);
    return Array.from({ length: 7 }, (_, index) => addHabitDays(monday, index));
  }, [weekAnchor]);

  const historyHabit =
    habits.find((habit) => habit.id === historyHabitId) || null;

  const eligibleWeekDates = weekDates.filter((dateKey) => dateKey <= today);
  const completedThisWeek = habits.reduce(
    (sum, habit) =>
      sum +
      eligibleWeekDates.filter(
        (dateKey) => isHabitDue(habit, dateKey) && habit.checkIns.includes(dateKey)
      ).length,
    0
  );
  const dueThisWeek = habits.reduce(
    (sum, habit) =>
      sum + eligibleWeekDates.filter((dateKey) => isHabitDue(habit, dateKey)).length,
    0
  );

  const dueToday = habits.filter((habit) => isHabitDue(habit, today));
  const completedToday = dueToday.filter((habit) =>
    habit.checkIns.includes(today)
  ).length;
  const weekCompletionRate = dueThisWeek
    ? Math.round((completedThisWeek / dueThisWeek) * 100)
    : 0;
  const bestCurrentStreak = habits.reduce(
    (best, habit) => Math.max(best, getHabitStats(habit, today).currentStreak),
    0
  );

  const openAdd = () => {
    setEditingHabitId(null);
    setDraft(EMPTY_DRAFT);
    setFormOpen(true);
  };

  const openEdit = (habit: HabitItem) => {
    setEditingHabitId(habit.id);
    setDraft({
      name: habit.name,
      emoji: habit.emoji,
      frequency: habit.frequency,
      repeatDays: habit.repeatDays || [],
      color: habit.color,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingHabitId(null);
    setDraft(EMPTY_DRAFT);
  };

  const toggleRepeatDay = (day: number) => {
    setDraft((current) => ({
      ...current,
      repeatDays: current.repeatDays.includes(day)
        ? current.repeatDays.filter((value) => value !== day)
        : [...current.repeatDays, day].sort((a, b) => a - b),
    }));
  };

  const saveHabit = async () => {
    const name = draft.name.trim();
    if (!name) return;
    if (draft.frequency === 'custom' && draft.repeatDays.length === 0) return;

    if (editingHabitId) {
      const existing = habits.find((habit) => habit.id === editingHabitId);
      if (!existing) return;
      await onUpdateHabit({
        ...existing,
        name,
        emoji: draft.emoji.trim() || '✓',
        frequency: draft.frequency,
        repeatDays: draft.frequency === 'custom' ? draft.repeatDays : undefined,
        color: draft.color,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await onAddHabit({
        name,
        emoji: draft.emoji.trim() || '✓',
        frequency: draft.frequency,
        repeatDays: draft.frequency === 'custom' ? draft.repeatDays : undefined,
        color: draft.color,
        checkIns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    closeForm();
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

  const deleteHabit = async (habitId: string) => {
    if (historyHabitId === habitId) setHistoryHabitId(null);
    if (editingHabitId === habitId) closeForm();
    await onDeleteHabit(habitId);
  };

  const historyDates = useMemo(() => {
    if (!historyHabit) return [];
    return Array.from({ length: 84 }, (_, index) => addHabitDays(today, index - 83));
  }, [historyHabit, today]);

  const historyStats = historyHabit ? getHabitStats(historyHabit, today) : null;

  const monthlySummaries = useMemo(
    () => (historyHabit ? getHabitMonthlySummaries(historyHabit, today, 6) : []),
    [historyHabit, today]
  );

  const weeklyTrend = useMemo(
    () => (historyHabit ? getHabitWeeklyTrend(historyHabit, today, 12) : []),
    [historyHabit, today]
  );

  const heatmapDates = useMemo(() => {
    if (!historyHabit) return [];
    const approximateStart = addHabitDays(today, -364);
    const startDate = parseHabitDateKey(approximateStart);
    const gridStart = addHabitDays(approximateStart, -startDate.getUTCDay());
    const todayDate = parseHabitDateKey(today);
    const gridEnd = addHabitDays(today, 6 - todayDate.getUTCDay());
    const startMs = parseHabitDateKey(gridStart).getTime();
    const endMs = parseHabitDateKey(gridEnd).getTime();
    const dayCount = Math.round((endMs - startMs) / 86400000) + 1;
    return Array.from({ length: dayCount }, (_, index) =>
      addHabitDays(gridStart, index)
    );
  }, [historyHabit, today]);

  const trendDelta = useMemo(() => {
    const valid = weeklyTrend.filter((item) => item.due > 0);
    if (valid.length < 2) return 0;

    const recent = valid.slice(-4);
    const previous = valid.slice(Math.max(0, valid.length - 8), -4);
    const average = (items: typeof valid) =>
      items.length
        ? items.reduce((sum, item) => sum + item.rate, 0) / items.length
        : 0;

    return Math.round(average(recent) - average(previous));
  }, [weeklyTrend]);

  return (
    <div className={`${compact ? 'space-y-2' : 'space-y-4'} lg:h-full lg:overflow-y-auto lg:pr-1`}>
      <div className={`flex flex-col lg:flex-row lg:items-center justify-between ${compact ? 'gap-2' : 'gap-3'}`}>
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] font-black text-blue-600">
            Consistency workspace
          </p>
          <h2 className={`${compact ? 'mt-0.5 text-xl sm:text-2xl' : 'mt-1 text-2xl sm:text-3xl'} font-black tracking-tight`}>
            Habit Tracker
          </h2>
          <p className={`${compact ? 'mt-0.5 text-xs' : 'mt-1 text-sm'} font-semibold text-slate-600 hidden md:block`}>
            Custom schedules, weekly check-ins, streaks, and completion history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={formOpen && !editingHabitId ? closeForm : openAdd}
            className={`${compact ? 'h-8 px-2.5 rounded-lg text-xs gap-1.5' : 'h-10 px-3 rounded-xl text-sm gap-2'} bg-blue-600 text-white font-black inline-flex items-center`}
          >
            {formOpen && !editingHabitId ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {formOpen && !editingHabitId ? 'Cancel' : 'Add Habit'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="rounded-xl border border-blue-200/80 bg-blue-50/60 px-3 py-2">
          <div className="text-[9px] uppercase tracking-wider font-black text-blue-600">
            Today
          </div>
          <div className="mt-1 text-lg font-black text-slate-900">
            {completedToday}/{dueToday.length}
          </div>
          <div className="text-[9px] font-bold text-slate-500">
            due habits done
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2">
          <div className="text-[9px] uppercase tracking-wider font-black text-emerald-600">
            This week
          </div>
          <div className="mt-1 text-lg font-black text-slate-900">
            {weekCompletionRate}%
          </div>
          <div className="text-[9px] font-bold text-slate-500">
            {completedThisWeek}/{dueThisWeek} check-ins
          </div>
        </div>

        <div className="rounded-xl border border-orange-200/80 bg-orange-50/60 px-3 py-2">
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-black text-orange-600">
            <Flame className="w-3 h-3" />
            Best streak
          </div>
          <div className="mt-1 text-lg font-black text-slate-900">
            {bestCurrentStreak}
          </div>
          <div className="text-[9px] font-bold text-slate-500">
            current days
          </div>
        </div>

        <div className="rounded-xl border border-violet-200/80 bg-violet-50/60 px-3 py-2">
          <div className="text-[9px] uppercase tracking-wider font-black text-violet-600">
            Active habits
          </div>
          <div className="mt-1 text-lg font-black text-slate-900">
            {habits.length}
          </div>
          <div className="text-[9px] font-bold text-slate-500">
            tracked habits
          </div>
        </div>
      </div>

      {formOpen && (
        <div className={`${compact ? 'rounded-xl p-3' : 'rounded-2xl p-4'} border border-slate-200 bg-slate-50`}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-black">
                {editingHabitId ? 'Edit Habit' : 'New Habit'}
              </div>
              <div className="text-[11px] font-semibold text-slate-500">
                Name, appearance, and repeat schedule.
              </div>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100"
              aria-label="Close habit editor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[72px_minmax(0,1fr)_180px_auto] gap-2">
            <input
              value={draft.emoji}
              onChange={(event) =>
                setDraft((current) => ({ ...current, emoji: event.target.value.slice(0, 3) }))
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-center text-lg outline-none"
              aria-label="Habit emoji"
            />
            <input
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  (draft.frequency !== 'custom' || draft.repeatDays.length > 0)
                ) {
                  void saveHabit();
                }
              }}
              placeholder="Habit name"
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-400"
            />
            <select
              value={draft.frequency}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  frequency: event.target.value as HabitFrequency,
                  repeatDays:
                    event.target.value === 'custom' ? current.repeatDays : [],
                }))
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none"
            >
              <option value="daily">Every day</option>
              <option value="weekdays">Weekdays</option>
              <option value="custom">Custom days</option>
            </select>
            <button
              type="button"
              onClick={() => void saveHabit()}
              disabled={
                !draft.name.trim() ||
                (draft.frequency === 'custom' && draft.repeatDays.length === 0)
              }
              className="h-10 rounded-xl bg-blue-600 text-white px-4 font-black text-sm disabled:opacity-40"
            >
              {editingHabitId ? 'Update' : 'Save'}
            </button>
          </div>

          {draft.frequency === 'custom' && (
            <div className="mt-3">
              <div className="text-xs font-bold text-slate-500 mb-2">Repeat on</div>
              <div className="flex flex-wrap gap-2">
                {HABIT_WEEKDAYS.map((day) => {
                  const selected = draft.repeatDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleRepeatDay(day.value)}
                      className={`h-9 px-3 rounded-xl border text-xs font-black transition ${
                        selected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>
              {draft.repeatDays.length === 0 && (
                <div className="mt-2 text-[11px] font-semibold text-rose-600">
                  Select at least one repeat day.
                </div>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Color</span>
            {COLORS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setDraft((current) => ({ ...current, color: item }))}
                className={`w-7 h-7 rounded-full ${colorClasses[item].dot} ${
                  draft.color === item ? 'ring-2 ring-offset-2 ring-[#0f172a]' : ''
                }`}
                aria-label={`Use ${item} habit color`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-3 py-3 border-b border-slate-200/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setWeekAnchor(addHabitDays(weekAnchor, -7))}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-black hover:bg-slate-100"
          >
            Previous
          </button>
          <div className="text-sm font-black">
            {parseHabitDateKey(weekDates[0]).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            })}
            {' – '}
            {parseHabitDateKey(weekDates[6]).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekAnchor(today)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-black hover:bg-slate-100"
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => setWeekAnchor(addHabitDays(weekAnchor, 7))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-black hover:bg-slate-100"
            >
              Next
            </button>
          </div>
        </div>

        <div className="overflow-auto lg:max-h-[calc(100vh-225px)]">
          <div className="min-w-[790px]">
            <div className="grid grid-cols-[300px_repeat(7,1fr)_72px] border-b border-slate-200/80 bg-slate-50">
              <div className="p-3 text-[10px] uppercase tracking-wider font-black text-slate-500">
                Habit
              </div>
              {weekDates.map((dateKey) => {
                const date = parseHabitDateKey(dateKey);
                return (
                  <div key={dateKey} className="p-2 text-center">
                    <div className="text-[10px] font-black uppercase text-slate-500">
                      {date.toLocaleDateString('en-US', {
                        weekday: 'short',
                        timeZone: 'UTC',
                      })}
                    </div>
                    <div
                      className={`mt-1 mx-auto w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                        dateKey === today
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-900'
                      }`}
                    >
                      {date.getUTCDate()}
                    </div>
                  </div>
                );
              })}
              <div className="p-3 text-center text-[10px] uppercase tracking-wider font-black text-slate-500">
                Streak
              </div>
            </div>

            {habits.length === 0 ? (
              <div className="py-8 text-center">
                <Repeat2 className="w-8 h-8 mx-auto text-slate-400" />
                <div className="mt-2 text-sm font-black">No habits yet</div>
                <div className="text-xs font-semibold text-slate-500">
                  Add a small repeatable behavior to begin.
                </div>
              </div>
            ) : (
              habits.map((habit) => {
                const stats = getHabitStats(habit, today);
                return (
                  <div
                    key={habit.id}
                    className={`grid grid-cols-[300px_repeat(7,1fr)_72px] border-b last:border-b-0 border-slate-200/80 ${
                      busyId === habit.id ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="p-2.5 flex items-center gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() =>
                            setHistoryHabitId((current) =>
                              current === habit.id ? null : habit.id
                            )
                          }
                          className="block w-full min-w-0 text-left"
                        >
                          <div className="text-sm font-black leading-snug whitespace-normal break-words">{habit.name}</div>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEdit(habit)}
                        className="w-7 h-7 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center"
                        title="Edit habit"
                        aria-label={`Edit ${habit.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setHistoryHabitId((current) =>
                            current === habit.id ? null : habit.id
                          )
                        }
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          historyHabitId === habit.id
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                        }`}
                        title="Completion history"
                        aria-label={`View ${habit.name} history`}
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteHabit(habit.id)}
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center"
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
                        <div
                          key={dateKey}
                          className="flex items-center justify-center border-l border-slate-200/60"
                        >
                          <button
                            type="button"
                            disabled={!due || isFuture}
                            onClick={() => void toggleCheckIn(habit, dateKey)}
                            className={`w-8 h-8 rounded-full border flex items-center justify-center transition ${
                              !due || isFuture
                                ? 'border-transparent bg-slate-50 cursor-not-allowed opacity-50'
                                : checked
                                ? colorClasses[habit.color].active
                                : 'border-slate-300 bg-white hover:border-blue-400'
                            }`}
                            title={
                              isFuture
                                ? 'Future check-ins are locked'
                                : due
                                ? checked
                                  ? 'Remove check-in'
                                  : 'Check in'
                                : 'Not scheduled'
                            }
                            aria-label={`${habit.name} on ${dateKey}`}
                          >
                            {checked && <Check className="w-4 h-4" />}
                          </button>
                        </div>
                      );
                    })}

                    <div className="border-l border-slate-200/60 flex items-center justify-center">
                      <span className="inline-flex items-center gap-1 text-xs font-black">
                        <Flame className="w-3.5 h-3.5 text-orange-500" />
                        {stats.currentStreak}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {historyHabit && historyStats && (
        <section className={`${compact ? 'rounded-xl' : 'rounded-2xl'} border border-slate-200 bg-slate-50 overflow-hidden`}>
          <div className="px-4 py-3 border-b border-slate-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shrink-0 ${
                  colorClasses[historyHabit.color].soft
                }`}
              >
                {historyHabit.emoji}
              </div>
              <div className="min-w-0">
                <div className="text-base font-black truncate">
                  {historyHabit.name} History
                </div>
                <div className="text-[11px] font-semibold text-slate-500">
                  {getHabitScheduleLabel(historyHabit)} • Detailed streak, trend, monthly & heatmap history
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHistoryHabitId(null)}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100"
              aria-label="Close habit history"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className={`${compact ? 'p-3 space-y-3 lg:max-h-[calc(100vh-195px)]' : 'p-4 space-y-4 lg:max-h-[calc(100vh-220px)]'} lg:overflow-y-auto`}>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <Flame className="w-4 h-4 text-orange-500" />
                <div className="mt-2 text-xl font-black">{historyStats.currentStreak}</div>
                <div className="text-[10px] uppercase tracking-wider font-black text-slate-500">
                  Current streak
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <Trophy className="w-4 h-4 text-amber-500" />
                <div className="mt-2 text-xl font-black">{historyStats.bestStreak}</div>
                <div className="text-[10px] uppercase tracking-wider font-black text-slate-500">
                  Best streak
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <div className="mt-2 text-xl font-black">{historyStats.thirty.rate}%</div>
                <div className="text-[10px] uppercase tracking-wider font-black text-slate-500">
                  Last 30 days
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <BarChart3 className="w-4 h-4 text-violet-600" />
                <div className="mt-2 text-xl font-black">{historyStats.ninety.rate}%</div>
                <div className="text-[10px] uppercase tracking-wider font-black text-slate-500">
                  Last 90 days
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <Target className="w-4 h-4 text-emerald-600" />
                <div className="mt-2 text-xl font-black">{historyStats.allTime.rate}%</div>
                <div className="text-[10px] uppercase tracking-wider font-black text-slate-500">
                  All-time rate
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <Check className="w-4 h-4 text-emerald-600" />
                <div className="mt-2 text-xl font-black">{historyStats.totalCheckIns}</div>
                <div className="text-[10px] uppercase tracking-wider font-black text-slate-500">
                  Check-ins
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="text-sm font-black">Completion Trend</div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      Weekly completion rate across the last 12 weeks.
                    </div>
                  </div>
                  <div
                    className={`rounded-lg px-2.5 py-1 text-xs font-black ${
                      trendDelta > 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : trendDelta < 0
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                    title="Recent 4-week average compared with the previous 4 weeks"
                  >
                    {trendDelta > 0 ? '+' : ''}
                    {trendDelta} pp
                  </div>
                </div>

                <div className={`${compact ? 'h-28' : 'h-40'} flex items-end gap-1.5 border-b border-slate-200 px-1`}>
                  {weeklyTrend.map((week) => (
                    <div
                      key={week.key}
                      className="flex-1 min-w-0 h-full flex flex-col justify-end items-center group"
                      title={`${week.label}: ${week.completed}/${week.due} completed (${week.rate}%)`}
                    >
                      <div className={`w-full ${compact ? 'h-[76px]' : 'h-[112px]'} flex items-end justify-center`}>
                        <div
                          className={`w-full max-w-[28px] rounded-t-md transition-all ${
                            week.due === 0
                              ? 'bg-slate-200'
                              : week.rate >= 80
                              ? 'bg-emerald-500'
                              : week.rate >= 50
                              ? 'bg-blue-500'
                              : 'bg-amber-400'
                          }`}
                          style={{
                            height: week.due === 0 ? '4px' : `${Math.max(6, week.rate)}%`,
                          }}
                        />
                      </div>
                      <div className="mt-1 text-[9px] font-black text-slate-500 truncate w-full text-center">
                        {week.label}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-bold text-slate-500">
                  <span>80–100% strong</span>
                  <span>50–79% moderate</span>
                  <span>&lt;50% needs attention</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                <div className="mb-3">
                  <div className="text-sm font-black">Monthly Summary</div>
                  <div className="text-[11px] font-semibold text-slate-500">
                    Completion by calendar month.
                  </div>
                </div>

                <div className="space-y-2">
                  {monthlySummaries.map((month) => (
                    <div
                      key={month.key}
                      className="rounded-lg bg-slate-50 px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-black">{month.label}</div>
                          <div className="text-[10px] font-semibold text-slate-500">
                            {month.completed}/{month.due} done • {month.missed} missed
                          </div>
                        </div>
                        <div className="text-sm font-black">{month.rate}%</div>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            month.rate >= 80
                              ? 'bg-emerald-500'
                              : month.rate >= 50
                              ? 'bg-blue-500'
                              : 'bg-amber-400'
                          }`}
                          style={{ width: `${month.rate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <div className="text-sm font-black">Calendar Heatmap</div>
                  <div className="text-[11px] font-semibold text-slate-500">
                    Past 12 months • one square per calendar day.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <span className={`w-3 h-3 rounded-sm ${colorClasses[historyHabit.color].dot}`} />
                    Done
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-rose-100 border border-rose-200" />
                    Missed
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200" />
                    Not scheduled
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-1 mb-1 pl-8 min-w-[760px] text-[9px] font-black text-slate-500">
                {Array.from({ length: 12 }, (_, index) => {
                  const date = parseHabitDateKey(
                    addHabitDays(today, -Math.round(((11 - index) * 365) / 12))
                  );
                  return (
                    <span key={index} className="text-left">
                      {date.toLocaleDateString('en-US', {
                        month: 'short',
                        timeZone: 'UTC',
                      })}
                    </span>
                  );
                })}
              </div>

              <div className="overflow-x-auto pb-1">
                <div className="flex gap-1 min-w-max">
                  <div className="grid grid-rows-7 gap-1 pr-1 text-[9px] font-bold text-slate-500">
                    {['Sun', '', 'Tue', '', 'Thu', '', 'Sat'].map((label, index) => (
                      <div key={index} className="w-7 h-[14px] leading-[14px]">
                        {label}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-flow-col grid-rows-7 auto-cols-[14px] gap-1">
                    {heatmapDates.map((dateKey) => {
                      const isFuture = dateKey > today;
                      const due = !isFuture && isHabitDue(historyHabit, dateKey);
                      const checked =
                        !isFuture && historyHabit.checkIns.includes(dateKey);
                      const date = parseHabitDateKey(dateKey);
                      const status = isFuture
                        ? 'Future'
                        : !due
                        ? 'Not scheduled'
                        : checked
                        ? 'Completed'
                        : 'Missed';

                      return (
                        <div
                          key={dateKey}
                          title={`${date.toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            timeZone: 'UTC',
                          })}: ${status}`}
                          className={`w-[14px] h-[14px] rounded-[3px] border ${
                            isFuture
                              ? 'bg-transparent border-transparent'
                              : !due
                              ? 'bg-slate-100 border-slate-200'
                              : checked
                              ? `${colorClasses[historyHabit.color].dot} border-transparent`
                              : 'bg-rose-100 border-rose-200'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <div className="text-sm font-black">Completion History</div>
                  <div className="text-[11px] font-semibold text-slate-500">
                    {historyStats.allTime.completed} of {historyStats.allTime.due} scheduled check-ins completed.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <span className={`w-3 h-3 rounded-sm ${colorClasses[historyHabit.color].dot}`} />
                    Done
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-rose-100 border border-rose-200" />
                    Missed
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200" />
                    Not scheduled
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto pb-1">
                <div className="grid grid-flow-col grid-rows-7 auto-cols-[18px] gap-1 min-w-max">
                  {historyDates.map((dateKey) => {
                    const due = isHabitDue(historyHabit, dateKey);
                    const checked = historyHabit.checkIns.includes(dateKey);
                    const date = parseHabitDateKey(dateKey);
                    const status = !due ? 'Not scheduled' : checked ? 'Completed' : 'Missed';
                    return (
                      <div
                        key={dateKey}
                        title={`${date.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          timeZone: 'UTC',
                        })}: ${status}`}
                        className={`w-[18px] h-[18px] rounded-[4px] border ${
                          !due
                            ? 'bg-slate-100 border-slate-200'
                            : checked
                            ? `${colorClasses[historyHabit.color].dot} border-transparent`
                            : 'bg-rose-100 border-rose-200'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-black">30d:</span>{' '}
                  {historyStats.thirty.completed}/{historyStats.thirty.due} completed
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-black">90d:</span>{' '}
                  {historyStats.ninety.completed}/{historyStats.ninety.due} completed
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-black">All time:</span>{' '}
                  {historyStats.allTime.completed}/{historyStats.allTime.due} completed
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
