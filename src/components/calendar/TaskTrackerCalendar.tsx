import React, { useCallback, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { TaskItem } from '../../types';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarYearView } from './CalendarYearView';

type TaskCalendarView = 'month' | 'year';

export interface TaskTrackerCalendarProps {
  tasks: TaskItem[];
  today: string;
  onToggleTaskStatus: (taskId: string) => Promise<void>;
}

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

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    '0'
  )}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function clampDateToMonth(
  sourceDate: Date,
  targetYear: number,
  targetMonth: number
): Date {
  const day = Math.min(
    sourceDate.getUTCDate(),
    getDaysInMonth(targetYear, targetMonth)
  );

  return new Date(Date.UTC(targetYear, targetMonth, day));
}

function addMonths(date: Date, amount: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1)
  );
}

function addYears(date: Date, amount: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear() + amount, date.getUTCMonth(), 1)
  );
}

export const TaskTrackerCalendar: React.FC<TaskTrackerCalendarProps> = ({
  tasks,
  today,
  onToggleTaskStatus,
}) => {
  const todayDate = useMemo(() => parseKey(today), [today]);
  const [view, setView] = useState<TaskCalendarView>('month');
  const [cursor, setCursor] = useState<Date>(startOfMonth(todayDate));
  const [selectedDate, setSelectedDate] = useState(today);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskItem[]>();

    tasks.forEach((task) => {
      const list = map.get(task.taskKey) || [];
      list.push(task);
      map.set(task.taskKey, list);
    });

    const priorityRank = (task: TaskItem) => {
      switch (task.priority) {
        case 'High':
          return 0;
        case 'Medium':
          return 1;
        default:
          return 2;
      }
    };

    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          Number(a.isCompleted) - Number(b.isCompleted) ||
          priorityRank(a) - priorityRank(b)
      );
    }

    return map;
  }, [tasks]);

  const calendarDays = useMemo(() => {
    const first = startOfMonth(cursor);
    first.setUTCDate(first.getUTCDate() - first.getUTCDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(first);
      date.setUTCDate(first.getUTCDate() + index);
      return keyFromDate(date);
    });
  }, [cursor]);

  const selectDate = useCallback(
    (dateKey: string) => {
      setSelectedDate(dateKey);

      const selected = parseKey(dateKey);
      if (monthKey(selected) !== monthKey(cursor)) {
        setCursor(startOfMonth(selected));
      }
    },
    [cursor]
  );

  const changeView = useCallback(
    (nextView: TaskCalendarView) => {
      setView(nextView);
      setCursor(startOfMonth(parseKey(selectedDate)));
    },
    [selectedDate]
  );

  const jumpToday = useCallback(() => {
    setSelectedDate(today);
    setCursor(startOfMonth(todayDate));
  }, [today, todayDate]);

  const navigate = useCallback(
    (direction: -1 | 1) => {
      const selected = parseKey(selectedDate);

      if (view === 'year') {
        const target = addYears(cursor, direction);
        const nextSelected = clampDateToMonth(
          selected,
          target.getUTCFullYear(),
          selected.getUTCMonth()
        );

        setCursor(
          new Date(
            Date.UTC(
              target.getUTCFullYear(),
              cursor.getUTCMonth(),
              1
            )
          )
        );
        setSelectedDate(keyFromDate(nextSelected));
        return;
      }

      const target = addMonths(cursor, direction);
      const nextSelected = clampDateToMonth(
        selected,
        target.getUTCFullYear(),
        target.getUTCMonth()
      );

      setCursor(target);
      setSelectedDate(keyFromDate(nextSelected));
    },
    [cursor, selectedDate, view]
  );

  const toggleTask = useCallback(
    async (taskId: string) => {
      const task = tasks.find((item) => item.id === taskId);
      if (!task || task.taskKey > today) return;
      await onToggleTaskStatus(taskId);
    },
    [tasks, today, onToggleTaskStatus]
  );

  const getDaySummary = useCallback(
    (dateKey: string) => {
      const dayTasks = tasksByDate.get(dateKey) || [];
      const completedTasks = dayTasks.filter((task) => task.isCompleted).length;

      return {
        dateKey,
        tasks: dayTasks,
        habits: [],
        completedTasks,
        completedHabits: 0,
        totalItems: dayTasks.length,
        completedItems: completedTasks,
        completionRate: dayTasks.length
          ? Math.round((completedTasks / dayTasks.length) * 100)
          : null,
      };
    },
    [tasksByDate]
  );

  const periodLabel =
    view === 'year'
      ? String(cursor.getUTCFullYear())
      : cursor.toLocaleDateString('en-US', {
          month: 'long',
          timeZone: 'UTC',
        });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="border-b border-slate-100 bg-white px-2.5 sm:px-4 py-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-wider font-black text-slate-400">
                Task Calendar
              </div>
              <div className="truncate text-sm font-black text-slate-900">
                {periodLabel}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <div
              role="group"
              aria-label="Task calendar view"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 shrink-0"
            >
              {(['month', 'year'] as const).map((option) => {
                const active = view === option;

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => changeView(option)}
                    aria-pressed={active}
                    className={`h-8 min-w-[58px] px-2.5 rounded-lg text-[11px] font-semibold capitalize transition-all ${
                      active
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => navigate(-1)}
                title={view === 'year' ? 'Previous year' : 'Previous month'}
                aria-label={view === 'year' ? 'Previous year' : 'Previous month'}
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-900 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={jumpToday}
                className="h-8 px-2.5 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-white transition-colors"
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => navigate(1)}
                title={view === 'year' ? 'Next year' : 'Next month'}
                aria-label={view === 'year' ? 'Next year' : 'Next month'}
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-900 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-[560px]">
        {view === 'month' ? (
          <CalendarMonthView
            calendarDays={calendarDays}
            selectedDate={selectedDate}
            today={today}
            currentMonth={monthKey(cursor)}
            tasksByDate={tasksByDate}
            getHabitsForDate={() => []}
            onSelectDate={selectDate}
            onToggleTask={toggleTask}
            onToggleHabit={async () => undefined}
          />
        ) : (
          <CalendarYearView
            year={cursor.getUTCFullYear()}
            today={today}
            selectedDate={selectedDate}
            onSelectDate={selectDate}
            getDaySummary={getDaySummary}
            onOpenMonth={(year, month) => {
              const target = new Date(Date.UTC(year, month, 1));
              setCursor(target);
              setSelectedDate(keyFromDate(target));
              setView('month');
            }}
          />
        )}
      </div>
    </section>
  );
};
