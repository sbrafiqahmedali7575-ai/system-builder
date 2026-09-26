import React, { useMemo } from 'react';
import { AlertTriangle, Award, Hourglass, Lightbulb, Repeat2, Target } from 'lucide-react';
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

interface DailyInsightsCardProps {
  tasks: TaskItem[];
  habits: HabitItem[];
  theme: DashboardTheme;
  currentWeekCadencePercentage: number;
  overallCompletionPercentage: number;
  completedDays: number;
  totalDays: number;
  countdownDaysRemaining: number;
  countdownReason: string;
  countdownTargetLabel: string;
  onOpenCountdown?: () => void;
}

export const DailyInsightsCard: React.FC<DailyInsightsCardProps> = ({
  tasks,
  habits,
  theme,
  currentWeekCadencePercentage,
  overallCompletionPercentage,
  completedDays,
  totalDays,
  countdownDaysRemaining,
  countdownReason,
  countdownTargetLabel,
  onOpenCountdown,
}) => {
  const isDark = theme === 'dark';
  const today = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);

  const todayTasks = useMemo(
    () => tasks.filter((task) => areDatesEqual(task.taskKey, today)),
    [tasks, today]
  );

  const completedToday = todayTasks.filter((task) => task.isCompleted).length;

  const dueHabits = useMemo(
    () => habits.filter((habit) => isHabitDue(habit, today)),
    [habits, today]
  );
  const completedHabitsToday = dueHabits.filter((habit) =>
    habit.checkIns.includes(today)
  ).length;

  const overdueTasks = useMemo(
    () =>
      tasks
        .filter((task) => !task.isCompleted && task.taskKey < today)
        .sort((a, b) => a.taskKey.localeCompare(b.taskKey)),
    [tasks, today]
  );

  const weekTaskTrend = useMemo(() => {
    const todayDate = parseHabitDateKey(today);
    const day = todayDate.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = addHabitDays(today, mondayOffset);

    return Array.from({ length: 7 }, (_, index) => {
      const dateKey = addHabitDays(monday, index);
      const date = parseHabitDateKey(dateKey);
      const dayTasks = tasks.filter((task) => areDatesEqual(task.taskKey, dateKey));
      const completed = dayTasks.filter((task) => task.isCompleted).length;
      const future = dateKey > today;

      return {
        dateKey,
        label: date.toLocaleDateString('en-US', {
          weekday: 'short',
          timeZone: 'UTC',
        }).slice(0, 1),
        total: dayTasks.length,
        completed,
        rate: dayTasks.length ? Math.round((completed / dayTasks.length) * 100) : 0,
        future,
      };
    });
  }, [tasks, today]);

  const weekTaskSummary = useMemo(() => {
    const elapsedDays = weekTaskTrend.filter((day) => !day.future);
    const scheduled = elapsedDays.reduce((sum, day) => sum + day.total, 0);
    const completed = elapsedDays.reduce((sum, day) => sum + day.completed, 0);

    return {
      scheduled,
      completed,
      rate: scheduled ? Math.round((completed / scheduled) * 100) : 0,
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
        label: date.toLocaleDateString('en-US', {
          weekday: 'short',
          timeZone: 'UTC',
        }).slice(0, 1),
        due: due.length,
        completed,
        rate: due.length ? Math.round((completed / due.length) * 100) : 0,
        future,
      };
    });
  }, [habits, today]);

  const weekHabitSummary = useMemo(() => {
    const elapsedDays = weekHabitTrend.filter((day) => !day.future);
    const due = elapsedDays.reduce((sum, day) => sum + day.due, 0);
    const completed = elapsedDays.reduce((sum, day) => sum + day.completed, 0);

    return {
      due,
      completed,
      rate: due ? Math.round((completed / due) * 100) : 0,
    };
  }, [weekHabitTrend]);


  const overallWeekSummary = useMemo(() => {
    const totalItems = weekTaskSummary.scheduled + weekHabitSummary.due;
    const completedItems =
      weekTaskSummary.completed + weekHabitSummary.completed;

    return {
      totalItems,
      completedItems,
      rate: totalItems
        ? Math.round((completedItems / totalItems) * 100)
        : 0,
    };
  }, [weekTaskSummary, weekHabitSummary]);

  return (
    <div
      aria-label="Daily Insights"
      className={`system-task-card ui-motion-section h-full min-h-0 overflow-hidden p-2 rounded-2xl border flex flex-col transition-all ${
        isDark
          ? 'bg-slate-900/80 border-slate-800'
          : 'bg-slate-50/70 border-slate-200/80'
      }`}
    >
      <div className="shrink-0 flex items-center gap-2 pb-1.5 mb-1.5 border-b border-slate-200/80 dark:border-slate-800">
        <span className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 flex items-center justify-center shrink-0">
          <Lightbulb className="w-4 h-4" />
        </span>
        <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
          Daily Insights
        </h2>
      </div>

      <div className="shrink-0 grid grid-cols-3 sm:grid-cols-5 gap-1 mb-1.5">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/50 px-2 py-1.5">
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-black text-slate-400">
            <Target className="w-3 h-3 text-blue-500" />
            Tasks
          </div>
          <div className="mt-0.5 text-sm font-black text-slate-800 dark:text-slate-100">
            {completedToday}/{todayTasks.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/50 px-2 py-1.5">
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-black text-slate-400">
            <Repeat2 className="w-3 h-3 text-emerald-500" />
            Habits
          </div>
          <div className="mt-0.5 text-sm font-black text-slate-800 dark:text-slate-100">
            {completedHabitsToday}/{dueHabits.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/50 px-2 py-1.5">
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-black text-slate-400">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            Overdue
          </div>
          <div className={`mt-0.5 text-sm font-black ${
            overdueTasks.length > 0
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-slate-800 dark:text-slate-100'
          }`}>
            {overdueTasks.length}
          </div>
        </div>
        <div
          className="rounded-xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/25 px-2 py-1.5"
          title={`Overall Completion: ${overallCompletionPercentage.toFixed(1)}% · ${completedDays}/${totalDays} days completed`}
        >
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-black text-slate-400">
            <Award className="w-3 h-3 text-blue-500" />
            Overall
          </div>
          <div className="mt-0.5 text-sm font-black font-mono text-blue-600 dark:text-blue-300">
            {overallCompletionPercentage.toFixed(1)}%
          </div>
          <div className="text-[8px] font-bold text-slate-400">
            {completedDays}/{totalDays} days
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenCountdown}
          disabled={!onOpenCountdown}
          className="rounded-xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/25 px-2 py-1.5 text-left transition-colors enabled:hover:bg-blue-100/80 dark:enabled:hover:bg-blue-950/45 disabled:cursor-default"
          title={`${countdownReason} · Target: ${countdownTargetLabel}${onOpenCountdown ? ' · Click to edit' : ''}`}
          aria-label={`${countdownDaysRemaining} days remaining. ${countdownReason}.`}
        >
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-black text-slate-400">
            <Hourglass className="w-3 h-3 text-blue-500" />
            Countdown
          </div>
          <div className="mt-0.5 text-sm font-black font-mono text-blue-600 dark:text-blue-300">
            {countdownDaysRemaining}
          </div>
          <div className="text-[8px] font-bold text-slate-400">
            days left
          </div>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5 space-y-1.5">

        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-white/80 dark:bg-slate-950/50 p-1.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Target className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="truncate text-[9px] sm:text-[10px] uppercase tracking-wider font-black text-slate-600 dark:text-slate-300">
                  This week · tasks
                </span>
              </div>
              <div
                className="text-right shrink-0"
                title={`Current week cadence: ${currentWeekCadencePercentage}%`}
              >
                <div className="text-[10px] font-black text-blue-600 dark:text-blue-400">
                  {currentWeekCadencePercentage}%
                </div>
                <div className="text-[7px] font-bold uppercase tracking-wide text-slate-400">
                  cadence
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
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
                  <div className="relative h-9 rounded-md bg-slate-100 dark:bg-slate-800 flex items-end overflow-hidden">
                    {!day.future && (
                      <div
                        className={`w-full rounded-t-sm transition-all ${
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
                      className={`absolute inset-0 flex items-center justify-center text-[8px] font-black tabular-nums ${
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
                  <div className={`mt-0.5 text-[8px] font-black ${
                    day.dateKey === today
                      ? 'text-blue-600 dark:text-blue-300'
                      : 'text-slate-400'
                  }`}>
                    {day.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-white/80 dark:bg-slate-950/50 p-1.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Repeat2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate text-[9px] sm:text-[10px] uppercase tracking-wider font-black text-slate-600 dark:text-slate-300">
                  This week · habits
                </span>
              </div>
              <div
                className="text-right shrink-0"
                title={`Overall week: ${overallWeekSummary.completedItems}/${overallWeekSummary.totalItems} tasks + due habits completed`}
              >
                <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                  {overallWeekSummary.rate}%
                </div>
                <div className="text-[7px] font-bold uppercase tracking-wide text-slate-400">
                  overall week
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
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
                  <div className="relative h-9 rounded-md bg-slate-100 dark:bg-slate-800 flex items-end overflow-hidden">
                    {!day.future && (
                      <div
                        className={`w-full rounded-t-sm transition-all ${
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
                      className={`absolute inset-0 flex items-center justify-center text-[8px] font-black tabular-nums ${
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
                  <div className={`mt-0.5 text-[8px] font-black ${
                    day.dateKey === today
                      ? 'text-emerald-600 dark:text-emerald-300'
                      : 'text-slate-400'
                  }`}>
                    {day.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>


      </div>
    </div>
  );
};
