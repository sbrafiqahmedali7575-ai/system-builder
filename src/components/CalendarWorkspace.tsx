import React, { useCallback, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import { HabitItem, TaskItem, ToolsDensity } from '../types';
import {
  CONFIGURED_TIMEZONE,
  getIsoDateKeyInTimezone,
} from '../utils/taskDateUtils';
import { isHabitDue } from '../utils/habitUtils';

export type CalendarView =
  | 'year'
  | 'month'
  | 'week'
  | 'day'
  | 'agenda'
  | 'multi-day'
  | 'multi-week';

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

export interface CalendarBaseViewProps {
  today: string;
  selectedDate: string;
  cursor: Date;
  tasks: TaskItem[];
  habits: HabitItem[];
  tasksByDate: Map<string, TaskItem[]>;
  showCompleted: boolean;
  showHabits: boolean;
  onSelectDate: (dateKey: string) => void;
  onToggleTask: (taskId: string) => Promise<void>;
  onToggleHabit: (habit: HabitItem, dateKey: string) => Promise<void>;
  getHabitsForDate: (dateKey: string) => HabitItem[];
  getDaySummary: (dateKey: string) => CalendarDaySummary;
}

const CALENDAR_VIEWS: CalendarViewOption[] = [
  { id: 'year', label: 'Year' },
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'day', label: 'Day' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'multi-day', label: 'Multi-Day' },
  { id: 'multi-week', label: 'Multi-Week' },
];

const MULTI_DAY_SPAN = 3;
const MULTI_WEEK_SPAN = 4;

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

