import React, { useCallback, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarArrowUp,
  X,
} from 'lucide-react';
import type { HabitItem, MatrixQuadrant, TaskItem, ToolsDensity } from '../types';
import { CONFIGURED_TIMEZONE } from '../utils/taskDateUtils';
import { useCurrentDateKey } from '../hooks/useCurrentDateKey';
import { isHabitDue } from '../utils/habitUtils';
import { CalendarYearView } from './calendar/CalendarYearView';
import { CalendarMonthView } from './calendar/CalendarMonthView';

export type CalendarView = 'year' | 'month';

export interface CalendarWorkspaceProps {
  tasks: TaskItem[];
  habits: HabitItem[];
  onAddTask: (task: Omit<TaskItem, 'id'>) => Promise<void>;
  onToggleTaskStatus: (taskId: string) => Promise<void>;
  onUpdateTask: (task: TaskItem) => Promise<void>;
  onUpdateHabit: (habit: HabitItem) => Promise<void>;
  density?: ToolsDensity;
  focusMode?: boolean;
}

export interface CalendarViewOption {
  id: CalendarView;
  label: string;
}

export interface CalendarDaySummary {
  dateKey: string;
  tasks: TaskItem[];
  habits: HabitItem[];
  completedTasks: number;
  completedHabits: number;
  totalItems: number;
  completedItems: number;
  completionRate: number | null;
}

