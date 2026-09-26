import React, { useMemo } from 'react';
import { AlertTriangle, Lightbulb, Repeat2, Target, TrendingUp } from 'lucide-react';
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
}

export const DailyInsightsCard: React.FC<DailyInsightsCardProps> = ({
  tasks,
  habits,
  theme,
}) => {
  const isDark = theme === 'dark';
  const today = getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE);

  const todayTasks = useMemo(
    () => tasks.filter((task) => areDatesEqual(task.taskKey, today)),
    [tasks, today]
  );

  const completedToday = todayTasks.filter((task) => task.isCompleted).length;
  const taskProgress = todayTasks.length
    ? Math.round((completedToday / todayTasks.length) * 100)
    : 0;

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
    const elapsed = weekHabitTrend.filter((day) => !day.future);
    const due = elapsed.reduce((sum, day) => sum + day.due, 0);
    const completed = elapsed.reduce((sum, day) => sum + day.completed, 0);

    return {
      due,
      completed,
      rate: due ? Math.round((completed / due) * 100) : 0,
    };
  }, [weekHabitTrend]);

  return (
    <div
      aria-label="Daily Insights"
      className={`h-full min-h-0 overflow-hidden p-2 rounded-2xl border flex flex-col transition-all ${
        isDark
          ? 'bg-slate-900/80 border-slate-800'
          : 'bg-slate-50/70 border-slate-200/80'
      }`}
    >
      <div className="shrink-0 flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 flex items-center justify-center shrink-0">
            <Lightbulb className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              Daily Insights
            </h2>
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              Priority + habit signals for today
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-lg font-black font-mono text-blue-600 dark:text-blue-300">
            {taskProgress}%
          </div>
          <div className="text-[9px] font-bold text-slate-400">tasks done</div>
        </div>
      </div>

      <div className="shrink-0 grid grid-cols-3 gap-1 mb-1.5">
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5 space-y-1.5">

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/50 p-1.5 mb-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[10px] uppercase tracking-wider font-black text-slate-600 dark:text-slate-300">
                This week · habits
              </span>
            </div>
            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
              {weekHabitSummary.rate}%
            </span>
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
                <div className="h-9 rounded-md bg-slate-100 dark:bg-slate-800 flex items-end overflow-hidden">
                  {!day.future && (
                    <div
                      className={`w-full rounded-t-sm transition-all ${
                        day.rate >= 80
                          ? 'bg-emerald-500'
                          : day.rate >= 50
                          ? 'bg-blue-500'
                          : day.due > 0
                          ? 'bg-amber-400'
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


      </div>
    </div>
  );
};