function addDays(dateKey: string, amount: number): string {
  const date = parseKey(dateKey);
  date.setUTCDate(date.getUTCDate() + amount);
  return keyFromDate(date);
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

function getMonday(dateKey: string): string {
  const date = parseKey(dateKey);
  const weekday = date.getUTCDay();
  return addDays(dateKey, weekday === 0 ? -6 : 1 - weekday);
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
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
  );
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
  onUpdateTask,
  onToggleTaskStatus,
  onUpdateHabit,
  density = 'compact',
}) => {
  const today = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);
  const todayDate = useMemo(() => parseKey(today), [today]);

  const [view, setView] = useState<CalendarView>('month');
  const [selectedDate, setSelectedDate] = useState(today);
  const [cursor, setCursor] = useState<Date>(startOfMonth(todayDate));
  const [showCompleted, setShowCompleted] = useState(true);
  const [showHabits, setShowHabits] = useState(true);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);

  const compact = density === 'compact';

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskItem[]>();

    tasks.forEach((task) => {
      if (!showCompleted && task.isCompleted) return;

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
  }, [tasks, showCompleted]);

  const getHabitsForDate = useCallback(
    (dateKey: string): HabitItem[] =>
      showHabits
        ? habits.filter((habit) => isHabitDue(habit, dateKey))
        : [],
    [habits, showHabits]
  );

  const getDaySummary = useCallback(
    (dateKey: string): CalendarDaySummary => {
      const dayTasks = tasksByDate.get(dateKey) || [];
      const dayHabits = getHabitsForDate(dateKey);

      const completedTasks = dayTasks.filter(
        (task) => task.isCompleted
      ).length;

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
    [tasksByDate, getHabitsForDate]
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

  const weekDates = useMemo(() => {
    const monday = getMonday(selectedDate);
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  }, [selectedDate]);

  const multiDayDates = useMemo(
    () =>
      Array.from({ length: MULTI_DAY_SPAN }, (_, index) =>
        addDays(selectedDate, index)
      ),
    [selectedDate]
  );

  const multiWeekDates = useMemo(() => {
    const start = getMonday(selectedDate);
    return Array.from({ length: MULTI_WEEK_SPAN * 7 }, (_, index) =>
      addDays(start, index)
    );
  }, [selectedDate]);

  const agendaDates = useMemo(() => {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const days = getDaysInMonth(year, month);

    return Array.from({ length: days }, (_, index) =>
      keyFromDate(new Date(Date.UTC(year, month, index + 1)))
    );
  }, [cursor]);

  const agendaDatesWithItems = useMemo(
    () =>
      agendaDates.filter((dateKey) => {
        const dayTasks = tasksByDate.get(dateKey) || [];
        const dayHabits = getHabitsForDate(dateKey);
        return dayTasks.length > 0 || dayHabits.length > 0;
      }),
    [agendaDates, tasksByDate, getHabitsForDate]
  );

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
      setViewMenuOpen(false);
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

  const navigateDays = useCallback(
    (amount: number) => {
      const next = addDays(selectedDate, amount);
      setSelectedDate(next);
      setCursor(startOfMonth(parseKey(next)));
    },
    [selectedDate]
  );

  const navigatePeriod = useCallback(
    (direction: -1 | 1) => {
      switch (view) {
        case 'year':
          navigateYear(direction);
          return;
        case 'month':
        case 'agenda':
          navigateMonth(direction);
          return;
        case 'week':
          navigateDays(direction * 7);
          return;
        case 'day':
          navigateDays(direction);
          return;
        case 'multi-day':
          navigateDays(direction * MULTI_DAY_SPAN);
          return;
        case 'multi-week':
          navigateDays(direction * MULTI_WEEK_SPAN * 7);
          return;
      }
    },
    [view, navigateYear, navigateMonth, navigateDays]
  );

  const periodLabel = useMemo(() => {
    switch (view) {
      case 'year':
        return String(cursor.getUTCFullYear());

      case 'month':
        return cursor.toLocaleDateString('en-US', {
          month: 'long',
          timeZone: 'UTC',
        });

      case 'agenda':
        return cursor.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        });

      case 'week': {
        const first = parseKey(weekDates[0]);
        const last = parseKey(weekDates[6]);

        return `${first.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        })} – ${last.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        })}`;
      }

      case 'day':
        return longDate(selectedDate);

      case 'multi-day': {
        const first = parseKey(multiDayDates[0]);
        const last = parseKey(multiDayDates[multiDayDates.length - 1]);

        return `${first.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        })} – ${last.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        })}`;
      }

      case 'multi-week': {
        const first = parseKey(multiWeekDates[0]);
        const last = parseKey(multiWeekDates[multiWeekDates.length - 1]);

        return `${first.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        })} – ${last.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        })}`;
      }
    }
  }, [
    view,
    cursor,
    selectedDate,
    weekDates,
    multiDayDates,
    multiWeekDates,
  ]);

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

  const moveTask = useCallback(
    async (task: TaskItem, targetDate: string) => {
      if (task.taskKey === targetDate) return;

      await onUpdateTask({
        ...task,
        taskKey: targetDate,
        updatedAt: new Date().toISOString(),
      });
    },
    [onUpdateTask]
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

  const moveHabitOccurrence = useCallback(
    async (
      habit: HabitItem,
      sourceDate: string,
      targetDate: string
    ) => {
      if (!targetDate || sourceDate === targetDate) return;

      const skippedDates = new Set(habit.skippedDates || []);
      const extraDates = new Set(habit.extraDates || []);

      /*
       * If the source is an extra occurrence, remove that exception.
       * Otherwise suppress the original recurring occurrence.
       */
      if (extraDates.has(sourceDate)) {
        extraDates.delete(sourceDate);
      } else {
        skippedDates.add(sourceDate);
      }

      /*
       * If the target date was previously skipped, restore it.
       * Otherwise create a one-off occurrence when needed.
       */
      if (skippedDates.has(targetDate)) {
        skippedDates.delete(targetDate);
      }

      if (!isHabitDue({ ...habit, skippedDates: [], extraDates: [] }, targetDate)) {
        extraDates.add(targetDate);
      }

      const sourceChecked = habit.checkIns.includes(sourceDate);
      let checkIns = habit.checkIns.filter((key) => key !== sourceDate);

      if (sourceChecked && targetDate <= today) {
        checkIns = [...new Set([...checkIns, targetDate])].sort();
      }

      await onUpdateHabit({
        ...habit,
        skippedDates: [...skippedDates].sort(),
        extraDates: [...extraDates].sort(),
        checkIns,
        updatedAt: new Date().toISOString(),
      });
    },
    [onUpdateHabit, today]
  );

  const commonViewProps: CalendarBaseViewProps = {
    today,
    selectedDate,
    cursor,
    tasks,
    habits,
    tasksByDate,
    showCompleted,
    showHabits,
    onSelectDate: selectDate,
    onToggleTask: onToggleTaskStatus,
    onToggleHabit: toggleHabit,
    getHabitsForDate,
    getDaySummary,
  };

  return (
    <div
      className={`relative h-full min-h-[640px] lg:min-h-0 bg-white text-slate-900 flex flex-col overflow-hidden ${
        compact ? 'text-sm' : ''
      }`}
    >
      <CalendarTopBar
        view={view}
        periodLabel={periodLabel}
        viewMenuOpen={viewMenuOpen}
        onToggleViewMenu={() => setViewMenuOpen((current) => !current)}
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
            {...commonViewProps}
            year={cursor.getUTCFullYear()}
            onOpenMonth={(year, month) => {
              const target = new Date(Date.UTC(year, month, 1));
              setCursor(target);
              setSelectedDate(keyFromDate(target));
              setView('month');
              setViewMenuOpen(false);
            }}
          />
        )}

        {view === 'month' && (
          <CalendarMonthView
            {...commonViewProps}
            calendarDays={calendarDays}
            currentMonth={monthKey(cursor)}
          />
        )}

        {view === 'week' && (
          <CalendarWeekView
            {...commonViewProps}
            dates={weekDates}
            onMoveTask={moveTask}
            onMoveHabit={moveHabitOccurrence}
          />
        )}

        {view === 'day' && (
          <CalendarDayView
            {...commonViewProps}
            dateKey={selectedDate}
            onAddTask={addTaskToDate}
          />
        )}

        {view === 'agenda' && (
          <CalendarAgendaView
            {...commonViewProps}
            dates={agendaDatesWithItems}
          />
        )}

        {view === 'multi-day' && (
          <CalendarMultiDayView
            {...commonViewProps}
            dates={multiDayDates}
            onMoveTask={moveTask}
            onMoveHabit={moveHabitOccurrence}
          />
        )}

        {view === 'multi-week' && (
          <CalendarMultiWeekView
            {...commonViewProps}
            dates={multiWeekDates}
          />
        )}
      </div>

      <CalendarViewSwitcher value={view} onChange={changeView} />

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
  viewMenuOpen: boolean;
  onToggleViewMenu: () => void;
  onViewChange: (view: CalendarView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onAdd: () => void;
}