const CALENDAR_VIEWS: CalendarViewOption[] = [
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

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
  const targetDay = Math.min(
    sourceDate.getUTCDate(),
    getDaysInMonth(targetYear, targetMonth)
  );

  return new Date(Date.UTC(targetYear, targetMonth, targetDay));
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
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

export const CalendarWorkspace: React.FC<CalendarWorkspaceProps> = ({
  tasks,
  habits,
  onAddTask,
  onToggleTaskStatus,
  onUpdateTask,
  onUpdateHabit,
  density = 'compact',
  focusMode = false,
}) => {
  const today = useCurrentDateKey(CONFIGURED_TIMEZONE);
  const todayDate = useMemo(() => parseKey(today), [today]);

  const [view, setView] = useState<CalendarView>('month');
  const [selectedDate, setSelectedDate] = useState(today);
  const [cursor, setCursor] = useState<Date>(startOfMonth(todayDate));
  const [showCompleted, setShowCompleted] = useState(true);
  const [showHabits, setShowHabits] = useState(true);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [detailsDate, setDetailsDate] = useState<string | null>(null);

  const compact = density === 'compact';

  const allTasksByDate = useMemo(() => {
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

    for (const items of map.values()) {
      items.sort(
        (a, b) =>
          Number(a.isCompleted) - Number(b.isCompleted) ||
          priorityRank(a) - priorityRank(b)
      );
    }

    return map;
  }, [tasks]);

  const tasksByDate = useMemo(() => {
    if (showCompleted) return allTasksByDate;

    const map = new Map<string, TaskItem[]>();
    allTasksByDate.forEach((items, dateKey) => {
      const visibleItems = items.filter((task) => !task.isCompleted);
      if (visibleItems.length > 0) {
        map.set(dateKey, visibleItems);
      }
    });

    return map;
  }, [allTasksByDate, showCompleted]);

  const getHabitsForDate = useCallback(
    (dateKey: string): HabitItem[] =>
      showHabits
        ? habits.filter((habit) => isHabitDue(habit, dateKey))
        : [],
    [habits, showHabits]
  );

  const getDaySummary = useCallback(
    (dateKey: string): CalendarDaySummary => {
      const dayTasks = allTasksByDate.get(dateKey) || [];
      const dayHabits = getHabitsForDate(dateKey);

      const completedTasks = dayTasks.filter((task) => task.isCompleted).length;
      const completedHabits = dayHabits.filter((habit) =>
        habit.checkIns.includes(dateKey)
      ).length;

      const totalItems = dayTasks.length + dayHabits.length;
      const completedItems = completedTasks + completedHabits;

      return {
        dateKey,
        tasks: dayTasks,
        habits: dayHabits,
        completedTasks,
        completedHabits,
        totalItems,
        completedItems,
        completionRate: totalItems
          ? Math.round((completedItems / totalItems) * 100)
          : null,
      };
    },
    [allTasksByDate, getHabitsForDate]
  );

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
    (nextView: CalendarView) => {
      setView(nextView);
      setCursor(startOfMonth(parseKey(selectedDate)));
    },
    [selectedDate]
  );

  const jumpToday = useCallback(() => {
    setSelectedDate(today);
    setCursor(startOfMonth(todayDate));
  }, [today, todayDate]);

  const navigateYear = useCallback(
    (offset: number) => {
      const target = addYears(cursor, offset);
      const selected = parseKey(selectedDate);

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
    },
    [cursor, selectedDate]
  );

  const navigateMonth = useCallback(
    (offset: number) => {
      const target = addMonths(cursor, offset);
      const selected = parseKey(selectedDate);

      const nextSelected = clampDateToMonth(
        selected,
        target.getUTCFullYear(),
        target.getUTCMonth()
      );

      setCursor(target);
      setSelectedDate(keyFromDate(nextSelected));
    },
    [cursor, selectedDate]
  );

  const navigatePeriod = useCallback(
    (direction: -1 | 1) => {
      if (view === 'year') {
        navigateYear(direction);
        return;
      }

      navigateMonth(direction);
    },
    [view, navigateYear, navigateMonth]
  );

  const periodLabel = useMemo(
    () =>
      view === 'year'
        ? String(cursor.getUTCFullYear())
        : cursor.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          }),
    [view, cursor]
  );

  const addTaskToDate = useCallback(
    async (title: string, notes: string, quadrant: MatrixQuadrant | '', dateKey = selectedDate) => {
      const cleanTitle = title.trim();
      if (!cleanTitle) return;

      const priority: NonNullable<TaskItem['priority']> =
        quadrant === 'urgent-important'
          ? 'High'
          : quadrant === 'important' || quadrant === 'urgent'
          ? 'Medium'
          : 'Normal';

      await onAddTask({
        taskKey: dateKey,
        taskOfTheDay: cleanTitle,
        isCompleted: false,
        priority,
        category: 'Calendar',
        matrixQuadrant: quadrant || undefined,
        notes: notes.trim(),
        updatedAt: new Date().toISOString(),
      });
    },
    [onAddTask, selectedDate]
  );

  const toggleHabit = useCallback(
    async (habit: HabitItem, dateKey: string) => {
      if (dateKey > today || !isHabitDue(habit, dateKey)) return;

      const checked = habit.checkIns.includes(dateKey);
      const checkIns = checked
        ? habit.checkIns.filter((key) => key !== dateKey)
        : [...habit.checkIns, dateKey].sort();

      await onUpdateHabit({
        ...habit,
        checkIns,
        updatedAt: new Date().toISOString(),
      });
    },
    [onUpdateHabit, today]
  );

  return (
    <div
      className={`relative h-full min-h-[520px] md:min-h-[640px] lg:min-h-0 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 dark:text-slate-100 flex flex-col overflow-hidden ${
        compact ? 'text-sm' : ''
      }`}
    >
      {focusMode ? (
        <CalendarFocusTopBar
          view={view}
          periodLabel={periodLabel}
          onViewChange={changeView}
          onToday={jumpToday}
        />
      ) : (
        <CalendarTopBar
          view={view}
          periodLabel={periodLabel}
          onViewChange={changeView}
          onPrevious={() => navigatePeriod(-1)}
          onNext={() => navigatePeriod(1)}
          onToday={jumpToday}
          onAdd={() => setAddTaskOpen(true)}
        />
      )}

      {!focusMode && <div className="shrink-0 min-h-9 px-3 sm:px-5 flex items-center justify-end gap-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
        <label className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(event) => setShowCompleted(event.target.checked)}
          />
          Completed
        </label>

        <label className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
          <input
            type="checkbox"
            checked={showHabits}
            onChange={(event) => setShowHabits(event.target.checked)}
          />
          Habits
        </label>
      </div>}

      <div className="relative flex-1 min-h-0 overflow-auto pb-10 sm:pb-20">
        {view === 'year' && (
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

        {view === 'month' && (
          <CalendarMonthView
            calendarDays={calendarDays}
            selectedDate={selectedDate}
            today={today}
            currentMonth={monthKey(cursor)}
            tasksByDate={tasksByDate}
            getHabitsForDate={getHabitsForDate}
            onSelectDate={selectDate}
            onShowMore={(dateKey) => {
              selectDate(dateKey);
              setDetailsDate(dateKey);
            }}
            onOpenDay={(dateKey) => {
              selectDate(dateKey);
              setDetailsDate(dateKey);
            }}
            onToggleTask={onToggleTaskStatus}
            onToggleHabit={toggleHabit}
          />
        )}
      </div>

      {detailsDate && (
        <CalendarDayDetailsDialog
          dateKey={detailsDate}
          today={today}
          tasks={allTasksByDate.get(detailsDate) || []}
          habits={getHabitsForDate(detailsDate)}
          onClose={() => setDetailsDate(null)}
          onToggleTask={onToggleTaskStatus}
          onMoveTaskToToday={async (task) => {
            await onUpdateTask({ ...task, taskKey: today, updatedAt: new Date().toISOString() });
          }}
          onToggleHabit={toggleHabit}
        />
      )}

      {addTaskOpen && (
        <QuickAddTaskDialog
          selectedDate={selectedDate}
          onClose={() => setAddTaskOpen(false)}
          onSubmit={async (title, notes, quadrant) => {
            await addTaskToDate(title, notes, quadrant);
          }}
        />
      )}
    </div>
  );
};

