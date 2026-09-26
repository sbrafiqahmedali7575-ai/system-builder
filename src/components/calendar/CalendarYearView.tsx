import React from 'react';
import { CalendarMiniMonth } from './CalendarMiniMonth';
import type { CalendarMiniMonthDaySummary } from './CalendarMiniMonth';

export interface CalendarYearViewProps {
  year: number;
  today: string;
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
  onOpenMonth: (year: number, month: number) => void;
  getDaySummary: (dateKey: string) => CalendarMiniMonthDaySummary;
}

export const CalendarYearView: React.FC<CalendarYearViewProps> = ({
  year,
  today,
  selectedDate,
  onSelectDate,
  onOpenMonth,
  getDaySummary,
}) => (
  <section
    aria-label={`${year} year calendar`}
    className="h-full overflow-auto overscroll-contain bg-white px-2.5 sm:px-4 py-3 sm:py-4"
  >
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 xl:gap-x-7 gap-y-5 sm:gap-y-6">
      {Array.from({ length: 12 }, (_, month) => (
        <CalendarMiniMonth
          key={month}
          year={year}
          month={month}
          today={today}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
          onOpenMonth={onOpenMonth}
          getDaySummary={getDaySummary}
        />
      ))}
    </div>

    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-2 text-[9px] font-semibold text-slate-400">
      <span>Completion intensity</span>

      <span className="inline-flex items-center gap-1">
        <span className="w-3 h-3 rounded-[3px] bg-blue-50 border border-blue-100" />
        0%
      </span>

      <span className="inline-flex items-center gap-1">
        <span className="w-3 h-3 rounded-[3px] bg-blue-100" />
        1–49%
      </span>

      <span className="inline-flex items-center gap-1">
        <span className="w-3 h-3 rounded-[3px] bg-blue-300" />
        50–79%
      </span>

      <span className="inline-flex items-center gap-1">
        <span className="w-3 h-3 rounded-[3px] bg-blue-600" />
        80–100%
      </span>

      <span className="ml-1 text-slate-300">•</span>

      <span className="inline-flex items-center gap-1 text-blue-600">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        T = Tasks
      </span>

      <span className="inline-flex items-center gap-1 text-emerald-600">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        H = Habits
      </span>
    </div>
  </section>
);
