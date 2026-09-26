import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GripVertical,
  List,
  Plus,
} from 'lucide-react';
import { HabitItem, TaskItem, ToolsDensity } from '../types';
import {
  CONFIGURED_TIMEZONE,
  getIsoDateKeyInTimezone,
} from '../utils/taskDateUtils';
import { isHabitDue } from '../utils/habitUtils';

interface CalendarWorkspaceProps {
  tasks: TaskItem[];
  habits: HabitItem[];
  onAddTask: (task: Omit<TaskItem, 'id'>) => Promise<void>;
  onUpdateTask: (task: TaskItem) => Promise<void>;
  onToggleTaskStatus: (taskId: string) => Promise<void>;
  onUpdateHabit: (habit: HabitItem) => Promise<void>;
  density?: ToolsDensity;
}

type CalendarView = 'month' | 'week' | 'day' | 'agenda';

type CalendarDragItem =
  | { kind: 'task'; id: string; sourceDate: string }
  | { kind: 'habit'; id: string; sourceDate: string };

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
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    '0'
  )}`;
}

function getMonday(dateKey: string): string {
  const date = parseKey(dateKey);
  const day = date.getUTCDay();
  return addDays(dateKey, day === 0 ? -6 : 1 - day);
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
  onUpdateTask,
  onToggleTaskStatus,
  onUpdateHabit,
  density = 'compact',
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
  const [draggedItem, setDraggedItem] = useState<CalendarDragItem | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [dragFeedback, setDragFeedback] = useState<string | null>(null);
  const compact = density === 'compact';

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

  const weekDates = useMemo(() => {
    const monday = getMonday(selectedDate);
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  }, [selectedDate]);

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
  const selectedDoneTasks = selectedTasks.filter(
    (task) => task.isCompleted
  ).length;
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
      setCursor(
        new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
      );
    }
  };

  const changeSelectedDay = (offset: number) => {
    selectDate(addDays(selectedDate, offset));
  };

  const changeMonth = (offset: number) => {
    setCursor((current) => {
      const selected = parseKey(selectedDate);
      const target = new Date(
        Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1)
      );
      const daysInTarget = new Date(
        Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
      ).getUTCDate();
      const targetDay = Math.min(selected.getUTCDate(), daysInTarget);
      const nextSelected = new Date(
        Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), targetDay)
      );

      setSelectedDate(keyFromDate(nextSelected));
      return target;
    });
  };

  const changeWeek = (offset: number) => {
    const next = addDays(selectedDate, offset * 7);
    selectDate(next);
  };

  const changeView = (nextView: CalendarView) => {
    setView(nextView);

    const selected = parseKey(selectedDate);
    setCursor(
      new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1))
    );
  };

  const navigatePeriod = (offset: number) => {
    if (view === 'week') {
      changeWeek(offset);
      return;
    }

    if (view === 'day') {
      changeSelectedDay(offset);
      return;
    }

    changeMonth(offset);
  };

  const navigationUnit =
    view === 'week' ? 'week' : view === 'day' ? 'day' : 'month';

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

  const rescheduleTask = async (task: TaskItem, targetDate: string) => {
    if (task.taskKey === targetDate) return;

    await onUpdateTask({
      ...task,
      taskKey: targetDate,
      updatedAt: new Date().toISOString(),
    });

    setSelectedDate(targetDate);
    setDragFeedback(
      `Moved "${task.taskOfTheDay}" to ${shortDate(targetDate)}.`
    );
  };

  const rescheduleHabit = async (
    habit: HabitItem,
    sourceDate: string,
    targetDate: string
  ) => {
    if (sourceDate === targetDate) return;

    if (isHabitDue(habit, targetDate)) {
      setDragFeedback(
        `${habit.name} is already scheduled for ${shortDate(targetDate)}.`
      );
      return;
    }

    const skippedDates = new Set(habit.skippedDates || []);
    const extraDates = new Set(habit.extraDates || []);
    const checkIns = new Set(habit.checkIns || []);

    const baseHabit: HabitItem = {
      ...habit,
      skippedDates: [],
      extraDates: [],
    };

    if (isHabitDue(baseHabit, sourceDate)) {
      skippedDates.add(sourceDate);
    } else {
      extraDates.delete(sourceDate);
      skippedDates.delete(sourceDate);
    }

    if (isHabitDue(baseHabit, targetDate)) {
      skippedDates.delete(targetDate);
      extraDates.delete(targetDate);
    } else {
      extraDates.add(targetDate);
      skippedDates.delete(targetDate);
    }

    if (checkIns.has(sourceDate)) {
      checkIns.delete(sourceDate);
      if (targetDate <= today) {
        checkIns.add(targetDate);
      }
    }

    await onUpdateHabit({
      ...habit,
      skippedDates: [...skippedDates].sort(),
      extraDates: [...extraDates].sort(),
      checkIns: [...checkIns].sort(),
      updatedAt: new Date().toISOString(),
    });

    setSelectedDate(targetDate);
    setDragFeedback(
      `Moved ${habit.name} occurrence to ${shortDate(targetDate)}.`
    );
  };

  const beginDrag = (
    event: React.DragEvent<HTMLElement>,
    item: CalendarDragItem
  ) => {
    setDraggedItem(item);
    setDragFeedback(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-system-builder-calendar', JSON.stringify(item));
  };

  const endDrag = () => {
    setDraggedItem(null);
    setDragOverDate(null);
  };

  const handleDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    targetDate: string
  ) => {
    event.preventDefault();

    let item = draggedItem;
    const raw = event.dataTransfer.getData(
      'application/x-system-builder-calendar'
    );

    if (!item && raw) {
      try {
        item = JSON.parse(raw) as CalendarDragItem;
      } catch {
        item = null;
      }
    }

    setDragOverDate(null);
    if (!item || item.sourceDate === targetDate) {
      endDrag();
      return;
    }

    try {
      if (item.kind === 'task') {
        const task = tasks.find((candidate) => candidate.id === item.id);
        if (task) await rescheduleTask(task, targetDate);
      } else {
        const habit = habits.find((candidate) => candidate.id === item.id);
        if (habit) {
          await rescheduleHabit(habit, item.sourceDate, targetDate);
        }
      }
    } catch (error: any) {
      setDragFeedback(
        error?.message || 'Unable to reschedule this calendar item.'
      );
    } finally {
      endDrag();
    }
  };

  const moveTaskFromSelector = async (
    task: TaskItem,
    targetDate: string
  ) => {
    if (!targetDate || targetDate === task.taskKey) return;
    try {
      await rescheduleTask(task, targetDate);
    } catch (error: any) {
      setDragFeedback(error?.message || 'Unable to move task.');
    }
  };

  const moveHabitFromSelector = async (
    habit: HabitItem,
    sourceDate: string,
    targetDate: string
  ) => {
    if (!targetDate || targetDate === sourceDate) return;
    try {
      await rescheduleHabit(habit, sourceDate, targetDate);
    } catch (error: any) {
      setDragFeedback(error?.message || 'Unable to move habit.');
    }
  };

  const periodLabel =
    view === 'week'
      ? `${parseKey(weekDates[0]).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        })} – ${parseKey(weekDates[6]).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        })}`
      : view === 'day'
      ? longDate(selectedDate)
      : cursor.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        });

  const renderSelectedDayPanel = () => (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] font-black text-blue-700">
              Selected day
            </div>
            <div className="mt-1 text-base sm:text-lg font-black text-slate-900 truncate">
              {longDate(selectedDate)}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-600">
              <span>
                {selectedTasks.length} task
                {selectedTasks.length === 1 ? '' : 's'}
              </span>
              {showHabits && (
                <span>
                  {selectedHabits.length} habit
                  {selectedHabits.length === 1 ? '' : 's'}
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
              className={`${compact ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl'} border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition`}
              title="Previous day"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => changeSelectedDay(1)}
              className={`${compact ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl'} border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition`}
              title="Next day"
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {(selectedTasks.length > 0 || selectedHabits.length > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-lg font-black">
                {selectedDoneTasks}/{selectedTasks.length}
              </div>
              <div className="text-[9px] uppercase tracking-wider font-black text-slate-500">
                Tasks done
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-lg font-black">
                {selectedDoneHabits}/{selectedHabits.length}
              </div>
              <div className="text-[9px] uppercase tracking-wider font-black text-slate-500">
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
          className="min-w-0 flex-1 h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center">
          <CalendarDays className="w-6 h-6 mx-auto text-slate-400" />
          <div className="mt-2 text-sm font-black text-slate-600">
            Nothing scheduled
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {selectedTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => void onToggleTaskStatus(task.id)}
              className="w-full flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-xs hover:border-blue-300 hover:bg-slate-50 transition"
            >
              <span
                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                  task.isCompleted
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-slate-300'
                }`}
              >
                {task.isCompleted && <Check className="w-3 h-3" />}
              </span>
              <span
                className={`text-sm font-bold min-w-0 flex-1 truncate ${
                  task.isCompleted ? 'line-through text-slate-500' : ''
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
                className="w-full flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-xs hover:border-emerald-300 hover:bg-slate-50 transition disabled:opacity-55 disabled:cursor-not-allowed"
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
                <span className="text-[9px] uppercase tracking-wider font-black text-emerald-700 bg-white rounded-full px-2 py-1">
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

    return (
      <section
        key={dateKey}
        className={`rounded-2xl border overflow-hidden transition ${
          isSelected
            ? 'border-blue-300 bg-white shadow-sm ring-2 ring-blue-100'
            : 'border-slate-200 bg-white'
        }`}
      >
        <button
          type="button"
          onClick={() => selectDate(dateKey)}
          className="w-full px-3 sm:px-4 py-3 text-left border-b border-slate-200/80 flex items-center gap-3 hover:bg-slate-50"
        >
          <div
            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border ${
              isToday
                ? 'bg-blue-600 border-blue-600 text-white'
                : isSelected
                ? 'bg-blue-100 border-blue-200 text-blue-700'
                : 'bg-slate-50 border-slate-200 text-slate-900'
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
            <div className="text-sm font-black">
              {date.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC',
              })}
            </div>
            <div className="mt-1 text-[10px] font-bold text-slate-500">
              {dayTasks.length} task{dayTasks.length === 1 ? '' : 's'}
              {showHabits
                ? ` • ${dueHabits.length} habit${dueHabits.length === 1 ? '' : 's'}`
                : ''}
            </div>
          </div>

          {(isToday || isSelected) && (
            <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-1 text-[9px] uppercase font-black">
              {isToday ? 'Today' : 'Selected'}
            </span>
          )}
        </button>

        <div className="p-2 sm:p-3 space-y-1.5">
          {dayTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => void onToggleTaskStatus(task.id)}
              className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left"
            >
              <span
                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  task.isCompleted
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-slate-300'
                }`}
              >
                {task.isCompleted && <Check className="w-3 h-3" />}
              </span>
              <span
                className={`text-sm font-bold truncate ${
                  task.isCompleted ? 'line-through text-slate-500' : ''
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
                className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-xs hover:border-emerald-300 hover:bg-slate-50 transition disabled:opacity-55"
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
                <span className="hidden sm:inline-flex text-[9px] uppercase tracking-wider font-black text-emerald-700 bg-white rounded-full px-2 py-1">
                  Habit
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  const renderWeekDay = (dateKey: string) => {
    const date = parseKey(dateKey);
    const dayTasks = tasksByDate.get(dateKey) || [];
    const dueHabits = habitsForDate(dateKey);
    const isToday = dateKey === today;
    const isSelected = dateKey === selectedDate;
    const isDropTarget = dragOverDate === dateKey;

    return (
      <div
        key={dateKey}
        onDragEnter={(event) => {
          if (!draggedItem) return;
          event.preventDefault();
          setDragOverDate(dateKey);
        }}
        onDragOver={(event) => {
          if (!draggedItem) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setDragOverDate(dateKey);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
          setDragOverDate((current) => (current === dateKey ? null : current));
        }}
        onDrop={(event) => void handleDrop(event, dateKey)}
        className={`rounded-2xl border min-w-0 overflow-hidden transition-all ${
          isDropTarget
            ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-300 shadow-md -translate-y-0.5'
            : isSelected
            ? 'border-blue-300 bg-white ring-2 ring-blue-100'
            : 'border-slate-200 bg-white'
        }`}
      >
        <button
          type="button"
          onClick={() => selectDate(dateKey)}
          className={`${compact ? 'px-2.5 py-2' : 'px-3 py-3'} w-full border-b border-slate-200/80 text-left flex items-center lg:block gap-3 hover:bg-slate-50`}
        >
          <div className="flex lg:block items-center gap-2">
            <div
              className={`w-10 h-10 lg:w-9 lg:h-9 rounded-xl flex flex-col items-center justify-center border shrink-0 ${
                isToday
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : isSelected
                  ? 'bg-blue-100 border-blue-200 text-blue-700'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <span className="text-[8px] uppercase font-black leading-none lg:hidden">
                {date.toLocaleDateString('en-US', {
                  weekday: 'short',
                  timeZone: 'UTC',
                })}
              </span>
              <span className="text-base font-black leading-none lg:text-sm">
                {date.getUTCDate()}
              </span>
            </div>

            <div className="lg:mt-2 min-w-0">
              <div className="text-xs font-black truncate">
                {date.toLocaleDateString('en-US', {
                  weekday: 'long',
                  timeZone: 'UTC',
                })}
              </div>
              <div className="text-[9px] font-bold text-slate-500">
                {date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'UTC',
                })}
              </div>
            </div>
          </div>

          <div className="ml-auto lg:ml-0 lg:mt-2 text-[9px] font-black text-slate-500">
            {dayTasks.length}T • {dueHabits.length}H
          </div>
        </button>

        <div className={`${compact ? 'p-2 space-y-2 min-h-[120px] lg:min-h-[175px]' : 'p-3 space-y-3 min-h-[160px] lg:min-h-[260px]'} `}>
          {isDropTarget && draggedItem && (
            <div className="rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 px-2 py-3 text-center text-[10px] font-black text-blue-700">
              Drop to reschedule here
            </div>
          )}

          {dayTasks.map((task) => (
            <div
              key={task.id}
              draggable
              onDragStart={(event) =>
                beginDrag(event, {
                  kind: 'task',
                  id: task.id,
                  sourceDate: dateKey,
                })
              }
              onDragEnd={endDrag}
              className={`${compact ? 'px-2.5 py-2' : 'px-3 py-3'} rounded-xl border border-slate-200 bg-white shadow-sm hover:border-blue-300 transition`}
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-0.5 hidden lg:flex w-6 h-6 rounded-lg border border-blue-200 bg-white text-blue-600 items-center justify-center cursor-grab active:cursor-grabbing shrink-0"
                  title="Drag to another day"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </span>
                <button
                  type="button"
                  onClick={() => void onToggleTaskStatus(task.id)}
                  className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    task.isCompleted
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-blue-300 bg-white'
                  }`}
                  aria-label={
                    task.isCompleted
                      ? 'Mark task incomplete'
                      : 'Mark task complete'
                  }
                >
                  {task.isCompleted && <Check className="w-3 h-3" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-xs font-black break-words ${
                      task.isCompleted ? 'line-through text-slate-500' : ''
                    }`}
                  >
                    {task.taskOfTheDay}
                  </div>
                  <div className="mt-1 text-[9px] font-bold text-blue-700">
                    {task.priority || 'Normal'} priority
                  </div>
                </div>
              </div>

              <select
                value={dateKey}
                onChange={(event) =>
                  void moveTaskFromSelector(task, event.target.value)
                }
                className="mt-2 lg:hidden w-full h-8 rounded-lg border border-blue-200 bg-white px-2 text-[10px] font-black text-blue-700"
                aria-label={`Move ${task.taskOfTheDay} to another day`}
              >
                {weekDates.map((target) => (
                  <option key={target} value={target}>
                    Move to {shortDate(target)}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {dueHabits.map((habit) => {
            const checked = habit.checkIns.includes(dateKey);
            return (
              <div
                key={habit.id}
                draggable
                onDragStart={(event) =>
                  beginDrag(event, {
                    kind: 'habit',
                    id: habit.id,
                    sourceDate: dateKey,
                  })
                }
                onDragEnd={endDrag}
                className={`${compact ? 'px-2.5 py-2' : 'px-3 py-3'} rounded-xl border border-slate-200 bg-white shadow-sm hover:border-emerald-300 transition`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-0.5 hidden lg:flex w-6 h-6 rounded-lg border border-emerald-200 bg-white text-emerald-600 items-center justify-center cursor-grab active:cursor-grabbing shrink-0"
                    title="Drag this habit occurrence"
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </span>
                  <button
                    type="button"
                    disabled={dateKey > today}
                    onClick={() => void toggleHabit(habit, dateKey)}
                    className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 disabled:opacity-50 ${
                      checked
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-emerald-300 bg-white'
                    }`}
                    aria-label={`${habit.name} on ${dateKey}`}
                  >
                    {checked && <Check className="w-3 h-3" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black break-words">
                      {habit.emoji} {habit.name}
                    </div>
                    <div className="mt-1 text-[9px] font-bold text-emerald-700">
                      Habit occurrence
                    </div>
                  </div>
                </div>

                <select
                  value={dateKey}
                  onChange={(event) =>
                    void moveHabitFromSelector(
                      habit,
                      dateKey,
                      event.target.value
                    )
                  }
                  className="mt-2 lg:hidden w-full h-8 rounded-lg border border-emerald-200 bg-white px-2 text-[10px] font-black text-emerald-700"
                  aria-label={`Move ${habit.name} occurrence to another day`}
                >
                  {weekDates.map((target) => (
                    <option key={target} value={target}>
                      Move to {shortDate(target)}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}

          {dayTasks.length === 0 && dueHabits.length === 0 && !isDropTarget && (
            <button
              type="button"
              onClick={() => selectDate(dateKey)}
              className={`${compact ? 'min-h-[58px] text-[10px]' : 'min-h-[82px] text-xs'} w-full rounded-xl border border-dashed border-slate-200 font-bold text-slate-400 hover:border-blue-300 hover:text-blue-600`}
            >
              Empty day
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`${compact ? 'space-y-2' : 'space-y-4'} lg:h-full lg:overflow-y-auto lg:pr-1`}>
      <div className={`flex flex-col xl:flex-row xl:items-center justify-between ${compact ? 'gap-2' : 'gap-3'}`}>
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] font-black text-blue-600">
            Schedule workspace
          </p>
          <h2 className={`${compact ? 'mt-0.5 text-xl sm:text-2xl' : 'mt-1 text-2xl sm:text-3xl'} font-black tracking-tight`}>
            Calendar
          </h2>
          <p className={`${compact ? 'mt-0.5 text-xs' : 'mt-1 text-sm'} font-semibold text-slate-600 hidden md:block`}>
            Month planning, weekly rescheduling, and agenda review in one timeline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className={`${compact ? 'px-2.5 h-8 text-[11px] rounded-xl' : 'px-3 h-10 text-xs rounded-xl'} inline-flex items-center gap-2 border border-slate-200 bg-white font-black text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 transition`}>
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(event) => setShowCompleted(event.target.checked)}
            />
            Completed
          </label>
          <label className={`${compact ? 'px-2.5 h-8 text-[11px] rounded-xl' : 'px-3 h-10 text-xs rounded-xl'} inline-flex items-center gap-2 border border-slate-200 bg-white font-black text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 transition`}>
            <input
              type="checkbox"
              checked={showHabits}
              onChange={(event) => setShowHabits(event.target.checked)}
            />
            Habits
          </label>

          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => changeView('month')}
              className={`${compact ? 'h-7 px-2 rounded-md text-[11px]' : 'h-9 px-3 rounded-lg text-xs'} font-black inline-flex items-center gap-1.5 ${
                view === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Month
            </button>
            <button
              type="button"
              onClick={() => changeView('week')}
              className={`${compact ? 'h-7 px-2 rounded-md text-[11px]' : 'h-9 px-3 rounded-lg text-xs'} font-black inline-flex items-center gap-1.5 ${
                view === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              Week
            </button>
            <button
              type="button"
              onClick={() => changeView('day')}
              className={`${compact ? 'h-7 px-2 rounded-md text-[11px]' : 'h-9 px-3 rounded-lg text-xs'} font-black inline-flex items-center gap-1.5 ${
                view === 'day'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Day
            </button>
            <button
              type="button"
              onClick={() => changeView('agenda')}
              className={`${compact ? 'h-7 px-2 rounded-md text-[11px]' : 'h-9 px-3 rounded-lg text-xs'} font-black inline-flex items-center gap-1.5 ${
                view === 'agenda'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Agenda
            </button>
          </div>
        </div>
      </div>

      {dragFeedback && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 flex items-center justify-between gap-3">
          <span>{dragFeedback}</span>
          <button
            type="button"
            onClick={() => setDragFeedback(null)}
            className="text-blue-500 hover:text-blue-700"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className={`${compact ? 'px-2.5 sm:px-3 py-2 gap-2' : 'px-3 sm:px-4 py-3 gap-3'} border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50`}>
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <button
              type="button"
              onClick={() => navigatePeriod(-1)}
              className={`${compact ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl'} border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition`}
              title={`Previous ${navigationUnit}`}
              aria-label={`Previous ${navigationUnit}`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={jumpToday}
              className={`${compact ? 'h-8 px-2.5 rounded-lg text-[11px]' : 'h-10 px-3 rounded-xl text-xs'} border border-slate-200 bg-white font-black text-slate-700 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => navigatePeriod(1)}
              className={`${compact ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl'} border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition`}
              title={`Next ${navigationUnit}`}
              aria-label={`Next ${navigationUnit}`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 sm:justify-end min-w-0">
            <div className="text-sm sm:text-lg xl:text-xl font-black sm:text-right truncate">
              {periodLabel}
            </div>
            <label
              className={`${compact ? 'h-8 px-2 rounded-lg' : 'h-10 px-3 rounded-xl'} shrink-0 border border-slate-200 bg-white inline-flex items-center gap-1.5 hover:border-blue-300 transition cursor-pointer`}
              title="Jump to date"
            >
              <CalendarDays className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  if (event.target.value) selectDate(event.target.value);
                }}
                className="w-[118px] sm:w-[132px] bg-transparent text-[10px] sm:text-xs font-black text-slate-700 outline-none cursor-pointer"
                aria-label="Jump to date"
              />
            </label>
          </div>
        </div>

        {view === 'month' && (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              <div className="grid grid-cols-7 border-b border-slate-200/80 bg-slate-50">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                  (day) => (
                    <div
                      key={day}
                      className="px-0.5 sm:px-2 py-2 text-center text-[9px] sm:text-[10px] uppercase tracking-wider font-black text-slate-500"
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

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => selectDate(dateKey)}
                      aria-pressed={isSelected}
                      className={`relative ${compact ? 'min-h-[58px] sm:min-h-[88px] p-1 sm:p-1.5' : 'min-h-[72px] sm:min-h-[112px] p-1.5 sm:p-2'} border-r border-b border-slate-200/80 text-left transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                        isSelected
                          ? 'bg-blue-50 ring-2 ring-inset ring-blue-500 z-[1]'
                          : 'hover:bg-slate-50'
                      } ${inMonth ? '' : 'bg-slate-50/80 opacity-45'}`}
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
                        <div className="hidden sm:flex items-center gap-1 text-[9px] font-black">
                          {dayTasks.length > 0 && (
                            <span className="text-blue-700">
                              {dayTasks.length}T
                            </span>
                          )}
                          {dueHabits.length > 0 && (
                            <span className="text-emerald-700">
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
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className="border-t xl:border-t-0 xl:border-l border-slate-200 bg-slate-50 p-2.5 sm:p-3">
              <div className="xl:sticky xl:top-24">
                {renderSelectedDayPanel()}
              </div>
            </aside>
          </div>
        )}

        {view === 'week' && (
          <div className="p-2">
            <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-xs font-black">Week planning</div>
                <div className="text-[10px] font-semibold text-slate-500">
                  Drag tasks or habit occurrences between days on desktop.
                </div>
              </div>
              <div className="text-[10px] font-bold text-slate-500">
                On mobile, use each item’s Move to selector.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
              {weekDates.map((dateKey) => renderWeekDay(dateKey))}
            </div>

            <div className="mt-2">
              {renderSelectedDayPanel()}
            </div>
          </div>
        )}

        {view === 'day' && (
          <div className="p-2 sm:p-3 bg-slate-50/60">
            <div className="max-w-3xl mx-auto">
              {renderSelectedDayPanel()}
            </div>
          </div>
        )}

        {view === 'agenda' && (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="p-2 sm:p-3 min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <ClipboardList className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="text-sm font-black">Monthly Agenda</div>
                    <div className="text-[10px] font-bold text-slate-500">
                      {agendaDaysWithItems.length} active day
                      {agendaDaysWithItems.length === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
              </div>

              {agendaDaysWithItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
                  <List className="w-7 h-7 mx-auto text-slate-400" />
                  <div className="mt-2 text-sm font-black text-slate-600">
                    Nothing scheduled this month
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

            <aside className="border-t xl:border-t-0 xl:border-l border-slate-200 bg-slate-50 p-2.5 sm:p-3">
              <div className="xl:sticky xl:top-24">
                {renderSelectedDayPanel()}
              </div>
            </aside>
          </div>
        )}
      </div>

    </div>
  );
};