const CalendarTopBar: React.FC<CalendarTopBarProps> = ({
  view,
  periodLabel,
  viewMenuOpen,
  onToggleViewMenu,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
  onAdd,
}) => {
  const activeView = CALENDAR_VIEWS.find((option) => option.id === view);

  return (
    <header className="relative z-30 shrink-0 h-14 px-3 sm:px-5 flex items-center justify-between gap-3 border-b border-slate-100 bg-white">
      <div className="min-w-0 flex items-center gap-2">
        <CalendarDays className="w-5 h-5 shrink-0 text-slate-500" />
        <h2 className="min-w-0 truncate text-lg sm:text-xl font-bold">
          {periodLabel}
        </h2>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <ToolbarIconButton title="Add task" onClick={onAdd}>
          <Plus className="w-4 h-4" />
        </ToolbarIconButton>

        <div className="relative">
          <button
            type="button"
            onClick={onToggleViewMenu}
            aria-haspopup="menu"
            aria-expanded={viewMenuOpen}
            className="h-9 px-2.5 rounded-lg inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            {activeView?.label || 'Month'}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {viewMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-10 z-50 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
            >
              {CALENDAR_VIEWS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="menuitem"
                  onClick={() => onViewChange(option.id)}
                  className={`w-full h-8 px-2.5 rounded-lg text-left text-xs font-semibold ${
                    option.id === view
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <ToolbarIconButton title="Previous period" onClick={onPrevious}>
          <ChevronLeft className="w-4 h-4" />
        </ToolbarIconButton>

        <button
          type="button"
          onClick={onToday}
          className="h-9 px-2.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          Today
        </button>

        <ToolbarIconButton title="Next period" onClick={onNext}>
          <ChevronRight className="w-4 h-4" />
        </ToolbarIconButton>

        <ToolbarIconButton title="More calendar options">
          <MoreHorizontal className="w-4 h-4" />
        </ToolbarIconButton>
      </div>
    </header>
  );
};

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
    className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
  >
    {children}
  </button>
);

interface CalendarViewSwitcherProps {
  value: CalendarView;
  onChange: (view: CalendarView) => void;
}

const CalendarViewSwitcher: React.FC<CalendarViewSwitcherProps> = ({
  value,
  onChange,
}) => (
  <nav
    aria-label="Calendar view"
    className="absolute z-40 bottom-3 left-1/2 -translate-x-1/2 max-w-[96vw] flex items-center rounded-2xl bg-slate-800 p-1 shadow-xl overflow-x-auto"
  >
    {CALENDAR_VIEWS.map((option) => {
      const active = value === option.id;

      return (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`h-9 px-3 rounded-xl whitespace-nowrap text-xs font-semibold transition ${
            active
              ? 'bg-slate-600 text-white'
              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
        >
          {option.label}
        </button>
      );
    })}
  </nav>
);

