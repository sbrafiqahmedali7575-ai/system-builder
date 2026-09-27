import React from 'react';
import type { HabitItem, TaskItem } from '../../types';
import { CalendarEventChip } from './CalendarEventChip';

export interface CalendarDayCellProps {
  dateKey: string;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isFuture: boolean;
  tasks: TaskItem[];
  habits: HabitItem[];
  onSelectDate: (dateKey: string) => void;
  onShowMore: (dateKey: string) => void;
  onToggleTask: (taskId: string) => Promise<void>;
  onToggleHabit: (habit: HabitItem, dateKey: string) => Promise<void>;
  maxVisibleItems?: number;
}

function parseKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
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

export const CalendarDayCell: React.FC<CalendarDayCellProps> = ({
  dateKey,
  inMonth,
  isToday,
  isSelected,
  isFuture,
  tasks,
  habits,
  onSelectDate,
  onShowMore,
  onToggleTask,
  onToggleHabit,
  maxVisibleItems = 4,
}) => {
  const date = parseKey(dateKey);

  const visibleTasks = tasks.slice(0, maxVisibleItems);
  const remainingSlots = Math.max(
    0,
    maxVisibleItems - visibleTasks.length
  );
  const visibleHabits = habits.slice(0, remainingSlots);

  const hiddenCount =
    Math.max(0, tasks.length - visibleTasks.length) +
    Math.max(0, habits.length - visibleHabits.length);

  return (
    <div
      className={`relative min-w-0 min-h-[76px] sm:min-h-[108px] border-r border-b border-slate-100 transition-colors ${
        !inMonth
          ? 'bg-slate-50/40'
          : isSelected
          ? 'bg-blue-50/45'
          : 'bg-white hover:bg-slate-50/70'
      }`}
    >
      <button
        type="button"
        onClick={() => onSelectDate(dateKey)}
        aria-label={`Select ${longDate(dateKey)}`}
        aria-pressed={isSelected}
        className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
      />

      <div className="relative z-10 p-1 sm:p-1.5 pointer-events-none">
        <div className="flex items-start justify-between gap-1">
          <button
            type="button"
            onClick={() => onSelectDate(dateKey)}
            className={`pointer-events-auto w-6 h-6 sm:w-7 sm:h-7 rounded-full inline-flex items-center justify-center text-[10px] sm:text-xs font-semibold transition-colors ${
              isToday
                ? 'bg-blue-600 text-white shadow-sm'
                : isSelected
                ? 'bg-blue-100 text-blue-700'
                : inMonth
                ? 'text-slate-700 hover:bg-slate-100'
                : 'text-slate-300 hover:bg-slate-100/70'
            }`}
            aria-label={`Select ${longDate(dateKey)}`}
            aria-current={isToday ? 'date' : undefined}
          >
            {date.getUTCDate()}
          </button>

          <div className="hidden sm:flex items-center gap-1 pt-0.5 text-[8px] font-bold text-slate-400">
            {tasks.length > 0 && <span>{tasks.length}T</span>}
            {habits.length > 0 && <span>{habits.length}H</span>}
          </div>
        </div>

        <div className="hidden sm:block mt-0.5 space-y-[2px]">
          {visibleTasks.map((task) => (
            <CalendarEventChip
              key={task.id}
              kind="task"
              task={task}
              disabled={isFuture}
              onClick={() => void onToggleTask(task.id)}
            />
          ))}

          {visibleHabits.map((habit) => (
            <CalendarEventChip
              key={habit.id}
              kind="habit"
              habit={habit}
              checked={habit.checkIns.includes(dateKey)}
              disabled={isFuture}
              onClick={() => void onToggleHabit(habit, dateKey)}
            />
          ))}

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => {
                onSelectDate(dateKey);
                onShowMore(dateKey);
              }}
              className="pointer-events-auto h-[18px] px-1 text-[9px] font-semibold text-slate-500 hover:text-blue-600"
              title={`${hiddenCount} more item${hiddenCount === 1 ? '' : 's'}`}
            >
              +{hiddenCount} more
            </button>
          )}
        </div>

        <div className="sm:hidden mt-1 flex flex-wrap items-center gap-1">
          {tasks.length > 0 || habits.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                onSelectDate(dateKey);
                onShowMore(dateKey);
              }}
              className="pointer-events-auto inline-flex items-center gap-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={`View items for ${longDate(dateKey)}`}
            >
              {tasks.length > 0 && (
                <span className="inline-flex min-w-5 h-4 px-1 rounded-full bg-blue-100 text-blue-700 items-center justify-center text-[8px] font-black">
                  {tasks.length}T
                </span>
              )}

              {habits.length > 0 && (
                <span className="inline-flex min-w-5 h-4 px-1 rounded-full bg-emerald-100 text-emerald-700 items-center justify-center text-[8px] font-black">
                  {habits.length}H
                </span>
              )}
            </button>
          ) : (
            isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          )}
        </div>
      </div>
    </div>
  );
};