interface CalendarFocusTopBarProps {
  view: CalendarView;
  periodLabel: string;
  onViewChange: (view: CalendarView) => void;
  onToday: () => void;
}

const CalendarFocusTopBar: React.FC<CalendarFocusTopBarProps> = ({
  view,
  periodLabel,
  onViewChange,
  onToday,
}) => (
  <header className="relative z-30 shrink-0 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
    <div className="px-2.5 sm:px-5 py-2 sm:py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex items-center gap-2">
        <CalendarDays className="w-5 h-5 shrink-0 text-slate-500" />
        <h2 className="min-w-0 truncate text-base sm:text-xl font-bold text-slate-900 dark:text-slate-100">
          {periodLabel}
        </h2>
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <CalendarViewSegmentedControl
          value={view}
          onChange={onViewChange}
        />

        <button
          type="button"
          onClick={onToday}
          className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
        >
          Today
        </button>
      </div>
    </div>
  </header>
);

interface CalendarTopBarProps {
  view: CalendarView;
  periodLabel: string;
  onViewChange: (view: CalendarView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onAdd: () => void;
}

const CalendarTopBar: React.FC<CalendarTopBarProps> = ({
  view,
  periodLabel,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
  onAdd,
}) => (
  <header className="relative z-30 shrink-0 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
    <div className="px-2.5 sm:px-5 py-2 sm:py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 shrink-0 text-slate-500" />
          <h2 className="min-w-0 truncate text-base sm:text-xl font-bold text-slate-900 dark:text-slate-100">
            {periodLabel}
          </h2>
        </div>

        <div className="sm:hidden shrink-0">
          <ToolbarIconButton title="Add task" onClick={onAdd}>
            <Plus className="w-4 h-4" />
          </ToolbarIconButton>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <CalendarViewSegmentedControl
          value={view}
          onChange={onViewChange}
        />

        <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-0.5 shrink-0">
          <button
            type="button"
            onClick={onPrevious}
            title={view === 'year' ? 'Previous year' : 'Previous month'}
            aria-label={view === 'year' ? 'Previous year' : 'Previous month'}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg inline-flex items-center justify-center text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:text-slate-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToday}
            className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            Today
          </button>

