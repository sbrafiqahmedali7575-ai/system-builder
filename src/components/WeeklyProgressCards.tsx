import React, { useMemo } from 'react';
import { Repeat2, Target } from 'lucide-react';
import { DashboardTheme, HabitItem, TaskItem } from '../types';
import {
  CONFIGURED_TIMEZONE,
  areDatesEqual,
  getIsoDateKeyInTimezone,
} from '../utils/taskDateUtils';
import {
  addHabitDays,
  isHabitDue,
  parseHabitDateKey,
} from '../utils/habitUtils';

interface WeeklyProgressCardsProps {
  tasks: TaskItem[];
  habits: HabitItem[];
  theme: DashboardTheme;
  currentWeekCadencePercentage: number;
}

export const WeeklyProgressCards: React.FC<WeeklyProgressCardsProps> = ({
  tasks,
  habits,
  theme,
  currentWeekCadencePercentage,
}) => {
  const isDark = theme === 'dark';
  const today = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);

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

  const weekTaskSummary = useMemo(() => {
    const elapsed = weekTaskTrend.filter((day) => !day.future);
    return {
      scheduled: elapsed.reduce((sum, day) => sum + day.total, 0),
      completed: elapsed.reduce((sum, day) => sum + day.completed, 0),
    };
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

  const weekHabitSummary = useMemo(() => {
    const elapsed = weekHabitTrend.filter((day) => !day.future);
    return {
      due: elapsed.reduce((sum, day) => sum + day.due, 0),
      completed: elapsed.reduce((sum, day) => sum + day.completed, 0),
    };
  }, [weekHabitTrend]);

  const overallWeekRate = useMemo(() => {
    const total = weekTaskSummary.scheduled + weekHabitSummary.due;
    const completed =
      weekTaskSummary.completed + weekHabitSummary.completed;
    return total ? Math.round((completed / total) * 100) : 0;
  }, [weekTaskSummary, weekHabitSummary]);

  return (
    <section
      aria-label="Weekly progress"
      className="grid grid-cols-1 md:grid-cols-2 gap-2"
    >
      <div
        className={`rounded-2xl border p-2.5 ${
          isDark
            ? 'bg-slate-900/80 border-blue-900/50'
            : 'bg-slate-50/70 border-blue-200/80'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Target className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="truncate text-[10px] uppercase tracking-wider font-black text-slate-600 dark:text-slate-300">
              This week · tasks
            </span>
          </div>
          <div
            className="text-right shrink-0"
            title={`Current week cadence: ${currentWeekCadencePercentage}%`}
          >
            <div className="text-xs font-black text-blue-600 dark:text-blue-400">
              {currentWeekCadencePercentage}%
            </div>
            <div className="text-[7px] font-bold uppercase tracking-wide text-slate-400">
              cadence
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
            ? 'bg-slate-900/80 border-emerald-900/50'
            : 'bg-slate-50/70 border-emerald-200/80'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Repeat2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate text-[10px] uppercase tracking-wider font-black text-slate-600 dark:text-slate-300">
              This week · habits
            </span>
          </div>
          <div
            className="text-right shrink-0"
            title={`Overall week completion: ${overallWeekRate}%`}
          >
            <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
              {overallWeekRate}%
            </div>
            <div className="text-[7px] font-bold uppercase tracking-wide text-slate-400">
              overall week
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
                        ? 'bg-emerald-500'
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
                    ? 'text-emerald-600 dark:text-emerald-300'
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