interface CalendarYearViewProps extends CalendarBaseViewProps {
  year: number;
  onOpenMonth: (year: number, month: number) => void;
}

interface CalendarMonthViewProps extends CalendarBaseViewProps {
  calendarDays: string[];
  currentMonth: string;
}

interface CalendarWeekViewProps extends CalendarBaseViewProps {
  dates: string[];
  onMoveTask: (task: TaskItem, targetDate: string) => Promise<void>;
  onMoveHabit: (
    habit: HabitItem,
    sourceDate: string,
    targetDate: string
  ) => Promise<void>;
}

interface CalendarDayViewProps extends CalendarBaseViewProps {
  dateKey: string;
  onAddTask: (title: string, dateKey?: string) => Promise<void>;
}

interface CalendarAgendaViewProps extends CalendarBaseViewProps {
  dates: string[];
}

interface CalendarMultiDayViewProps extends CalendarBaseViewProps {
  dates: string[];
  onMoveTask: (task: TaskItem, targetDate: string) => Promise<void>;
  onMoveHabit: (
    habit: HabitItem,
    sourceDate: string,
    targetDate: string
  ) => Promise<void>;
}

interface CalendarMultiWeekViewProps extends CalendarBaseViewProps {
  dates: string[];
}

const CalendarYearView: React.FC<CalendarYearViewProps> = ({
  year,
  onOpenMonth,
}) => (
  <CalendarPlaceholder
    title={`${year} • Year View`}
    description="12-month overview placeholder. Replace with CalendarYearView.tsx."
  >
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 12 }, (_, month) => (
        <button
          key={month}
          type="button"
          onClick={() => onOpenMonth(year, month)}
          className="min-h-32 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-blue-300 hover:bg-blue-50/20"
        >
          <div className="font-bold">
            {new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-US', {
              month: 'long',
              timeZone: 'UTC',
            })}
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            Mini month placeholder
          </div>
        </button>
      ))}
    </div>
  </CalendarPlaceholder>
);

