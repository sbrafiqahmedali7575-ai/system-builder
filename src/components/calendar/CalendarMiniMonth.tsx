import React from 'react';

export interface CalendarMiniMonthDaySummary {
  totalItems: number;
  completedItems: number;
  completedTasks: number;
  completedHabits: number;
  completionRate: number | null;
  tasks: unknown[];
  habits: unknown[];
}

export interface CalendarMiniMonthProps {
  year: number;
  month: number;
  today: string;
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
  onOpenMonth: (year: number, month: number) => void;
  getDaySummary: (dateKey: string) => CalendarMiniMonthDaySummary;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function keyFromDate(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function parseKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
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

function activityClass(
  dateKey: string,
  today: string,
  totalItems: number,
  completionRate: number | null
): string {
  if (dateKey === today) {
    return 'bg-blue-600 text-white shadow-sm';
  }

  if (totalItems === 0 || completionRate === null) {
    return 'text-slate-600 hover:bg-slate-100';
  }

  if (completionRate >= 80) {
    return 'bg-blue-600 text-white hover:bg-blue-700';
  }

  if (completionRate >= 50) {
    return 'bg-blue-300 text-blue-950 hover:bg-blue-400';
  }

  if (completionRate > 0) {
    return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
  }

  return 'bg-blue-50 text-slate-600 hover:bg-blue-100';
}

export const CalendarMiniMonth: React.FC<CalendarMiniMonthProps> = ({
  year,
  month,
  today,
  selectedDate,
  onSelectDate,
  onOpenMonth,
  getDaySummary,
}) => {
  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthName = monthStart.toLocaleDateString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  });
  const leadingDays = monthStart.getUTCDay();
  const daysInMonth = getDaysInMonth(year, month);

  const monthCells = Array.from({ length: 42 }, (_, cellIndex) => {
    const dayNumber = cellIndex - leadingDays + 1;
    return dayNumber >= 1 && dayNumber <= daysInMonth ? dayNumber : null;
  });

  return (
    <article className="min-w-0">
      <button
        type="button"
        onClick={() => onOpenMonth(year, month)}
        className="mb-2.5 text-base sm:text-lg font-bold text-slate-900 hover:text-blue-600 transition-colors"
        aria-label={`Open ${monthName} ${year}`}
      >
        {monthName}
      </button>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="h-5 flex items-center justify-center text-[9px] font-semibold text-slate-400"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {monthCells.map((dayNumber, cellIndex) => {
          if (dayNumber === null) {
            return (
              <div
                key={`blank-${cellIndex}`}
                className="h-9"
                aria-hidden="true"
              />
            );
          }

          const dateKey = keyFromDate(
            new Date(Date.UTC(year, month, dayNumber))
          );
          const summary = getDaySummary(dateKey);
          const isSelected = dateKey === selectedDate;
          const isToday = dateKey === today;
          const taskCount = summary.tasks.length;
          const habitCount = summary.habits.length;

          const detailText = [
            taskCount
              ? `${taskCount} task${taskCount === 1 ? '' : 's'} (${summary.completedTasks} done)`
              : null,
            habitCount
              ? `${habitCount} habit${habitCount === 1 ? '' : 's'} (${summary.completedHabits} done)`
              : null,
          ]
            .filter(Boolean)
            .join(' • ');

          return (
            <div
              key={dateKey}
              className="h-9 flex flex-col items-center justify-start"
            >
              <button
                type="button"
                onClick={() => onSelectDate(dateKey)}
                aria-label={`${longDate(dateKey)}. ${summary.completedItems} of ${summary.totalItems} items completed.${
                  detailText ? ` ${detailText}.` : ''
                }`}
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                title={
                  summary.totalItems
                    ? `${longDate(dateKey)} • ${summary.completedItems}/${summary.totalItems} completed • ${detailText}`
                    : longDate(dateKey)
                }
                className={`mx-auto w-6 h-6 rounded-[4px] inline-flex items-center justify-center text-[10px] font-semibold transition-all ${activityClass(
                  dateKey,
                  today,
                  summary.totalItems,
                  summary.completionRate
                )} ${
                  isSelected && !isToday
                    ? 'ring-2 ring-blue-500 ring-offset-1'
                    : ''
                }`}
              >
                {dayNumber}
              </button>

              {(taskCount > 0 || habitCount > 0) && (
                <div
                  className="mt-0.5 h-2 flex items-center justify-center gap-0.5 leading-none"
                  aria-hidden="true"
                >
                  {taskCount > 0 && (
                    <span className="inline-flex items-center gap-[1px] text-[6px] font-black text-blue-600">
                      <span className="w-1 h-1 rounded-full bg-blue-500" />
                      T{taskCount > 9 ? '9+' : taskCount}
                    </span>
                  )}

                  {habitCount > 0 && (
                    <span className="inline-flex items-center gap-[1px] text-[6px] font-black text-emerald-600">
                      <span className="w-1 h-1 rounded-full bg-emerald-500" />
                      H{habitCount > 9 ? '9+' : habitCount}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
};
