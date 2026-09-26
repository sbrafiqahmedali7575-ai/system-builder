import React, { useMemo } from 'react';
import { AlertTriangle, Check, Clock3, Flame, Lightbulb, Repeat2, Siren, Target, TrendingUp } from 'lucide-react';
import { DashboardTheme, HabitItem, TaskItem } from '../types';
import {
  CONFIGURED_TIMEZONE,
  areDatesEqual,
  getIsoDateKeyInTimezone,
} from '../utils/taskDateUtils';
import {
  addHabitDays,
  getHabitScheduleLabel,
  getHabitStats,
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

  const quadrantOneTasks = useMemo(
    () =>
      todayTasks
        .filter(
          (task) =>
            !task.isCompleted &&
            (task.matrixQuadrant === 'urgent-important' ||
              (!task.matrixQuadrant && task.priority === 'High'))
        )
        .slice(0, 4),
    [todayTasks]
  );

  const dueHabits = useMemo(
    () => habits.filter((habit) => isHabitDue(habit, today)),
    [habits, today]
  );
  const completedHabitsToday = dueHabits.filter((habit) =>
    habit.checkIns.includes(today)
  ).length;

  const newestHabits = useMemo(
    () =>
      [...habits]
        .sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          return (Number.isNaN(bTime) ? 0 : bTime) -
            (Number.isNaN(aTime) ? 0 : aTime);
        })
        .slice(0, 3)
        .map((habit) => ({
          habit,
          stats: getHabitStats(habit, today),
          dueToday: isHabitDue(habit, today),
          checkedToday: habit.checkIns.includes(today),
        })),
    [habits, today]
  );

  const overdueTasks = useMemo(
    () =>
      tasks
        .filter((task) => !task.isCompleted && task.taskKey < today)
        .sort((a, b) => a.taskKey.localeCompare(b.taskKey)),
    [tasks, today]
  );

  const topStreaks = useMemo(
    () =>
      habits
        .map((habit) => ({
          habit,
          currentStreak: getHabitStats(habit, today).currentStreak,
        }))
        .sort(
          (a, b) =>
            b.currentStreak - a.currentStreak ||
            a.habit.name.localeCompare(b.habit.name)
        )
        .slice(0, 3),
    [habits, today]
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

  const daysOverdue = (dateKey: string) => {
    const start = parseHabitDateKey(dateKey).getTime();
    const end = parseHabitDateKey(today).getTime();
    return Math.max(1, Math.round((end - start) / 86400000));
  };

  return (
    <div
      aria-label="Daily Insights"
      className={`h-full p-2 sm:p-2.5 rounded-2xl border flex flex-col transition-all ${
        isDark
          ? 'bg-slate-900/80 border-slate-800'
          : 'bg-slate-50/70 border-slate-200/80'
      }`}
    >
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200/80 dark:border-slate-800">
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

      <div className="grid grid-cols-3 gap-1.5 mb-2">
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

      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/50 p-2 mb-2">
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

          <div className="mt-1.5 text-[9px] font-semibold text-slate-400">
            {weekHabitSummary.completed}/{weekHabitSummary.due} scheduled habit check-ins completed this week
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-2">
          <div className="rounded-xl border border-orange-200 dark:border-orange-900/50 bg-orange-50/60 dark:bg-orange-950/20 p-2">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-[10px] uppercase tracking-wider font-black text-orange-700 dark:text-orange-300">
                  Streaks
                </span>
              </div>
              <span className="text-[9px] font-bold text-orange-500">
                current
              </span>
            </div>

            {topStreaks.length === 0 ? (
              <div className="text-[10px] font-semibold text-slate-400">
                No habit streaks yet.
              </div>
            ) : (
              <div className="space-y-1">
                {topStreaks.map(({ habit, currentStreak }) => (
                  <div
                    key={habit.id}
                    className="flex items-center gap-1.5 rounded-lg bg-white/75 dark:bg-slate-950/40 px-1.5 py-1"
                  >
                    <span className="text-sm leading-none shrink-0">
                      {habit.emoji}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-slate-700 dark:text-slate-200">
                      {habit.name}
                    </span>
                    <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 shrink-0">
                      {currentStreak}d
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-2">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <Clock3 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-[10px] uppercase tracking-wider font-black text-amber-700 dark:text-amber-300">
                  Overdue tasks
                </span>
              </div>
              <span className="text-[10px] font-black text-amber-600 dark:text-amber-400">
                {overdueTasks.length}
              </span>
            </div>

            {overdueTasks.length === 0 ? (
              <div className="text-[10px] font-semibold text-slate-400">
                No overdue unfinished tasks.
              </div>
            ) : (
              <div className="space-y-1">
                {overdueTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-1.5 rounded-lg bg-white/75 dark:bg-slate-950/40 px-1.5 py-1"
                    title={task.taskOfTheDay}
                  >
                    <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-slate-700 dark:text-slate-200">
                      {task.taskOfTheDay}
                    </span>
                    <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 shrink-0">
                      {daysOverdue(task.taskKey)}d
                    </span>
                  </div>
                ))}
                {overdueTasks.length > 3 && (
                  <div className="text-[9px] font-bold text-amber-600/80 dark:text-amber-400/80">
                    +{overdueTasks.length - 3} more
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 p-2 mb-2">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Siren className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="text-[10px] uppercase tracking-wider font-black text-rose-700 dark:text-rose-300">
              Quadrant I · Do first
            </span>
          </div>
          <span className="text-[10px] font-black text-rose-600 dark:text-rose-400">
            {quadrantOneTasks.length}
          </span>
        </div>

        {quadrantOneTasks.length === 0 ? (
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            No unfinished urgent & important tasks for today.
          </div>
        ) : (
          <div className="space-y-1">
            {quadrantOneTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-1.5 rounded-lg border border-rose-100 dark:border-rose-900/40 bg-white/80 dark:bg-slate-950/45 px-2 py-1.5"
                title={task.taskOfTheDay}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  {task.taskOfTheDay}
                </span>
                <span className="text-[9px] font-black text-rose-600 dark:text-rose-400 shrink-0">
                  High
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

        <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-[10px] uppercase tracking-wider font-black text-slate-600 dark:text-slate-300">
              New habits
            </span>
          </div>
          <span className="text-[9px] font-bold text-slate-400">
            30-day progress
          </span>
        </div>

        {newestHabits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-3 py-5 text-center text-[11px] font-semibold text-slate-400">
            Add a habit in Tools to see progress here.
          </div>
        ) : (
          <div className="space-y-1.5">
            {newestHabits.map(({ habit, stats, dueToday, checkedToday }) => (
              <div
                key={habit.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/50 px-2 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none shrink-0">
                    {habit.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[11px] font-black text-slate-800 dark:text-slate-100">
                        {habit.name}
                      </span>
                      <span className="hidden sm:inline text-[8px] font-bold text-slate-400 shrink-0">
                        {getHabitScheduleLabel(habit)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${stats.thirty.rate}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-black text-slate-700 dark:text-slate-200">
                      {stats.thirty.rate}%
                    </div>
                    <div
                      className={`mt-0.5 inline-flex items-center gap-0.5 text-[8px] font-black ${
                        checkedToday
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : dueToday
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {checkedToday && <Check className="w-2.5 h-2.5" />}
                      {checkedToday ? 'Done' : dueToday ? 'Due' : 'Off'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
