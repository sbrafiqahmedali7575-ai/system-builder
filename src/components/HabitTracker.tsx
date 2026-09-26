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
import { HabitFrequency, HabitItem } from '../types';
import { CONFIGURED_TIMEZONE, getIsoDateKeyInTimezone } from '../utils/taskDateUtils';
import {
  HABIT_WEEKDAYS,
  addHabitDays,
  getHabitScheduleLabel,
  getHabitStats,
  isHabitDue,
  parseHabitDateKey,
} from '../utils/habitUtils';

interface HabitTrackerProps {
  habits: HabitItem[];
  onAddHabit: (habit: Omit<HabitItem, 'id'>) => Promise<void>;
  onUpdateHabit: (habit: HabitItem) => Promise<void>;
  onDeleteHabit: (habitId: string) => Promise<void>;
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
}) => {
  const today = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [formOpen, setFormOpen] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [draft, setDraft] = useState<HabitDraft>(EMPTY_DRAFT);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [historyHabitId, setHistoryHabitId] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] font-black text-blue-600">
            Consistency workspace
          </p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight">
            Habit Tracker
          </h2>
          <p className="mt-1 text-sm font-semibold text-[#766653]">
            Custom schedules, weekly check-ins, streaks, and completion history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-[#dfd1b6] bg-[#fffaf0] px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-wider font-black text-[#8b7a66]">
              This week
            </div>
            <div className="text-sm font-black text-[#3f3426]">
              {completedThisWeek}/{dueThisWeek || 0}
            </div>
          </div>
          <button
            type="button"
            onClick={formOpen && !editingHabitId ? closeForm : openAdd}
            className="h-10 px-3 rounded-xl bg-blue-600 text-white font-black text-sm inline-flex items-center gap-2"
          >
            {formOpen && !editingHabitId ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {formOpen && !editingHabitId ? 'Cancel' : 'Add Habit'}
          </button>
        </div>
      </div>

      {formOpen && (
        <div className="rounded-2xl border border-[#dfd1b6] bg-[#fff8e8] p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-black">
                {editingHabitId ? 'Edit Habit' : 'New Habit'}
              </div>
              <div className="text-[11px] font-semibold text-[#8b7a66]">
                Name, appearance, and repeat schedule.
              </div>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="w-8 h-8 rounded-lg border border-[#dfd1b6] flex items-center justify-center hover:bg-black/5"
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
              className="h-10 rounded-xl border border-[#dfd1b6] bg-white/80 px-3 text-center text-lg outline-none"
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
              className="h-10 rounded-xl border border-[#dfd1b6] bg-white/80 px-3 text-sm font-semibold outline-none focus:border-blue-400"
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
              className="h-10 rounded-xl border border-[#dfd1b6] bg-white/80 px-3 text-sm font-bold outline-none"
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
              <div className="text-xs font-bold text-[#8b7a66] mb-2">Repeat on</div>
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
                          : 'bg-white/80 border-[#dfd1b6] hover:border-blue-300'
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
            <span className="text-xs font-bold text-[#8b7a66]">Color</span>
            {COLORS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setDraft((current) => ({ ...current, color: item }))}
                className={`w-7 h-7 rounded-full ${colorClasses[item].dot} ${
                  draft.color === item ? 'ring-2 ring-offset-2 ring-[#3f3426]' : ''
                }`}
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
            onClick={() => setWeekAnchor(addHabitDays(weekAnchor, -7))}
            className="px-3 py-1.5 rounded-lg border border-[#dfd1b6] text-xs font-black hover:bg-black/5"
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
              className="px-3 py-1.5 rounded-lg border border-[#dfd1b6] text-xs font-black hover:bg-black/5"
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => setWeekAnchor(addHabitDays(weekAnchor, 7))}
              className="px-3 py-1.5 rounded-lg border border-[#dfd1b6] text-xs font-black hover:bg-black/5"
            >
              Next
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[850px]">
            <div className="grid grid-cols-[280px_repeat(7,1fr)_90px_90px] border-b border-black/8 bg-[#fbf4e3]">
              <div className="p-3 text-[10px] uppercase tracking-wider font-black text-[#8b7a66]">
                Habit
              </div>
              {weekDates.map((dateKey) => {
                const date = parseHabitDateKey(dateKey);
                return (
                  <div key={dateKey} className="p-2 text-center">
                    <div className="text-[10px] font-black uppercase text-[#8b7a66]">
                      {date.toLocaleDateString('en-US', {
                        weekday: 'short',
                        timeZone: 'UTC',
                      })}
                    </div>
                    <div
                      className={`mt-1 mx-auto w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                        dateKey === today
                          ? 'bg-blue-600 text-white'
                          : 'text-[#3f3426]'
                      }`}
                    >
                      {date.getUTCDate()}
                    </div>
                  </div>
                );
              })}
              <div className="p-3 text-center text-[10px] uppercase tracking-wider font-black text-[#8b7a66]">
                Streak
              </div>
              <div className="p-3 text-center text-[10px] uppercase tracking-wider font-black text-[#8b7a66]">
                30 Day
              </div>
            </div>

            {habits.length === 0 ? (
              <div className="py-14 text-center">
                <Repeat2 className="w-8 h-8 mx-auto text-[#b7a58d]" />
                <div className="mt-2 text-sm font-black">No habits yet</div>
                <div className="text-xs font-semibold text-[#8b7a66]">
                  Add a small repeatable behavior to begin.
                </div>
              </div>
            ) : (
              habits.map((habit) => {
                const stats = getHabitStats(habit, today);
                return (
                  <div
                    key={habit.id}
                    className={`grid grid-cols-[280px_repeat(7,1fr)_90px_90px] border-b last:border-b-0 border-black/8 ${
                      busyId === habit.id ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="p-3 flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() =>
                          setHistoryHabitId((current) =>
                            current === habit.id ? null : habit.id
                          )
                        }
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center text-lg shrink-0 ${
                          colorClasses[habit.color].soft
                        }`}
                        title="Open habit history"
                      >
                        {habit.emoji}
                      </button>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() =>
                            setHistoryHabitId((current) =>
                              current === habit.id ? null : habit.id
                            )
                          }
                          className="block text-left max-w-full"
                        >
                          <div className="text-sm font-black truncate">{habit.name}</div>
                          <div className="text-[10px] font-bold text-[#8b7a66] truncate">
                            {getHabitScheduleLabel(habit)}
                          </div>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEdit(habit)}
                        className="w-7 h-7 rounded-lg text-[#8b7a66] hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center"
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
                            : 'text-[#8b7a66] hover:text-blue-600 hover:bg-blue-50'
                        }`}
                        title="Completion history"
                        aria-label={`View ${habit.name} history`}
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteHabit(habit.id)}
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
                        <div
                          key={dateKey}
                          className="flex items-center justify-center border-l border-black/5"
                        >
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

                    <div className="border-l border-black/5 flex items-center justify-center">
                      <span className="inline-flex items-center gap-1 text-xs font-black">
                        <Flame className="w-3.5 h-3.5 text-orange-500" />
                        {stats.currentStreak}
                      </span>
                    </div>
                    <div className="border-l border-black/5 flex items-center justify-center">
                      <span className="inline-flex items-center gap-1 text-xs font-black">
                        <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                        {stats.thirty.rate}%
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
        <section className="rounded-2xl border border-[#ded0b4] bg-[#fff8e8] overflow-hidden">
          <div className="px-4 py-3 border-b border-black/8 flex items-center justify-between gap-3">
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
                <div className="text-[11px] font-semibold text-[#8b7a66]">
                  {getHabitScheduleLabel(historyHabit)} • Last 84 days shown
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHistoryHabitId(null)}
              className="w-8 h-8 rounded-lg border border-[#dfd1b6] flex items-center justify-center hover:bg-black/5"
              aria-label="Close habit history"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
              <div className="rounded-xl border border-[#e7dbc4] bg-white/80 p-3">
                <Flame className="w-4 h-4 text-orange-500" />
                <div className="mt-2 text-xl font-black">{historyStats.currentStreak}</div>
                <div className="text-[10px] uppercase tracking-wider font-black text-[#8b7a66]">
                  Current streak
                </div>
              </div>
              <div className="rounded-xl border border-[#e7dbc4] bg-white/80 p-3">
                <Trophy className="w-4 h-4 text-amber-500" />
                <div className="mt-2 text-xl font-black">{historyStats.bestStreak}</div>
                <div className="text-[10px] uppercase tracking-wider font-black text-[#8b7a66]">
                  Best streak
                </div>
              </div>
              <div className="rounded-xl border border-[#e7dbc4] bg-white/80 p-3">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <div className="mt-2 text-xl font-black">{historyStats.thirty.rate}%</div>
                <div className="text-[10px] uppercase tracking-wider font-black text-[#8b7a66]">
                  Last 30 days
                </div>
              </div>
              <div className="rounded-xl border border-[#e7dbc4] bg-white/80 p-3">
                <BarChart3 className="w-4 h-4 text-violet-600" />
                <div className="mt-2 text-xl font-black">{historyStats.ninety.rate}%</div>
                <div className="text-[10px] uppercase tracking-wider font-black text-[#8b7a66]">
                  Last 90 days
                </div>
              </div>
              <div className="rounded-xl border border-[#e7dbc4] bg-white/80 p-3">
                <Target className="w-4 h-4 text-emerald-600" />
                <div className="mt-2 text-xl font-black">{historyStats.allTime.rate}%</div>
                <div className="text-[10px] uppercase tracking-wider font-black text-[#8b7a66]">
                  All-time rate
                </div>
              </div>
              <div className="rounded-xl border border-[#e7dbc4] bg-white/80 p-3">
                <Check className="w-4 h-4 text-emerald-600" />
                <div className="mt-2 text-xl font-black">{historyStats.totalCheckIns}</div>
                <div className="text-[10px] uppercase tracking-wider font-black text-[#8b7a66]">
                  Check-ins
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#e7dbc4] bg-white/70 p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <div className="text-sm font-black">Completion History</div>
                  <div className="text-[11px] font-semibold text-[#8b7a66]">
                    {historyStats.allTime.completed} of {historyStats.allTime.due} scheduled check-ins completed.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-[#8b7a66]">
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
                <div className="rounded-lg bg-[#fbf4e3] px-3 py-2">
                  <span className="font-black">30d:</span>{' '}
                  {historyStats.thirty.completed}/{historyStats.thirty.due} completed
                </div>
                <div className="rounded-lg bg-[#fbf4e3] px-3 py-2">
                  <span className="font-black">90d:</span>{' '}
                  {historyStats.ninety.completed}/{historyStats.ninety.due} completed
                </div>
                <div className="rounded-lg bg-[#fbf4e3] px-3 py-2">
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
