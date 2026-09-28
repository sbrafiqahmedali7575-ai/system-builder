import React, { useMemo } from 'react';
import { Repeat2, Target } from 'lucide-react';
import { DashboardTheme, HabitItem, TaskItem } from '../types';
import {
  CONFIGURED_TIMEZONE,
  areDatesEqual,
} from '../utils/taskDateUtils';
import { useCurrentDateKey } from '../hooks/useCurrentDateKey';
import {
  addHabitDays,
  isHabitDue,
  parseHabitDateKey,
} from '../utils/habitUtils';

const FULL_WEEK_PERCENT_CAPACITY = 700;
const WEEKLY_TARGET_PERCENTAGE = 80;

interface WeeklyProgressCardsProps {
  tasks: TaskItem[];
  habits: HabitItem[];
  theme: DashboardTheme;
}

export const WeeklyProgressCards: React.FC<WeeklyProgressCardsProps> = ({
  tasks,
  habits,
  theme,
}) => {
  const isDark = theme === 'dark';
  const today = useCurrentDateKey(CONFIGURED_TIMEZONE);

  const weekTaskTrend = useMemo(() => {
    const todayDate = parseHabitDateKey(today);
    const day = todayDate.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = addHabitDays(today, mondayOffset);

    return Array.from({ length: 7 }, (_, index) => {
      const dateKey = addHabitDays(monday, index);
      const date = parseHabitDateKey(dateKey);
      const dayTasks = tasks.filter((task) =>
        areDatesEqual(task.taskKey, dateKey)
      );
      const completed = dayTasks.filter((task) => task.isCompleted).length;
      const future = dateKey > today;

      return {
        dateKey,
        label: date
          .toLocaleDateString('en-US', {
            weekday: 'short',
            timeZone: 'UTC',
          })
          .slice(0, 1),
        total: dayTasks.length,
        completed,
        rate: dayTasks.length
          ? Math.round((completed / dayTasks.length) * 100)
          : 0,
        future,
      };
    });
  }, [tasks, today]);

  const weekTaskScore = useMemo(() => {
    const totalDailyPercentage = weekTaskTrend.reduce(
      (sum, day) => sum + (day.future ? 0 : day.rate),
      0
    );

    return Math.round(
      (totalDailyPercentage / FULL_WEEK_PERCENT_CAPACITY) * 1000
    ) / 10;
  }, [weekTaskTrend]);

  const weekHabitTrend = useMemo(() => {
    const todayDate = parseHabitDateKey(today);
    const day = todayDate.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = addHabitDays(today, mondayOffset);

    return Array.from({ length: 7 }, (_, index) => {
      const dateKey = addHabitDays(monday, index);
      const date = parseHabitDateKey(dateKey);
      const due = habits.filter((habit) => isHabitDue(habit, dateKey));
      const completed = due.filter((habit) =>
        habit.checkIns.includes(dateKey)
      ).length;
      const future = dateKey > today;

      return {
        dateKey,
        label: date
          .toLocaleDateString('en-US', {
            weekday: 'short',
            timeZone: 'UTC',
          })
          .slice(0, 1),
        due: due.length,
        completed,
        rate: due.length ? Math.round((completed / due.length) * 100) : 0,
        future,
      };
    });
  }, [habits, today]);

  const weekHabitScore = useMemo(() => {
    const totalDailyPercentage = weekHabitTrend.reduce(
      (sum, day) => sum + (day.future ? 0 : day.rate),
      0
    );

    return Math.round(
      (totalDailyPercentage / FULL_WEEK_PERCENT_CAPACITY) * 1000
    ) / 10;
  }, [weekHabitTrend]);

  return (
    <section
      aria-label="Weekly progress"
      className="grid grid-cols-1 md:grid-cols-2 gap-2"
    >
      <div
        className={`rounded-2xl border p-2.5 ${
          isDark
            ? 'bg-slate-900/80 border-slate-800'
            : 'bg-slate-50/70 border-slate-200/80'
        }`}
      >
        <div className="flex flex-col xs:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Target className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="truncate text-[10px] uppercase tracking-wider font-black text-slate-600 dark:text-slate-300">
              This week · tasks
            </span>
          </div>
          <div
            className="w-full sm:w-[180px] sm:shrink-0"
            title={`Weekly task score: ${weekTaskScore.toFixed(1)}% of the full 700% weekly capacity. Target: ${WEEKLY_TARGET_PERCENTAGE}%.`}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                {weekTaskScore.toFixed(1)}%
              </span>
              <span className="text-[7px] font-bold uppercase tracking-wide text-slate-400">
                Target {WEEKLY_TARGET_PERCENTAGE}%
              </span>
            </div>
            <div
              className="relative h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-visible"
              role="progressbar"
              aria-label="Weekly task progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={weekTaskScore}
              aria-valuetext={`${weekTaskScore.toFixed(1)}%, target ${WEEKLY_TARGET_PERCENTAGE}%`}
            >
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, weekTaskScore))}%` }}
              />
              <span
                className="absolute -top-1 h-4 w-0.5 rounded-full bg-slate-700 dark:bg-slate-200"
                style={{ left: `${WEEKLY_TARGET_PERCENTAGE}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weekTaskTrend.map((day) => (
            <div
              key={day.dateKey}
              className="min-w-0 text-center"
              title={
                day.future
                  ? `${day.dateKey}: future`
                  : `${day.dateKey}: ${day.completed}/${day.total} tasks completed (${day.rate}%)`
              }
            >
              <div className="relative h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-end overflow-hidden">
                {!day.future && (
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      day.total > 0
                        ? 'bg-blue-500'
                        : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                    style={{
                      height:
                        day.total === 0
                          ? '4px'
                          : `${Math.max(8, day.rate)}%`,
                    }}
                  />
                )}
                <span
                  className={`absolute inset-0 flex items-center justify-center text-[9px] font-black tabular-nums ${
                    day.future
                      ? 'text-slate-300 dark:text-slate-600'
                      : day.rate >= 45 && day.total > 0
                      ? 'text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {day.future ? '—' : `${day.rate}%`}
                </span>
              </div>
              <div
                className={`mt-1 text-[9px] font-black ${
                  day.dateKey === today
                    ? 'text-blue-600 dark:text-blue-300'
                    : 'text-slate-400'
                }`}
              >
                {day.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className={`rounded-2xl border p-2.5 ${
          isDark
            ? 'bg-slate-900/80 border-slate-800'
            : 'bg-slate-50/70 border-slate-200/80'
        }`}
      >
        <div className="flex flex-col xs:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Repeat2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="truncate text-[10px] uppercase tracking-wider font-black text-slate-600 dark:text-slate-300">
              This week · habits
            </span>
          </div>
          <div
            className="w-full sm:w-[180px] sm:shrink-0"
            title={`Weekly habit score: ${weekHabitScore.toFixed(1)}% of the full 700% weekly capacity. Target: ${WEEKLY_TARGET_PERCENTAGE}%.`}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                {weekHabitScore.toFixed(1)}%
              </span>
              <span className="text-[7px] font-bold uppercase tracking-wide text-slate-400">
                Target {WEEKLY_TARGET_PERCENTAGE}%
              </span>
            </div>
            <div
              className="relative h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-visible"
              role="progressbar"
              aria-label="Weekly habit progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={weekHabitScore}
              aria-valuetext={`${weekHabitScore.toFixed(1)}%, target ${WEEKLY_TARGET_PERCENTAGE}%`}
            >
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, weekHabitScore))}%` }}
              />
              <span
                className="absolute -top-1 h-4 w-0.5 rounded-full bg-slate-700 dark:bg-slate-200"
                style={{ left: `${WEEKLY_TARGET_PERCENTAGE}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weekHabitTrend.map((day) => (
            <div
              key={day.dateKey}
              className="min-w-0 text-center"
              title={
                day.future
                  ? `${day.dateKey}: future`
                  : `${day.dateKey}: ${day.completed}/${day.due} habits completed (${day.rate}%)`
              }
            >
              <div className="relative h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-end overflow-hidden">
                {!day.future && (
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      day.due > 0
                        ? 'bg-blue-500'
                        : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                    style={{
                      height:
                        day.due === 0
                          ? '4px'
                          : `${Math.max(8, day.rate)}%`,
                    }}
                  />
                )}
                <span
                  className={`absolute inset-0 flex items-center justify-center text-[9px] font-black tabular-nums ${
                    day.future
                      ? 'text-slate-300 dark:text-slate-600'
                      : day.rate >= 45 && day.due > 0
                      ? 'text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {day.future ? '—' : `${day.rate}%`}
                </span>
              </div>
              <div
                className={`mt-1 text-[9px] font-black ${
                  day.dateKey === today
                    ? 'text-emerald-600 dark:text-blue-300'
                    : 'text-slate-400'
                }`}
              >
                {day.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
