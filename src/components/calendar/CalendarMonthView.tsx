import React from 'react';
import type { HabitItem, TaskItem } from '../../types';
import { CalendarDayCell } from './CalendarDayCell';

export interface CalendarMonthViewProps {
  calendarDays: string[];
  selectedDate: string;
  today: string;
  currentMonth: string;
  tasksByDate: Map<string, TaskItem[]>;
  getHabitsForDate: (dateKey: string) => HabitItem[];
  onSelectDate: (dateKey: string) => void;
  onToggleTask: (taskId: string) => Promise<void>;
  onToggleHabit: (habit: HabitItem, dateKey: string) => Promise<void>;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE_ITEMS = 4;

function parseKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    '0'
  )}`;
}

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  calendarDays,
  selectedDate,
  today,
  currentMonth,
  tasksByDate,
  getHabitsForDate,
  onSelectDate,
  onToggleTask,
  onToggleHabit,
}) => (
  <section
    aria-label="Month calendar"
    className="h-full min-h-[460px] sm:min-h-[560px] flex flex-col bg-white"
  >
    <div className="grid grid-cols-7 border-b border-slate-100 bg-white shrink-0">
      {WEEKDAY_LABELS.map((day) => (
        <div
          key={day}
          className="h-8 sm:h-9 flex items-center justify-center sm:justify-start px-1 sm:px-2 text-[9px] sm:text-[11px] font-semibold text-slate-400"
        >
          <span className="sm:hidden">{day.slice(0, 1)}</span>
          <span className="hidden sm:inline">{day}</span>
        </div>
      ))}
    </div>

    <div className="flex-1 grid grid-cols-7 grid-rows-6 min-h-0 border-l border-slate-100">
      {calendarDays.map((dateKey) => {
        const date = parseKey(dateKey);

        return (
          <CalendarDayCell
            key={dateKey}
            dateKey={dateKey}
            inMonth={monthKey(date) === currentMonth}
            isToday={dateKey === today}
            isSelected={dateKey === selectedDate}
            isFuture={dateKey > today}
            tasks={tasksByDate.get(dateKey) || []}
            habits={getHabitsForDate(dateKey)}
            onSelectDate={onSelectDate}
            onToggleTask={onToggleTask}
            onToggleHabit={onToggleHabit}
            maxVisibleItems={MAX_VISIBLE_ITEMS}
          />
        );
      })}
    </div>
  </section>
);
