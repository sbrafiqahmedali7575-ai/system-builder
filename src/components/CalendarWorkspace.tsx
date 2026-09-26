import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  List,
  Plus,
  Repeat2,
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

function longDate(dateKey: string): string {
  return parseKey(dateKey).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function shortDate(dateKey: string): string {
  return parseKey(dateKey).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
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
  const [isAdding, setIsAdding] = useState(false);

  const currentMonth = monthKey(cursor);

  const calendarDays = useMemo(() => {
    const first = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1)
    );
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
      list.sort(
        (a, b) =>
          Number(a.isCompleted) - Number(b.isCompleted) ||
          (a.priority === 'High' ? -1 : a.priority === 'Medium' ? 0 : 1) -
            (b.priority === 'High' ? -1 : b.priority === 'Medium' ? 0 : 1)
      );
    }

    return map;
  }, [tasks, showCompleted]);

  const habitsForDate = (dateKey: string) =>
    showHabits
      ? habits.filter((habit) => isHabitDue(habit, dateKey))
      : [];

  const selectedTasks = tasksByDate.get(selectedDate) || [];
  const selectedHabits = habitsForDate(selectedDate);
  const selectedDoneTasks = selectedTasks.filter((task) => task.isCompleted).length;
  const selectedDoneHabits = selectedHabits.filter((habit) =>
    habit.checkIns.includes(selectedDate)
  ).length;

  const agendaDays = useMemo(() => {
    const firstOfMonth = keyFromDate(
      new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1))
    );
    const last = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)
    );

    return Array.from({ length: last.getUTCDate() }, (_, index) =>
      addDays(firstOfMonth, index)
    );
  }, [cursor]);

  const agendaDaysWithItems = useMemo(
    () =>
      agendaDays.filter((dateKey) => {
        const hasTasks = (tasksByDate.get(dateKey) || []).length > 0;
        const hasHabits =
          showHabits && habits.some((habit) => isHabitDue(habit, dateKey));
        return hasTasks || hasHabits;
      }),
    [agendaDays, tasksByDate, habits, showHabits]
  );

  const selectDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    const date = parseKey(dateKey);

    if (monthKey(date) !== currentMonth) {
      setCursor(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
    }
  };

  const changeSelectedDay = (offset: number) => {
    selectDate(addDays(selectedDate, offset));
  };

  const changeMonth = (offset: number) => {
    setCursor((current) => {
      const selected = parseKey(selectedDate);
      const targetYear = new Date(
        Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1)
      ).getUTCFullYear();
      const targetMonth = new Date(
        Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1)
      ).getUTCMonth();
      const daysInTarget = new Date(
        Date.UTC(targetYear, targetMonth + 1, 0)
      ).getUTCDate();
      const targetDay = Math.min(selected.getUTCDate(), daysInTarget);
      const nextSelected = new Date(
        Date.UTC(targetYear, targetMonth, targetDay)
      );

      setSelectedDate(keyFromDate(nextSelected));
      return new Date(Date.UTC(targetYear, targetMonth, 1));
    });
  };

  const jumpToday = () => {
    setCursor(
      new Date(
        Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), 1)
      )
    );
    setSelectedDate(today);
  };

  const addTask = async () => {
    const title = draft.trim();
    if (!title || isAdding) return;

    try {
      setIsAdding(true);
      await onAddTask({
        taskKey: selectedDate,
        taskOfTheDay: title,
        isCompleted: false,
        priority: 'Normal',
        category: 'Calendar',
      });
      setDraft('');
    } finally {
      setIsAdding(false);
    }
  };

  const toggleHabit = async (habit: HabitItem, dateKey: string) => {
    if (!isHabitDue(habit, dateKey) || dateKey > today) return;

    const exists = habit.checkIns.includes(dateKey);
    const checkIns = exists
      ? habit.checkIns.filter((key) => key !== dateKey)
      : [...habit.checkIns, dateKey].sort();

    await onUpdateHabit({
      ...habit,
      checkIns,
      updatedAt: new Date().toISOString(),
    });
  };

  const renderSelectedDayPanel = (compact = false) => (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] font-black text-blue-700">
              Selected day
            </div>
            <div className="mt-1 text-base sm:text-lg font-black text-[#3f3426] truncate">
              {longDate(selectedDate)}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-[#766653]">
              <span>
                {selectedTasks.length} task{selectedTasks.length === 1 ? '' : 's'}
              </span>
              {showHabits && (
                <span>
                  {selectedHabits.length} habit{selectedHabits.length === 1 ? '' : 's'}
                </span>
              )}
              {selectedDate === today && (
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-white">
                  Today
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => changeSelectedDay(-1)}
              className="w-8 h-8 rounded-lg border border-blue-200 bg-white/80 flex items-center justify-center hover:bg-white"
              title="Previous day"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => changeSelectedDay(1)}
              className="w-8 h-8 rounded-lg border border-blue-200 bg-white/80 flex items-center justify-center hover:bg-white"
              title="Next day"
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {(selectedTasks.length > 0 || selectedHabits.length > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/80 bg-white/70 px-3 py-2">
              <div className="text-lg font-black">
                {selectedDoneTasks}/{selectedTasks.length}
              </div>
              <div className="text-[9px] uppercase tracking-wider font-black text-[#8b7a66]">
                Tasks done
              </div>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/70 px-3 py-2">
              <div className="text-lg font-black">
                {selectedDoneHabits}/{selectedHabits.length}
              </div>
              <div className="text-[9px] uppercase tracking-wider font-black text-[#8b7a66]">
                Habits done
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void addTask();
          }}
          placeholder={`Add task for ${shortDate(selectedDate)}...`}
          className="min-w-0 flex-1 h-10 rounded-xl border border-[#dfd1b6] bg-white/90 px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="button"
          onClick={() => void addTask()}
          disabled={!draft.trim() || isAdding}
          className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center disabled:opacity-40"
          aria-label="Add task to selected day"
          title="Add task"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {selectedTasks.length === 0 && selectedHabits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#dfd1b6] bg-white/45 py-8 text-center">
          <CalendarDays className="w-6 h-6 mx-auto text-[#b7a58d]" />
          <div className="mt-2 text-sm font-black text-[#766653]">
            Nothing scheduled
          </div>
          <div className="text-[11px] font-semibold text-[#9d8b73]">
            Add a task or choose another date.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {selectedTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => void onToggleTaskStatus(task.id)}
              className="w-full flex items-center gap-2 rounded-xl border border-[#e7dbc4] bg-white/85 px-3 py-2.5 text-left hover:border-blue-200 hover:bg-white transition"
            >
              <span
                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                  task.isCompleted
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-[#b9aa91]'
                }`}
              >
                {task.isCompleted && <Check className="w-3 h-3" />}
              </span>
              <span
                className={`text-sm font-bold min-w-0 flex-1 truncate ${
                  task.isCompleted ? 'line-through text-[#9e8f7b]' : ''
                }`}
              >
                {task.taskOfTheDay}
              </span>
              <span className="text-[9px] uppercase tracking-wider font-black text-blue-700 bg-blue-50 rounded-full px-2 py-1">
                Task
              </span>
            </button>
          ))}

          {selectedHabits.map((habit) => {
            const checked = habit.checkIns.includes(selectedDate);
            const future = selectedDate > today;

            return (
              <button
                key={habit.id}
                type="button"
                disabled={future}
                onClick={() => void toggleHabit(habit, selectedDate)}
                className="w-full flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5 text-left hover:bg-emerald-50 transition disabled:opacity-55 disabled:cursor-not-allowed"
              >
                <span
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    checked
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-emerald-300 bg-white'
                  }`}
                >
                  {checked && <Check className="w-3 h-3" />}
                </span>
                <span className="text-sm font-bold min-w-0 flex-1 truncate">
                  {habit.emoji} {habit.name}
                </span>
                <span className="text-[9px] uppercase tracking-wider font-black text-emerald-700 bg-white/80 rounded-full px-2 py-1">
                  Habit
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderAgendaDay = (dateKey: string) => {
    const dayTasks = tasksByDate.get(dateKey) || [];
    const dueHabits = habitsForDate(dateKey);
    const date = parseKey(dateKey);
    const isSelected = selectedDate === dateKey;
    const isToday = dateKey === today;
    const completedTasks = dayTasks.filter((task) => task.isCompleted).length;
    const completedHabits = dueHabits.filter((habit) =>
      habit.checkIns.includes(dateKey)
    ).length;

    return (
      <section
        key={dateKey}
        className={`rounded-2xl border overflow-hidden transition ${
          isSelected
            ? 'border-blue-300 bg-blue-50/35 shadow-sm ring-1 ring-blue-200'
            : 'border-[#dfd1b6] bg-[#fffaf0]'
        }`}
      >
        <button
          type="button"
          onClick={() => selectDate(dateKey)}
          className="w-full px-3 sm:px-4 py-3 text-left border-b border-black/8 flex items-center gap-3 hover:bg-black/[0.025]"
        >
          <div
            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border ${
              isToday
                ? 'bg-blue-600 border-blue-600 text-white'
                : isSelected
                ? 'bg-blue-100 border-blue-200 text-blue-700'
                : 'bg-[#fbf4e3] border-[#dfd1b6] text-[#3f3426]'
            }`}
          >
            <span className="text-[9px] uppercase font-black leading-none">
              {date.toLocaleDateString('en-US', {
                weekday: 'short',
                timeZone: 'UTC',
              })}
            </span>
            <span className="mt-1 text-lg font-black leading-none">
              {date.getUTCDate()}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-black">
                {date.toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'UTC',
                })}
              </div>
              {isToday && (
                <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[9px] uppercase font-black">
                  Today
                </span>
              )}
              {isSelected && !isToday && (
                <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[9px] uppercase font-black">
                  Selected
                </span>
              )}
            </div>
            <div className="mt-1 text-[10px] font-bold text-[#8b7a66]">
              {completedTasks}/{dayTasks.length} tasks done
              {showHabits
                ? ` • ${completedHabits}/${dueHabits.length} habits done`
                : ''}
            </div>
          </div>

          <span className="min-w-8 h-8 px-2 rounded-lg bg-black/[0.04] flex items-center justify-center text-xs font-black text-[#766653]">
            {dayTasks.length + dueHabits.length}
          </span>
        </button>

        <div className="p-2 sm:p-3 space-y-1.5">
          {dayTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => void onToggleTaskStatus(task.id)}
              className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-[#e7dbc4] bg-white/85 px-3 py-2.5 text-left hover:border-blue-200 hover:bg-white transition"
            >
              <span
                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  task.isCompleted
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-[#b9aa91]'
                }`}
              >
                {task.isCompleted && <Check className="w-3 h-3" />}
              </span>
              <span
                className={`text-sm font-bold truncate ${
                  task.isCompleted ? 'line-through text-[#9e8f7b]' : ''
                }`}
              >
                {task.taskOfTheDay}
              </span>
              <span className="hidden sm:inline-flex text-[9px] uppercase tracking-wider font-black text-blue-700 bg-blue-50 rounded-full px-2 py-1">
                Task
              </span>
            </button>
          ))}

          {dueHabits.map((habit) => {
            const checked = habit.checkIns.includes(dateKey);
            const future = dateKey > today;

            return (
              <button
                key={habit.id}
                type="button"
                disabled={future}
                onClick={() => void toggleHabit(habit, dateKey)}
                className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/45 px-3 py-2.5 text-left hover:bg-emerald-50 transition disabled:opacity-55 disabled:cursor-not-allowed"
              >
                <span
                  className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    checked
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-emerald-300 bg-white'
                  }`}
                >
                  {checked && <Check className="w-3 h-3" />}
                </span>
                <span className="text-sm font-bold truncate">
                  {habit.emoji} {habit.name}
                </span>
                <span className="hidden sm:inline-flex text-[9px] uppercase tracking-wider font-black text-emerald-700 bg-white/80 rounded-full px-2 py-1">
                  Habit
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] font-black text-blue-600">
            Schedule workspace
          </p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight">
            Calendar
          </h2>
          <p className="mt-1 text-sm font-semibold text-[#766653]">
            Tasks and habits in one timeline, optimized for month planning and daily action.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-xl border border-[#dfd1b6] bg-[#fffaf0] px-3 h-9 text-xs font-black">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(event) => setShowCompleted(event.target.checked)}
            />
            Completed
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border border-[#dfd1b6] bg-[#fffaf0] px-3 h-9 text-xs font-black">
            <input
              type="checkbox"
              checked={showHabits}
              onChange={(event) => setShowHabits(event.target.checked)}
            />
            Habits
          </label>

          <div className="inline-flex rounded-xl border border-[#dfd1b6] bg-[#fffaf0] p-1">
            <button
              type="button"
              onClick={() => setView('month')}
              className={`h-8 px-2.5 rounded-lg text-xs font-black inline-flex items-center gap-1.5 ${
                view === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-black/5'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Month
            </button>
            <button
              type="button"
              onClick={() => setView('agenda')}
              className={`h-8 px-2.5 rounded-lg text-xs font-black inline-flex items-center gap-1.5 ${
                view === 'agenda'
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-black/5'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Agenda
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#ded0b4] bg-[#fffaf0] overflow-hidden">
        <div className="px-3 sm:px-4 py-3 border-b border-black/8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fbf4e3]">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="w-9 h-9 rounded-xl border border-[#dfd1b6] bg-white/70 flex items-center justify-center hover:bg-white"
              title="Previous month"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={jumpToday}
              className="h-9 px-3 rounded-xl border border-[#dfd1b6] bg-white/70 text-xs font-black hover:bg-white"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="w-9 h-9 rounded-xl border border-[#dfd1b6] bg-white/70 flex items-center justify-center hover:bg-white"
              title="Next month"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="text-lg sm:text-xl font-black sm:text-right">
            {cursor.toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </div>
        </div>

        {view === 'month' ? (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              <div className="grid grid-cols-7 border-b border-black/8 bg-[#fbf4e3]">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                  (day) => (
                    <div
                      key={day}
                      className="px-0.5 sm:px-2 py-2 text-center text-[9px] sm:text-[10px] uppercase tracking-wider font-black text-[#8b7a66]"
                    >
                      <span className="sm:hidden">{day.slice(0, 1)}</span>
                      <span className="hidden sm:inline">{day}</span>
                    </div>
                  )
                )}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map((dateKey) => {
                  const date = parseKey(dateKey);
                  const inMonth = monthKey(date) === currentMonth;
                  const dayTasks = tasksByDate.get(dateKey) || [];
                  const dueHabits = habitsForDate(dateKey);
                  const isSelected = selectedDate === dateKey;
                  const isToday = dateKey === today;
                  const completed = dayTasks.filter(
                    (task) => task.isCompleted
                  ).length;

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => selectDate(dateKey)}
                      aria-pressed={isSelected}
                      className={`relative min-h-[68px] sm:min-h-[112px] p-1 sm:p-1.5 border-r border-b border-black/8 text-left align-top transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                        isSelected
                          ? 'bg-blue-50 ring-2 ring-inset ring-blue-500 z-[1]'
                          : 'hover:bg-black/[0.025]'
                      } ${inMonth ? '' : 'bg-black/[0.018] opacity-45'}`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span
                          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-black ${
                            isToday
                              ? 'bg-blue-600 text-white shadow-sm'
                              : isSelected
                              ? 'bg-blue-100 text-blue-700'
                              : ''
                          }`}
                        >
                          {date.getUTCDate()}
                        </span>

                        <div className="hidden sm:flex items-center gap-1">
                          {dayTasks.length > 0 && (
                            <span className="text-[9px] font-black text-blue-700">
                              {completed}/{dayTasks.length}
                            </span>
                          )}
                          {dueHabits.length > 0 && (
                            <span className="text-[9px] font-black text-emerald-700">
                              {dueHabits.length}H
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="sm:hidden flex flex-wrap gap-1 px-0.5">
                        {dayTasks.length > 0 && (
                          <span className="min-w-5 h-4 px-1 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[8px] font-black">
                            {dayTasks.length}
                          </span>
                        )}
                        {dueHabits.length > 0 && (
                          <span className="min-w-5 h-4 px-1 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[8px] font-black">
                            {dueHabits.length}H
                          </span>
                        )}
                      </div>

                      <div className="hidden sm:block space-y-1">
                        {dayTasks.slice(0, 3).map((task) => (
                          <div
                            key={task.id}
                            className={`truncate rounded px-1.5 py-1 text-[10px] font-bold ${
                              task.isCompleted
                                ? 'bg-slate-200 text-slate-500 line-through'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {task.taskOfTheDay}
                          </div>
                        ))}
                        {dayTasks.length > 3 && (
                          <div className="text-[9px] font-black text-[#8b7a66]">
                            +{dayTasks.length - 3} more
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className="border-t xl:border-t-0 xl:border-l border-black/8 bg-[#fbf4e3]/55 p-3 sm:p-4">
              <div className="xl:sticky xl:top-24">
                {renderSelectedDayPanel()}
              </div>
            </aside>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="p-2 sm:p-4 min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <ClipboardList className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="text-sm font-black">Monthly Agenda</div>
                    <div className="text-[10px] font-bold text-[#8b7a66]">
                      {agendaDaysWithItems.length} active day
                      {agendaDaysWithItems.length === 1 ? '' : 's'} in this month
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setView('month')}
                  className="hidden sm:inline-flex h-8 px-2.5 rounded-lg border border-[#dfd1b6] bg-white text-[10px] font-black items-center gap-1.5 hover:bg-[#fbf4e3]"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  Calendar
                </button>
              </div>

              {agendaDaysWithItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#dfd1b6] bg-white/45 py-16 text-center">
                  <List className="w-7 h-7 mx-auto text-[#b7a58d]" />
                  <div className="mt-2 text-sm font-black text-[#766653]">
                    Nothing scheduled this month
                  </div>
                  <div className="text-[11px] font-semibold text-[#9d8b73]">
                    Select a date and add your first task.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {agendaDaysWithItems.map((dateKey) =>
                    renderAgendaDay(dateKey)
                  )}
                </div>
              )}
            </div>

            <aside className="border-t xl:border-t-0 xl:border-l border-black/8 bg-[#fbf4e3]/55 p-3 sm:p-4">
              <div className="xl:sticky xl:top-24">
                {renderSelectedDayPanel(true)}
              </div>
            </aside>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-bold text-[#8b7a66]">
        <div className="rounded-xl border border-[#dfd1b6] bg-[#fffaf0] px-3 py-2 flex items-center gap-2">
          <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
          Blue items are tasks. Tap a task to change completion.
        </div>
        <div className="rounded-xl border border-[#dfd1b6] bg-[#fffaf0] px-3 py-2 flex items-center gap-2">
          <Repeat2 className="w-3.5 h-3.5 text-emerald-600" />
          Green items are habits. Future habit check-ins stay locked.
        </div>
      </div>
    </div>
  );
};