          <button
            type="button"
            onClick={onNext}
            title={view === 'year' ? 'Next year' : 'Next month'}
            aria-label={view === 'year' ? 'Next year' : 'Next month'}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg inline-flex items-center justify-center text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:text-slate-100 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="hidden sm:block shrink-0">
          <ToolbarIconButton title="Add task" onClick={onAdd}>
            <Plus className="w-4 h-4" />
          </ToolbarIconButton>
        </div>
      </div>
    </div>
  </header>
);

interface CalendarViewSegmentedControlProps {
  value: CalendarView;
  onChange: (view: CalendarView) => void;
}

const CalendarViewSegmentedControl: React.FC<
  CalendarViewSegmentedControlProps
> = ({ value, onChange }) => (
  <div
    role="group"
    aria-label="Calendar view"
    className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-0.5 shrink-0"
  >
    {CALENDAR_VIEWS.map((option) => {
      const active = value === option.id;

      return (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={active}
          className={`h-8 sm:h-9 min-w-[58px] sm:min-w-[64px] px-2.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all ${
            active
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-100'
          }`}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

interface ToolbarIconButtonProps {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
}

const ToolbarIconButton: React.FC<ToolbarIconButtonProps> = ({
  children,
  title,
  onClick,
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg inline-flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-100 transition-colors"
  >
    {children}
  </button>
);

interface CalendarDayDetailsDialogProps {
  dateKey: string;
  today: string;
  tasks: TaskItem[];
  habits: HabitItem[];
  onClose: () => void;
  onToggleTask: (taskId: string) => Promise<void>;
  onMoveTaskToToday: (task: TaskItem) => Promise<void>;
  onToggleHabit: (habit: HabitItem, dateKey: string) => Promise<void>;
}

const CalendarDayDetailsDialog: React.FC<CalendarDayDetailsDialogProps> = ({
  dateKey,
  today,
  tasks,
  habits,
  onClose,
  onToggleTask,
  onMoveTaskToToday,
  onToggleHabit,
}) => {
  const isFuture = dateKey > today;
  const totalItems = tasks.length + habits.length;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/30 p-2 sm:p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={'Items for ' + longDate(dateKey)}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md max-h-[calc(100dvh-1rem)] sm:max-h-[80dvh] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {longDate(dateKey)}
            </div>
            <div className="mt-0.5 text-[10px] font-semibold text-slate-500">
              {totalItems} item{totalItems === 1 ? '' : 's'}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close day details"
            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[calc(100dvh-5rem)] sm:max-h-[calc(80dvh-64px)] overflow-y-auto overscroll-contain p-3 space-y-3">
          {totalItems === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs font-semibold text-slate-500">
              No visible tasks or habits for this date.
            </div>
          )}

          {tasks.length > 0 && (
            <section>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tasks</div>
              <div className="space-y-1.5">
                {tasks.map((task) => {
                  const canMoveToToday = dateKey < today && !task.isCompleted;
                  return (
                    <div key={task.id} className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 flex items-center gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-900">
                      <button
                        type="button"
                        disabled={isFuture}
                        onClick={() => void onToggleTask(task.id)}
                        className="min-w-0 flex-1 flex items-center gap-2 text-left disabled:opacity-55 disabled:cursor-default"
                      >
                        <input type="checkbox" checked={task.isCompleted} readOnly tabIndex={-1} className="pointer-events-none" />
                        <span className={task.isCompleted ? 'min-w-0 flex-1 text-xs font-semibold text-slate-400 line-through' : 'min-w-0 flex-1 text-xs font-semibold text-slate-800 dark:text-slate-200'}>
                          {task.taskOfTheDay}
                        </span>
                        {task.timeEstimate && (
                          <span className="shrink-0 text-[11px] font-medium text-slate-400">{task.timeEstimate}</span>
                        )}
                      </button>
                      {canMoveToToday && (
                        <button
                          type="button"
                          onClick={() => void onMoveTaskToToday(task)}
                          title="Move task to today"
                          aria-label={`Move ${task.taskOfTheDay} to today`}
                          className="shrink-0 w-8 h-8 rounded-lg inline-flex items-center justify-center text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <CalendarArrowUp className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {habits.length > 0 && (
            <section>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Habits</div>
              <div className="space-y-1.5">
                {habits.map((habit) => {
                  const checked = habit.checkIns.includes(dateKey);
                  return (
                    <button
                      key={habit.id}
                      type="button"
                      disabled={isFuture}
                      onClick={() => void onToggleHabit(habit, dateKey)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 flex items-center gap-2 text-left hover:bg-slate-50 disabled:opacity-55 disabled:cursor-default"
                    >
                      <input type="checkbox" checked={checked} readOnly tabIndex={-1} className="pointer-events-none" />
                      <span className="min-w-0 flex-1 text-xs font-semibold text-slate-800">
                        {habit.emoji} {habit.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
interface QuickAddTaskDialogProps {
  selectedDate: string;
  onClose: () => void;
  onSubmit: (title: string, notes: string, quadrant: MatrixQuadrant | '') => Promise<void>;
}

const TASK_QUADRANT_OPTIONS: Array<{ value: MatrixQuadrant; roman: string; label: string }> = [
  { value: 'urgent-important', roman: 'I', label: 'Urgent & Important' },
  { value: 'important', roman: 'II', label: 'Not Urgent & Important' },
  { value: 'urgent', roman: 'III', label: 'Urgent & Unimportant' },
  { value: 'neither', roman: 'IV', label: 'Not Urgent & Unimportant' },
];

const QuickAddTaskDialog: React.FC<QuickAddTaskDialogProps> = ({
  selectedDate,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [quadrant, setQuadrant] = useState<MatrixQuadrant | ''>('');
  const [saving, setSaving] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  const submit = async () => {
    const clean = title.trim();
    if (!clean || saving) return;
    try {
      setSaving(true);
      await onSubmit(clean, notes, quadrant);
      setTitle('');
      setNotes('');
      setQuadrant('');
      setAddedCount((count) => count + 1);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-2 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Enter tasks" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <div className="w-full max-w-lg max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-slate-900 dark:text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400"><Plus className="w-4 h-4 stroke-[3]" /></div>
            <div><h3 className="text-base font-semibold">Enter Tasks</h3><p className="text-xs text-slate-500 dark:text-slate-400">Add one or multiple tasks for {longDate(selectedDate)}</p></div>
          </div>
          <button type="button" disabled={saving} onClick={onClose} className="inline-flex size-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed dark:hover:bg-slate-800" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>

        <div className="mb-2 px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">Schedule for</span><span className="font-semibold text-blue-600 dark:text-blue-400 font-mono">{longDate(selectedDate)}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_190px] gap-2 items-start">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Task Title / Objective</label>
            <input autoFocus value={title} onChange={(e)=>setTitle(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter')void submit();if(e.key==='Escape'&&!saving)onClose();}} placeholder="What needs to be done?" className="w-full h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-sm outline-none focus:border-blue-500" />
            <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Notes" rows={2} className="mt-1 w-full min-h-[48px] resize-y px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Quadrant <span className="font-medium normal-case tracking-normal text-slate-400">(optional)</span></label>
            <select value={quadrant} onChange={(e)=>setQuadrant(e.target.value as MatrixQuadrant|'')} className="w-full h-9 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold outline-none focus:border-blue-500">
              <option value="">No quadrant</option>
              {TASK_QUADRANT_OPTIONS.map((item)=><option key={item.value} value={item.value}>{item.roman} — {item.label}</option>)}
            </select>
          </div>
        </div>

        {addedCount > 0 && <div className="mt-2 text-xs font-semibold text-blue-700 dark:text-blue-300">Added in this session: {addedCount}</div>}
        <div className="mt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-2">
          <button type="button" disabled={saving} onClick={onClose} className="px-3 h-9 rounded-xl bg-slate-800 dark:bg-slate-700 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">Done</button>
          <button type="button" disabled={!title.trim()||saving} onClick={()=>void submit()} className="h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-40 inline-flex items-center gap-1"><Plus className="w-4 h-4"/>{saving?'Adding...':'Add'}</button>
        </div>
      </div>
    </div>
  );
};