const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  calendarDays,
  selectedDate,
  today,
  currentMonth,
  tasksByDate,
  getHabitsForDate,
  onSelectDate,
}) => (
  <div className="h-full min-h-[560px] flex flex-col">
    <div className="grid grid-cols-7 border-b border-slate-100">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
        <div
          key={day}
          className="h-9 flex items-center px-2 text-[11px] font-medium text-slate-400"
        >
          {day}
        </div>
      ))}
    </div>

    <div className="flex-1 grid grid-cols-7 grid-rows-6">
      {calendarDays.map((dateKey) => {
        const date = parseKey(dateKey);
        const inMonth = monthKey(date) === currentMonth;
        const isToday = dateKey === today;
        const isSelected = dateKey === selectedDate;
        const dayTasks = tasksByDate.get(dateKey) || [];
        const dayHabits = getHabitsForDate(dateKey);

        return (
          <button
            key={dateKey}
            type="button"
            onClick={() => onSelectDate(dateKey)}
            aria-pressed={isSelected}
            className={`min-h-[92px] sm:min-h-[110px] p-1.5 text-left border-r border-b border-slate-100 hover:bg-slate-50 transition-colors ${
              !inMonth ? 'bg-slate-50/40 text-slate-300' : ''
            } ${isSelected ? 'bg-blue-50/40' : ''}`}
          >
            <span
              className={`w-7 h-7 rounded-full inline-flex items-center justify-center text-xs font-semibold ${
                isToday ? 'bg-blue-600 text-white' : ''
              }`}
            >
              {date.getUTCDate()}
            </span>

            <div className="mt-1 hidden sm:block space-y-0.5">
              {dayTasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className={`truncate rounded-[3px] px-1.5 py-0.5 text-[9px] font-medium ${
                    task.isCompleted
                      ? 'bg-slate-100 text-slate-500 line-through'
                      : task.matrixQuadrant === 'urgent-important'
                      ? 'bg-rose-100 text-rose-800'
                      : task.matrixQuadrant === 'important'
                      ? 'bg-blue-100 text-blue-800'
                      : task.matrixQuadrant === 'urgent'
                      ? 'bg-amber-100 text-amber-800'
                      : task.matrixQuadrant === 'neither'
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {task.taskOfTheDay}
                </div>
              ))}

              {dayTasks.length > 3 && (
                <div className="px-1 text-[9px] font-semibold text-slate-500">
                  +{dayTasks.length - 3} more
                </div>
              )}

              {dayHabits.length > 0 && (
                <div className="truncate rounded-[3px] bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-800">
                  {dayHabits.length} habit{dayHabits.length === 1 ? '' : 's'}
                </div>
              )}
            </div>

            <div className="mt-1 sm:hidden flex items-center gap-1 text-[8px] font-bold">
              {dayTasks.length > 0 && (
                <span className="text-blue-600">{dayTasks.length}T</span>
              )}
              {dayHabits.length > 0 && (
                <span className="text-emerald-600">{dayHabits.length}H</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({ dates }) => (
  <CalendarPlaceholder
    title="Week View"
    description="Typed placeholder. Existing drag/reschedule callbacks are available to the future child component."
  >
    <PlaceholderDateGrid dates={dates} />
  </CalendarPlaceholder>
);

const CalendarDayView: React.FC<CalendarDayViewProps> = ({
  dateKey,
  getDaySummary,
}) => {
  const summary = getDaySummary(dateKey);

  return (
    <CalendarPlaceholder
      title={longDate(dateKey)}
      description="Typed Day view placeholder."
    >
      <div className="grid grid-cols-3 gap-2 max-w-xl">
        <SummaryTile label="Tasks" value={summary.tasks.length} />
        <SummaryTile label="Habits" value={summary.habits.length} />
        <SummaryTile
          label="Completion"
          value={
            summary.completionRate === null
              ? '—'
              : `${summary.completionRate}%`
          }
        />
      </div>
    </CalendarPlaceholder>
  );
};

const CalendarAgendaView: React.FC<CalendarAgendaViewProps> = ({
  dates,
  getDaySummary,
  onSelectDate,
}) => (
  <CalendarPlaceholder
    title="Agenda"
    description="Typed monthly agenda placeholder."
  >
    <div className="space-y-2">
      {dates.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm font-semibold text-slate-400">
          Nothing scheduled this month
        </div>
      )}

      {dates.map((dateKey) => {
        const summary = getDaySummary(dateKey);

        return (
          <button
            key={dateKey}
            type="button"
            onClick={() => onSelectDate(dateKey)}
            className="w-full rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50"
          >
            <div className="font-bold">{longDate(dateKey)}</div>
            <div className="mt-1 text-xs text-slate-500">
              {summary.tasks.length} task
              {summary.tasks.length === 1 ? '' : 's'} •{' '}
              {summary.habits.length} habit
              {summary.habits.length === 1 ? '' : 's'}
            </div>
          </button>
        );
      })}
    </div>
  </CalendarPlaceholder>
);

const CalendarMultiDayView: React.FC<CalendarMultiDayViewProps> = ({
  dates,
}) => (
  <CalendarPlaceholder
    title="Multi-Day"
    description={`${dates.length}-day planning placeholder.`}
  >
    <PlaceholderDateGrid dates={dates} />
  </CalendarPlaceholder>
);

const CalendarMultiWeekView: React.FC<CalendarMultiWeekViewProps> = ({
  dates,
}) => (
  <CalendarPlaceholder
    title="Multi-Week"
    description={`${Math.ceil(dates.length / 7)}-week planning placeholder.`}
  >
    <PlaceholderDateGrid dates={dates} />
  </CalendarPlaceholder>
);

interface CalendarPlaceholderProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

const CalendarPlaceholder: React.FC<CalendarPlaceholderProps> = ({
  title,
  description,
  children,
}) => (
  <section className="p-3 sm:p-5">
    <div className="mb-4">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1 text-xs font-medium text-slate-500">{description}</p>
    </div>
    {children}
  </section>
);

const PlaceholderDateGrid: React.FC<{ dates: string[] }> = ({ dates }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
    {dates.map((dateKey) => (
      <div
        key={dateKey}
        className="min-h-28 rounded-xl border border-slate-200 bg-white p-3"
      >
        <div className="text-xs font-bold">{longDate(dateKey)}</div>
      </div>
    ))}
  </div>
);

const SummaryTile: React.FC<{
  label: string;
  value: React.ReactNode;
}> = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="text-lg font-black">{value}</div>
    <div className="mt-0.5 text-[9px] uppercase tracking-wider font-black text-slate-400">
      {label}
    </div>
  </div>
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
