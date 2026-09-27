import React, { useCallback, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import type { HabitItem, TaskItem, ToolsDensity } from '../types';
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
  onUpdateTask: (task: TaskItem) => Promise<void>;
  onToggleTaskStatus: (taskId: string) => Promise<void>;
  onUpdateHabit: (habit: HabitItem) => Promise<void>;
  density?: ToolsDensity;
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
  onUpdateHabit,
  density = 'compact',
}) => {
  const today = useCurrentDateKey(CONFIGURED_TIMEZONE);
  const todayDate = useMemo(() => parseKey(today), [today]);

  const [view, setView] = useState<CalendarView>('month');
  const [selectedDate, setSelectedDate] = useState(today);
  const [cursor, setCursor] = useState<Date>(startOfMonth(todayDate));
  const [showCompleted, setShowCompleted] = useState(true);
  const [showHabits, setShowHabits] = useState(true);
  const [addTaskOpen, setAddTaskOpen] = useState(false);

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
    async (title: string, dateKey = selectedDate) => {
      const cleanTitle = title.trim();
      if (!cleanTitle) return;

      await onAddTask({
        taskKey: dateKey,
        taskOfTheDay: cleanTitle,
        isCompleted: false,
        priority: 'Normal',
        category: 'Calendar',
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
      className={`relative h-full min-h-[640px] lg:min-h-0 bg-white text-slate-900 flex flex-col overflow-hidden ${
        compact ? 'text-sm' : ''
      }`}
    >
      <CalendarTopBar
        view={view}
        periodLabel={periodLabel}
        onViewChange={changeView}
        onPrevious={() => navigatePeriod(-1)}
        onNext={() => navigatePeriod(1)}
        onToday={jumpToday}
        onAdd={() => setAddTaskOpen(true)}
      />

      <div className="shrink-0 min-h-9 px-3 sm:px-5 flex items-center justify-end gap-3 border-b border-slate-100 bg-white">
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
      </div>

      <div className="relative flex-1 min-h-0 overflow-auto pb-20">
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
            onToggleTask={onToggleTaskStatus}
            onToggleHabit={toggleHabit}
          />
        )}
      </div>

      {addTaskOpen && (
        <QuickAddTaskDialog
          selectedDate={selectedDate}
          onClose={() => setAddTaskOpen(false)}
          onSubmit={async (title) => {
            await addTaskToDate(title);
            setAddTaskOpen(false);
          }}
        />
      )}
    </div>
  );
};

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
  <header className="relative z-30 shrink-0 border-b border-slate-100 bg-white">
    <div className="px-2.5 sm:px-5 py-2 sm:py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 shrink-0 text-slate-500" />
          <h2 className="min-w-0 truncate text-base sm:text-xl font-bold text-slate-900">
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

        <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 shrink-0">
          <button
            type="button"
            onClick={onPrevious}
            title={view === 'year' ? 'Previous year' : 'Previous month'}
            aria-label={view === 'year' ? 'Previous year' : 'Previous month'}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg inline-flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToday}
            className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-semibold text-slate-700 hover:bg-white transition-colors"
          >
            Today
          </button>

          <button
            type="button"
            onClick={onNext}
            title={view === 'year' ? 'Next year' : 'Next month'}
            aria-label={view === 'year' ? 'Next year' : 'Next month'}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg inline-flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-900 transition-colors"
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
    className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 shrink-0"
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
              : 'text-slate-500 hover:text-slate-900'
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
    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg inline-flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
  >
    {children}
  </button>
);

interface QuickAddTaskDialogProps {
  selectedDate: string;
  onClose: () => void;
  onSubmit: (title: string) => Promise<void>;
}

const QuickAddTaskDialog: React.FC<QuickAddTaskDialogProps> = ({
  selectedDate,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const clean = title.trim();
    if (!clean || saving) return;

    try {
      setSaving(true);
      await onSubmit(clean);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Add task"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
        <div className="text-sm font-bold">Add Task</div>
        <div className="mt-1 text-[10px] font-medium text-slate-500">
          {longDate(selectedDate)}
        </div>

        <input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
            if (event.key === 'Escape') onClose();
          }}
          placeholder="Task title"
          className="mt-3 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!title.trim() || saving}
            onClick={() => void submit()}
            className="h-10 rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-40"
          >
            {saving ? 'Adding...' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  );
};
