import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
} from 'lucide-react';
import { HabitItem, TaskItem } from '../types';
import { CONFIGURED_TIMEZONE, getIsoDateKeyInTimezone } from '../utils/taskDateUtils';
import { isHabitDue } from '../utils/habitUtils';

interface CalendarWorkspaceProps {
  tasks: TaskItem[];
  habits: HabitItem[];
  onAddTask: (task: Omit<TaskItem, 'id'>) => Promise<void>;
  onToggleTaskStatus: (taskId: string) => Promise<void>;
  onUpdateHabit: (habit: HabitItem) => Promise<void>;
}

type CalendarView = 'month' | 'agenda';

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

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const CalendarWorkspace: React.FC<CalendarWorkspaceProps> = ({
  tasks,
  habits,
  onAddTask,
  onToggleTaskStatus,
  onUpdateHabit,
}) => {
  const today = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
  const todayDate = parseKey(today);
  const [cursor, setCursor] = useState(
    new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), 1))
  );
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState<CalendarView>('month');
  const [showCompleted, setShowCompleted] = useState(true);
  const [showHabits, setShowHabits] = useState(true);
  const [draft, setDraft] = useState('');

  const calendarDays = useMemo(() => {
    const first = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
    first.setUTCDate(first.getUTCDate() - first.getUTCDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(first);
      date.setUTCDate(first.getUTCDate() + index);
      return keyFromDate(date);
    });
  }, [cursor]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    tasks.forEach((task) => {
      if (!showCompleted && task.isCompleted) return;
      const list = map.get(task.taskKey) || [];
      list.push(task);
      map.set(task.taskKey, list);
    });
    for (const list of map.values()) {
      list.sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted));
    }
    return map;
  }, [tasks, showCompleted]);

  const selectedTasks = tasksByDate.get(selectedDate) || [];
  const selectedHabits = habits.filter((habit) => showHabits && isHabitDue(habit, selectedDate));
  const currentMonth = monthKey(cursor);

  const agendaDays = useMemo(() => {
    const firstOfMonth = keyFromDate(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1)));
    const last = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const days = last.getUTCDate();
    return Array.from({ length: days }, (_, index) => addDays(firstOfMonth, index));
  }, [cursor]);

  const changeMonth = (offset: number) => {
    setCursor((current) => {
      const next = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1));
      setSelectedDate(keyFromDate(next));
      return next;
    });
  };

  const jumpToday = () => {
    setCursor(new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), 1)));
    setSelectedDate(today);
  };

  const addTask = async () => {
    const title = draft.trim();
    if (!title) return;
    await onAddTask({
      taskKey: selectedDate,
      taskOfTheDay: title,
      isCompleted: false,
      priority: 'Normal',
      category: 'Calendar',
    });
    setDraft('');
  };

  const toggleHabit = async (habit: HabitItem, dateKey: string) => {
    if (!isHabitDue(habit, dateKey) || dateKey > today) return;
    const exists = habit.checkIns.includes(dateKey);
    const checkIns = exists
      ? habit.checkIns.filter((key) => key !== dateKey)
      : [...habit.checkIns, dateKey].sort();
    await onUpdateHabit({ ...habit, checkIns, updatedAt: new Date().toISOString() });
  };

  const renderDayAgenda = (dateKey: string, compact = false) => {
    const dayTasks = tasksByDate.get(dateKey) || [];
    const dueHabits = habits.filter((habit) => showHabits && isHabitDue(habit, dateKey));
    if (dayTasks.length === 0 && dueHabits.length === 0) return null;
    const date = parseKey(dateKey);

    return (
      <div key={dateKey} className="rounded-2xl border border-[#dfd1b6] bg-[#fffaf0] overflow-hidden">
        <button
          type="button"
          onClick={() => setSelectedDate(dateKey)}
          className="w-full px-4 py-3 text-left border-b border-black/8 flex items-center justify-between hover:bg-black/[0.025]"
        >
          <div>
            <div className="text-sm font-black">
              {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}
            </div>
            <div className="text-[10px] uppercase tracking-wider font-black text-[#8b7a66]">
              {dateKey === today ? 'Today' : dateKey}
            </div>
          </div>
          <span className="text-xs font-black text-[#8b7a66]">{dayTasks.length + dueHabits.length}</span>
        </button>

        <div className={compact ? 'p-2 space-y-1.5' : 'p-3 space-y-2'}>
          {dayTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => void onToggleTaskStatus(task.id)}
              className="w-full flex items-center gap-2 rounded-xl border border-[#e7dbc4] bg-white/80 px-3 py-2 text-left"
            >
              <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                task.isCompleted ? 'bg-blue-600 border-blue-600 text-white' : 'border-[#b9aa91]'
              }`}>
                {task.isCompleted && <Check className="w-3 h-3" />}
              </span>
              <span className={`text-sm font-bold min-w-0 truncate ${task.isCompleted ? 'line-through text-[#9e8f7b]' : ''}`}>
                {task.taskOfTheDay}
              </span>
            </button>
          ))}

          {dueHabits.map((habit) => {
            const checked = habit.checkIns.includes(dateKey);
            return (
              <button
                key={habit.id}
                type="button"
                disabled={dateKey > today}
                onClick={() => void toggleHabit(habit, dateKey)}
                className="w-full flex items-center gap-2 rounded-xl border border-[#e7dbc4] bg-[#fbf4e3] px-3 py-2 text-left disabled:opacity-55 disabled:cursor-not-allowed"
              >
                <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                  checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-[#b9aa91]'
                }`}>
                  {checked && <Check className="w-3 h-3" />}
                </span>
                <span className="text-sm font-bold min-w-0 truncate">
                  {habit.emoji} {habit.name}
                </span>
                <span className="ml-auto text-[9px] uppercase tracking-wider font-black text-[#8b7a66]">Habit</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] font-black text-blue-600">Schedule workspace</p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight">Calendar</h2>
          <p className="mt-1 text-sm font-semibold text-[#766653]">
            Tasks and habits in one timeline, with month and agenda views.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-xl border border-[#dfd1b6] bg-[#fffaf0] px-3 h-9 text-xs font-black">
            <input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} />
            Completed
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border border-[#dfd1b6] bg-[#fffaf0] px-3 h-9 text-xs font-black">
            <input type="checkbox" checked={showHabits} onChange={(event) => setShowHabits(event.target.checked)} />
            Habits
          </label>
          <div className="inline-flex rounded-xl border border-[#dfd1b6] bg-[#fffaf0] p-1">
            <button
              type="button"
              onClick={() => setView('month')}
              className={`h-7 px-2.5 rounded-lg text-xs font-black inline-flex items-center gap-1 ${
                view === 'month' ? 'bg-blue-600 text-white' : 'hover:bg-black/5'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Month
            </button>
            <button
              type="button"
              onClick={() => setView('agenda')}
              className={`h-7 px-2.5 rounded-lg text-xs font-black inline-flex items-center gap-1 ${
                view === 'agenda' ? 'bg-blue-600 text-white' : 'hover:bg-black/5'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Agenda
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#ded0b4] bg-[#fffaf0] overflow-hidden">
        <div className="px-3 sm:px-4 py-3 border-b border-black/8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => changeMonth(-1)} className="w-8 h-8 rounded-lg border border-[#dfd1b6] flex items-center justify-center hover:bg-black/5">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={jumpToday} className="h-8 px-3 rounded-lg border border-[#dfd1b6] text-xs font-black hover:bg-black/5">
              Today
            </button>
            <button type="button" onClick={() => changeMonth(1)} className="w-8 h-8 rounded-lg border border-[#dfd1b6] flex items-center justify-center hover:bg-black/5">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="text-lg sm:text-xl font-black">
            {cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
          </div>
        </div>

        {view === 'month' ? (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-7 border-b border-black/8 bg-[#fbf4e3]">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="px-2 py-2 text-center text-[10px] uppercase tracking-wider font-black text-[#8b7a66]">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {calendarDays.map((dateKey) => {
                    const date = parseKey(dateKey);
                    const inMonth = monthKey(date) === currentMonth;
                    const dayTasks = tasksByDate.get(dateKey) || [];
                    const dueHabits = habits.filter((habit) => showHabits && isHabitDue(habit, dateKey));
                    return (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() => setSelectedDate(dateKey)}
                        className={`min-h-[118px] p-1.5 border-r border-b border-black/8 text-left align-top transition ${
                          selectedDate === dateKey ? 'bg-blue-50/80 ring-1 ring-inset ring-blue-300' : 'hover:bg-black/[0.025]'
                        } ${inMonth ? '' : 'opacity-45'}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                            dateKey === today ? 'bg-blue-600 text-white' : ''
                          }`}>
                            {date.getUTCDate()}
                          </span>
                          {dueHabits.length > 0 && (
                            <span className="text-[9px] font-black text-emerald-700">{dueHabits.length}H</span>
                          )}
                        </div>

                        <div className="space-y-1">
                          {dayTasks.slice(0, 3).map((task) => (
                            <div
                              key={task.id}
                              className={`truncate rounded px-1.5 py-1 text-[10px] font-bold ${
                                task.isCompleted ? 'bg-slate-200 text-slate-500 line-through' : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {task.taskOfTheDay}
                            </div>
                          ))}
                          {dayTasks.length > 3 && (
                            <div className="text-[9px] font-black text-[#8b7a66]">+{dayTasks.length - 3} more</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <aside className="border-t xl:border-t-0 xl:border-l border-black/8 bg-[#fbf4e3]/60 p-3">
              <div className="mb-3">
                <div className="text-[10px] uppercase tracking-wider font-black text-[#8b7a66]">Selected day</div>
                <div className="text-base font-black">
                  {parseKey(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
                </div>
              </div>

              <div className="flex gap-2 mb-3">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void addTask();
                  }}
                  placeholder="Add task..."
                  className="min-w-0 flex-1 h-9 rounded-xl border border-[#dfd1b6] bg-white/90 px-3 text-sm font-semibold outline-none focus:border-blue-400"
                />
                <button
                  type="button"
                  onClick={() => void addTask()}
                  disabled={!draft.trim()}
                  className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center disabled:opacity-40"
                  aria-label="Add task to selected day"
                  title="Add task"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {selectedTasks.length === 0 && selectedHabits.length === 0 ? (
                <div className="py-10 text-center text-sm font-semibold text-[#9d8b73]">Nothing scheduled</div>
              ) : (
                <div className="space-y-2">
                  {selectedTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => void onToggleTaskStatus(task.id)}
                      className="w-full flex items-center gap-2 rounded-xl border border-[#e7dbc4] bg-white/85 px-3 py-2 text-left"
                    >
                      <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        task.isCompleted ? 'bg-blue-600 border-blue-600 text-white' : 'border-[#b9aa91]'
                      }`}>
                        {task.isCompleted && <Check className="w-3 h-3" />}
                      </span>
                      <span className={`text-sm font-bold truncate ${task.isCompleted ? 'line-through text-[#9e8f7b]' : ''}`}>
                        {task.taskOfTheDay}
                      </span>
                    </button>
                  ))}

                  {selectedHabits.map((habit) => {
                    const checked = habit.checkIns.includes(selectedDate);
                    return (
                      <button
                        key={habit.id}
                        type="button"
                        disabled={selectedDate > today}
                        onClick={() => void toggleHabit(habit, selectedDate)}
                        className="w-full flex items-center gap-2 rounded-xl border border-[#e7dbc4] bg-[#fff8e8] px-3 py-2 text-left disabled:opacity-55 disabled:cursor-not-allowed"
                      >
                        <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-[#b9aa91]'
                        }`}>
                          {checked && <Check className="w-3 h-3" />}
                        </span>
                        <span className="text-sm font-bold truncate">{habit.emoji} {habit.name}</span>
                        <span className="ml-auto text-[9px] uppercase tracking-wider font-black text-[#8b7a66]">Habit</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>
          </div>
        ) : (
          <div className="p-3 sm:p-4 space-y-3">
            {agendaDays.map((dateKey) => renderDayAgenda(dateKey)).filter(Boolean)}
            {agendaDays.every((dateKey) => {
              const hasTasks = (tasksByDate.get(dateKey) || []).length > 0;
              const hasHabits = habits.some((habit) => showHabits && isHabitDue(habit, dateKey));
              return !hasTasks && !hasHabits;
            }) && (
              <div className="py-16 text-center text-sm font-semibold text-[#9d8b73]">
                Nothing scheduled this month.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
