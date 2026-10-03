import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  Check,
  Clock3,
  Code2,
  Copy,
  Database,
  Flame,
  ListChecks,
  RotateCcw,
  Send,
  Table2,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyRecord, HabitItem, TaskItem } from '../types';
import { isHabitDue } from '../utils/habitUtils';
import { calculateAchievedWeeks } from '../utils/progressAnalytics';
import { subscribeToCountdownSettings } from '../services/firebaseService';

type Period = '1w' | '2w' | '1m' | 'quarter' | '6m' | '1y' | 'all';

interface Props {
  records: DailyRecord[];
  tasks: TaskItem[];
  habits: HabitItem[];
  currentDateKey: string;
  onBack: () => void;
}

type QueryMode = 'ask' | 'sql';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sql?: string;
  columns?: string[];
  rows?: Array<Record<string, unknown>>;
  notes?: string[];
  resultCount?: number;
  dataFreshness?: string;
  analysisLevel?: 'standard' | 'deep';
  queryMode?: QueryMode;
}

const DAY = 86_400_000;
const SYSTEM_START = '2026-08-01';
const PERIODS: Array<{ id: Period; label: string; days?: number }> = [
  { id: '1w', label: '1W', days: 7 },
  { id: '2w', label: '2W', days: 14 },
  { id: '1m', label: '1M', days: 30 },
  { id: 'quarter', label: '3M', days: 90 },
  { id: '6m', label: '6M', days: 180 },
  { id: '1y', label: '1Y', days: 365 },
  { id: 'all', label: 'All' },
];

const toUtc = (dateKey: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (match) return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = Date.parse(dateKey);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const dateKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const clampPct = (value: number) => Math.max(0, Math.min(100, Math.round(value * 10) / 10));
const avg = (values: number[]) =>
  values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : 0;
const fmt = (value: number, digits = 1) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
const displayCell = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
};

const parseDurationMinutes = (value?: string) => {
  if (!value) return 0;
  const input = value.trim().toLowerCase();
  const clock = input.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if (clock) {
    if (clock[3] !== undefined) return Number(clock[1]) * 60 + Number(clock[2]) + Number(clock[3]) / 60;
    return Number(clock[1]) * 60 + Number(clock[2]);
  }
  const hours = Number(input.match(/([\d.]+)\s*h/)?.[1] || 0);
  const minutes = Number(input.match(/([\d.]+)\s*m/)?.[1] || 0);
  return hours * 60 + minutes;
};

const romanQuadrant = (value?: TaskItem['matrixQuadrant']) => {
  if (value === 'urgent-important') return 'I · Do';
  if (value === 'important') return 'II · Schedule';
  if (value === 'urgent') return 'III · Delegate';
  if (value === 'neither') return 'IV · Eliminate';
  return 'Unassigned';
};

const getRecordDateKey = (record: DailyRecord) => {
  const raw = String(record.date || record.id || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? dateKey(parsed) : raw;
};

const KpiCard: React.FC<{
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'blue' | 'emerald' | 'amber' | 'violet' | 'rose';
}> = ({ label, value, detail, icon: Icon, tone = 'blue' }) => {
  const tones = {
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
    violet: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30',
    rose: 'text-rose-600 bg-rose-50 dark:bg-rose-950/30',
  };
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</div>
        <div className={'rounded-xl p-2 ' + tones[tone]}><Icon className="h-4 w-4" /></div>
      </div>
      <div className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">{value}</div>
      <div className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{detail}</div>
    </div>
  );
};

export const DataAnalyticsPage: React.FC<Props> = ({
  records,
  tasks,
  habits,
  currentDateKey,
  onBack,
}) => {
  const [period, setPeriod] = useState<Period>('all');
  const [chatOpen, setChatOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [queryMode, setQueryMode] = useState<QueryMode>('ask');
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [copiedSqlIndex, setCopiedSqlIndex] = useState<number | null>(null);
  const [analysisLevel, setAnalysisLevel] = useState<'standard' | 'deep'>('standard');
  const [goal, setGoal] = useState<{ targetDate: string; reason: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'Query your System Builder data in plain English or switch to SQL. I can retrieve exact rows, generate and execute read-only SQL, calculate advanced statistics, explain results, and continue with follow-up questions.',
    },
  ]);

  useEffect(() => {
    const unsubscribe = subscribeToCountdownSettings(
      (settings) => setGoal(settings ? { targetDate: settings.targetDate, reason: settings.reason } : null),
      () => setGoal(null)
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const openAiChat = () => setChatOpen(true);
    window.addEventListener('system-builder:open-analytics-ai', openAiChat);
    return () => window.removeEventListener('system-builder:open-analytics-ai', openAiChat);
  }, []);

  const model = useMemo(() => {
    const todayMs = toUtc(currentDateKey);
    const goalTargetMs = goal?.targetDate ? toUtc(goal.targetDate) : NaN;
    const goalDaysRemaining = Number.isFinite(goalTargetMs) ? Math.max(0, Math.ceil((goalTargetMs - todayMs) / DAY)) : null;
    const systemStartMs = toUtc(SYSTEM_START);
    const periodMeta = PERIODS.find((item) => item.id === period)!;
    const startMs = period === 'all'
      ? systemStartMs
      : todayMs - ((periodMeta.days || 1) - 1) * DAY;

    const recordMap = new Map<string, DailyRecord>(records.map((record) => [getRecordDateKey(record), record]));
    const scoreForDate = (key: string) => {
      const stored = recordMap.get(key)?.dayCompletion;
      if (typeof stored === 'number') return clampPct(stored);
      const dayTasks = tasks.filter((task) => task.taskKey === key);
      const dueHabits = habits.filter((habit) => isHabitDue(habit, key));
      if (dayTasks.length === 0 && dueHabits.length === 0) return 0;
      const taskRate = dayTasks.length
        ? (dayTasks.filter((task) => task.isCompleted).length / dayTasks.length) * 100
        : 0;
      const habitRate = dueHabits.length
        ? (dueHabits.filter((habit) => habit.checkIns.includes(key)).length / dueHabits.length) * 100
        : 0;
      return clampPct(taskRate * 0.67 + habitRate * 0.33);
    };

    const calendarDays: Array<{ dateKey: string; ms: number; dayCompletion: number }> = [];
    for (let ms = startMs; ms <= todayMs; ms += DAY) {
      const key = dateKey(ms);
      calendarDays.push({ dateKey: key, ms, dayCompletion: scoreForDate(key) });
    }

    const selectedTasks = tasks.filter((task) => {
      const ms = toUtc(task.taskKey);
      return Number.isFinite(ms) && ms >= startMs && ms <= todayMs;
    });
    const completedTasks = selectedTasks.filter((task) => task.isCompleted).length;
    const taskRate = selectedTasks.length ? (completedTasks / selectedTasks.length) * 100 : 0;

    let habitDue = 0;
    let habitDone = 0;
    calendarDays.forEach((day) => {
      habits.forEach((habit) => {
        if (!isHabitDue(habit, day.dateKey)) return;
        habitDue += 1;
        if (habit.checkIns.includes(day.dateKey)) habitDone += 1;
      });
    });
    const habitRate = habitDue ? (habitDone / habitDue) * 100 : 0;

    const scores = calendarDays.map((day) => day.dayCompletion);
    const overall = avg(scores);
    const successfulDays = calendarDays.filter((day) => day.dayCompletion >= 80).length;
    const successRate = calendarDays.length ? (successfulDays / calendarDays.length) * 100 : 0;
    const bestDay = [...calendarDays].sort((a, b) => b.dayCompletion - a.dayCompletion)[0];
    const worstDay = [...calendarDays].sort((a, b) => a.dayCompletion - b.dayCompletion)[0];

    const last7 = calendarDays.slice(-7);
    const previous7 = calendarDays.slice(-14, -7);
    const last7Average = avg(last7.map((day) => day.dayCompletion));
    const previous7Average = avg(previous7.map((day) => day.dayCompletion));
    const momentum = Math.round((last7Average - previous7Average) * 10) / 10;

    const allTimeDays: Array<{ dateKey: string; dayCompletion: number }> = [];
    for (let ms = systemStartMs; ms <= todayMs; ms += DAY) {
      const key = dateKey(ms);
      allTimeDays.push({ dateKey: key, dayCompletion: scoreForDate(key) });
    }
    const allTimeOverall = avg(allTimeDays.map((day) => day.dayCompletion));
    const allTimeSuccessfulDays = allTimeDays.filter((day) => day.dayCompletion >= 80).length;
    const allTimeRecords: DailyRecord[] = allTimeDays.map((day, index) => ({
      id: day.dateKey,
      day: index + 1,
      date: day.dateKey,
      isCompleted: day.dayCompletion >= 80,
      result: day.dayCompletion >= 80 ? 'TRUE' : 'FALSE',
      change: 0,
      dayCompletion: day.dayCompletion,
    }));
    const achievedWeeks = calculateAchievedWeeks(allTimeRecords, currentDateKey);

    let currentStreak = 0;
    for (let index = allTimeDays.length - 1; index >= 0; index -= 1) {
      if (allTimeDays[index].dayCompletion < 80) break;
      currentStreak += 1;
    }
    let maxStreak = 0;
    let running = 0;
    allTimeDays.forEach((day) => {
      if (day.dayCompletion >= 80) {
        running += 1;
        maxStreak = Math.max(maxStreak, running);
      } else {
        running = 0;
      }
    });

    const bucketMode = period === '1w' || period === '2w' ? 'day' : period === '1y' || period === 'all' ? 'month' : 'week';
    const trendGroups = new Map<string, { ms: number; scores: number[]; tasksDone: number; tasksTotal: number; habitsDone: number; habitsTotal: number }>();
    calendarDays.forEach((day) => {
      const d = new Date(day.ms);
      let groupKey = day.dateKey;
      let groupMs = day.ms;
      if (bucketMode === 'month') {
        groupMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
        groupKey = dateKey(groupMs).slice(0, 7);
      } else if (bucketMode === 'week') {
        const weekday = d.getUTCDay();
        groupMs = day.ms - (weekday === 0 ? 6 : weekday - 1) * DAY;
        groupKey = dateKey(groupMs);
      }
      const group = trendGroups.get(groupKey) || { ms: groupMs, scores: [], tasksDone: 0, tasksTotal: 0, habitsDone: 0, habitsTotal: 0 };
      group.scores.push(day.dayCompletion);
      const dayTasks = tasks.filter((task) => task.taskKey === day.dateKey);
      group.tasksDone += dayTasks.filter((task) => task.isCompleted).length;
      group.tasksTotal += dayTasks.length;
      const due = habits.filter((habit) => isHabitDue(habit, day.dateKey));
      group.habitsDone += due.filter((habit) => habit.checkIns.includes(day.dateKey)).length;
      group.habitsTotal += due.length;
      trendGroups.set(groupKey, group);
    });
    const trend = [...trendGroups.entries()]
      .sort((a, b) => a[1].ms - b[1].ms)
      .map(([key, group]) => ({
        key,
        label: bucketMode === 'month'
          ? new Intl.DateTimeFormat('en-US', { month: 'short', year: period === 'all' ? '2-digit' : undefined, timeZone: 'UTC' }).format(new Date(group.ms))
          : bucketMode === 'week'
            ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(group.ms))
            : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(group.ms)),
        dayCompletion: avg(group.scores),
        taskRate: group.tasksTotal ? Math.round((group.tasksDone / group.tasksTotal) * 1000) / 10 : 0,
        habitRate: group.habitsTotal ? Math.round((group.habitsDone / group.habitsTotal) * 1000) / 10 : 0,
      }));

    const weekdays = Array.from({ length: 7 }, (_, index) => {
      const jsDay = (index + 1) % 7;
      const rows = calendarDays.filter((day) => new Date(day.ms).getUTCDay() === jsDay);
      return {
        label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index],
        value: avg(rows.map((day) => day.dayCompletion)),
      };
    });

    const quadrantMap = new Map<string, { done: number; total: number }>();
    selectedTasks.forEach((task) => {
      const label = romanQuadrant(task.matrixQuadrant);
      const row = quadrantMap.get(label) || { done: 0, total: 0 };
      row.total += 1;
      if (task.isCompleted) row.done += 1;
      quadrantMap.set(label, row);
    });
    const quadrants = [...quadrantMap.entries()]
      .map(([label, row]) => ({ label, total: row.total, done: row.done, rate: row.total ? Math.round((row.done / row.total) * 1000) / 10 : 0 }))
      .sort((a, b) => b.total - a.total);

    const habitPerformance = habits
      .map((habit) => {
        let due = 0;
        let done = 0;
        calendarDays.forEach((day) => {
          if (!isHabitDue(habit, day.dateKey)) return;
          due += 1;
          if (habit.checkIns.includes(day.dateKey)) done += 1;
        });
        return { id: habit.id, name: habit.name, due, done, rate: due ? Math.round((done / due) * 1000) / 10 : 0 };
      })
      .filter((habit) => habit.due > 0)
      .sort((a, b) => b.rate - a.rate || b.done - a.done);

    const plannedMinutes = selectedTasks.reduce((sum, task) => sum + parseDurationMinutes(task.EstimationTime || task.timeEstimate), 0);
    const actualMinutes = selectedTasks.reduce((sum, task) => sum + parseDurationMinutes(task.ActualTime), 0);
    const pairedTimeTasks = selectedTasks
      .map((task) => ({ planned: parseDurationMinutes(task.EstimationTime || task.timeEstimate), actual: parseDurationMinutes(task.ActualTime) }))
      .filter((row) => row.planned > 0 && row.actual > 0);
    const estimationAccuracy = pairedTimeTasks.length
      ? avg(pairedTimeTasks.map((row) => Math.max(0, 100 - Math.abs(row.actual - row.planned) / row.planned * 100)))
      : 0;
    const tasksWithEstimate = selectedTasks.filter((task) => parseDurationMinutes(task.EstimationTime || task.timeEstimate) > 0).length;
    const tasksWithActual = selectedTasks.filter((task) => parseDurationMinutes(task.ActualTime) > 0).length;

    const strongestHabit = habitPerformance[0];
    const weakestHabit = [...habitPerformance].sort((a, b) => a.rate - b.rate)[0];
    const strongestWeekday = [...weekdays].sort((a, b) => b.value - a.value)[0];
    const weakestWeekday = [...weekdays].sort((a, b) => a.value - b.value)[0];

    const insights = [
      {
        title: momentum >= 0 ? 'Recent momentum is improving' : 'Recent momentum is declining',
        text: `Latest 7-day DayCompletion is ${fmt(last7Average)}%, ${Math.abs(momentum).toFixed(1)}pp ${momentum >= 0 ? 'above' : 'below'} the previous 7 days.`,
        tone: momentum >= 0 ? 'emerald' : 'rose',
      },
      {
        title: taskRate >= habitRate ? 'Habits are the larger performance gap' : 'Tasks are the larger performance gap',
        text: `Task completion is ${fmt(taskRate)}% versus habit adherence at ${fmt(habitRate)}% for the selected period.`,
        tone: taskRate >= habitRate ? 'amber' : 'blue',
      },
      {
        title: weakestHabit ? `Habit focus: ${weakestHabit.name}` : 'Habit coverage is limited',
        text: weakestHabit ? `${weakestHabit.done}/${weakestHabit.due} due check-ins completed (${fmt(weakestHabit.rate)}%).` : 'No due habit observations are available in this period.',
        tone: 'violet',
      },
      {
        title: tasksWithActual > 0 ? 'Time capture is available' : 'Actual focus time is not being captured',
        text: tasksWithActual > 0
          ? `${tasksWithActual} tasks have actual time. Current estimation accuracy is ${fmt(estimationAccuracy)}%.`
          : `${tasksWithEstimate} tasks have estimates, but no actual-time observations exist in this period, so estimation accuracy cannot yet be measured.`,
        tone: 'blue',
      },
    ] as const;

    return {
      startMs,
      calendarDays,
      selectedTasks,
      completedTasks,
      taskRate,
      habitDue,
      habitDone,
      habitRate,
      overall,
      successfulDays,
      successRate,
      bestDay,
      worstDay,
      last7Average,
      momentum,
      allTimeOverall,
      allTimeSuccessfulDays,
      achievedWeeks,
      currentStreak,
      maxStreak,
      trend,
      weekdays,
      quadrants,
      habitPerformance,
      plannedMinutes,
      actualMinutes,
      estimationAccuracy,
      tasksWithEstimate,
      tasksWithActual,
      strongestHabit,
      weakestHabit,
      strongestWeekday,
      weakestWeekday,
      insights,
      goalDaysRemaining,
    };
  }, [records, tasks, habits, currentDateKey, period, goal]);

  const context = useMemo(() => ({
    selectedPeriod: PERIODS.find((item) => item.id === period)?.label || period,
    dateRange: { from: dateKey(model.startMs), to: currentDateKey },
    definitions: {
      dayCompletion: 'taskCompletionRate * 67% + habitCompletionRate * 33%',
      successfulDay: 'DayCompletion >= 80%',
      achievedWeek: 'completed Monday-Sunday week where the 7-day average DayCompletion is > 80%',
    },
    selected: {
      averageDayCompletion: model.overall,
      successfulDays: model.successfulDays,
      successfulDayRate: Math.round(model.successRate * 10) / 10,
      taskCompletionRate: Math.round(model.taskRate * 10) / 10,
      tasksCompleted: model.completedTasks,
      taskTotal: model.selectedTasks.length,
      habitCompletionRate: Math.round(model.habitRate * 10) / 10,
      habitCheckInsCompleted: model.habitDone,
      habitCheckInsDue: model.habitDue,
      last7DayAverage: model.last7Average,
      sevenDayMomentumPp: model.momentum,
      bestDay: model.bestDay,
      worstDay: model.worstDay,
      plannedMinutes: Math.round(model.plannedMinutes),
      actualMinutes: Math.round(model.actualMinutes),
      tasksWithActualTime: model.tasksWithActual,
    },
    allTime: {
      averageDayCompletion: model.allTimeOverall,
      successfulDays: model.allTimeSuccessfulDays,
      achievedWeeks: model.achievedWeeks,
      currentSuccessStreak: model.currentStreak,
      maxSuccessStreak: model.maxStreak,
    },
    habits: model.habitPerformance.slice(0, 10),
    quadrants: model.quadrants,
    weekdayPerformance: model.weekdays,
    goal: goal ? { title: goal.reason, targetDate: goal.targetDate, daysRemaining: model.goalDaysRemaining } : null,
  }), [model, period, currentDateKey, goal]);

  const localAnswer = (input: string) => {
    const q = input.toLowerCase();
    if (q.includes('overall') || q.includes('daycompletion')) {
      return `For ${context.selectedPeriod}, average DayCompletion is ${fmt(model.overall)}%. All-time DayCompletion is ${fmt(model.allTimeOverall)}%. The current formula is 67% task completion + 33% habit completion.`;
    }
    if (q.includes('task')) {
      return `You completed ${model.completedTasks} of ${model.selectedTasks.length} tasks in ${context.selectedPeriod}, a ${fmt(model.taskRate)}% completion rate. ${model.quadrants[0] ? `The largest task group is ${model.quadrants[0].label} with ${model.quadrants[0].total} tasks.` : ''}`;
    }
    if (q.includes('habit')) {
      return `Habit adherence is ${fmt(model.habitRate)}%: ${model.habitDone} of ${model.habitDue} due check-ins. ${model.strongestHabit ? `Strongest observed habit: ${model.strongestHabit.name} at ${fmt(model.strongestHabit.rate)}%.` : ''} ${model.weakestHabit ? `Weakest: ${model.weakestHabit.name} at ${fmt(model.weakestHabit.rate)}%.` : ''}`;
    }
    if (q.includes('successful') || q.includes('80')) {
      return `${model.successfulDays} of ${model.calendarDays.length} days in ${context.selectedPeriod} reached the successful-day threshold of DayCompletion >= 80%, a ${fmt(model.successRate)}% success rate. All-time successful days: ${model.allTimeSuccessfulDays}.`;
    }
    if (q.includes('week')) {
      return `All-time achieved weeks: ${model.achievedWeeks}. A week counts only when its complete Monday-Sunday 7-day average DayCompletion is greater than 80%.`;
    }
    if (q.includes('best') || q.includes('strong')) {
      return `Best day in the selected range is ${model.bestDay?.dateKey || 'n/a'} at ${fmt(model.bestDay?.dayCompletion || 0)}%. Strongest weekday is ${model.strongestWeekday?.label || 'n/a'} at ${fmt(model.strongestWeekday?.value || 0)}% average.`;
    }
    if (q.includes('worst') || q.includes('weak')) {
      return `Lowest day in the selected range is ${model.worstDay?.dateKey || 'n/a'} at ${fmt(model.worstDay?.dayCompletion || 0)}%. Weakest weekday is ${model.weakestWeekday?.label || 'n/a'} at ${fmt(model.weakestWeekday?.value || 0)}% average.`;
    }
    if (q.includes('goal') || q.includes('job') || q.includes('deadline') || q.includes('countdown')) {
      return goal?.targetDate
        ? `${goal.reason || 'Current goal'} is targeted for ${goal.targetDate}. ${model.goalDaysRemaining ?? 0} days remain from ${currentDateKey}. Use the trend and completion drivers on this page to judge whether your current execution pace is improving.`
        : 'No active goal countdown is available in the current System Builder data.';
    }
    if (q.includes('time') || q.includes('focus') || q.includes('estimate')) {
      return model.tasksWithActual > 0
        ? `Planned time is ${fmt(model.plannedMinutes / 60)} hours and captured actual time is ${fmt(model.actualMinutes / 60)} hours. Estimation accuracy across comparable tasks is ${fmt(model.estimationAccuracy)}%.`
        : `Planned time is ${fmt(model.plannedMinutes / 60)} hours, but there are no captured ActualTime observations in this period. Capture actual task time before judging estimation accuracy or focus efficiency.`;
    }
    if (q.includes('why') || q.includes('improve') || q.includes('problem') || q.includes('focus on')) {
      const gap = model.taskRate >= model.habitRate ? 'habit adherence' : 'task completion';
      return `The larger measurable gap is ${gap}: tasks are at ${fmt(model.taskRate)}% and habits at ${fmt(model.habitRate)}%. Recent 7-day DayCompletion is ${fmt(model.last7Average)}% (${model.momentum >= 0 ? '+' : ''}${model.momentum.toFixed(1)}pp versus the previous 7 days). Prioritize the weakest component first, then review the lowest-performing weekday and habit shown on this page.`;
    }
    return `The full AI data-query service is unavailable right now, so I cannot reliably answer that open-ended question from every raw row. Built-in metrics are still available: DayCompletion ${fmt(model.overall)}%, task completion ${fmt(model.taskRate)}%, habit adherence ${fmt(model.habitRate)}%, successful days ${model.successfulDays}/${model.calendarDays.length}, latest 7-day average ${fmt(model.last7Average)}%, and ${model.achievedWeeks} achieved weeks all-time.`;
  };

  const resetChat = () => {
    setMessages([
      {
        role: 'assistant',
        text: 'New analysis session started. Ask in plain English or switch to SQL for a read-only query.',
      },
    ]);
    setQuestion('');
    setAnalysisLevel('standard');
    setCopiedSqlIndex(null);
  };

  const copySql = async (sql: string, index: number) => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopiedSqlIndex(index);
      window.setTimeout(() => setCopiedSqlIndex((current) => current === index ? null : current), 1600);
    } catch {
      setCopiedSqlIndex(null);
    }
  };

  const askQuestion = async (preset?: string) => {
    const input = (preset ?? question).trim();
    if (!input || asking) return;
    setQuestion('');
    setMessages((current) => [...current, { role: 'user', text: input }]);
    setAsking(true);
    try {
      const response = await fetch('/api/analytics/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: input,
          context,
          history: messages.slice(-16),
          mode: queryMode,
        }),
      });
      if (!response.ok) throw new Error('AI endpoint unavailable');
      const payload = await response.json();
      const answer = String(payload.answer || '').trim();
      const responseLevel = payload.analysisLevel === 'deep' ? 'deep' : 'standard';
      setAnalysisLevel(responseLevel);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: answer || localAnswer(input),
          sql: String(payload.sql || '').trim() || undefined,
          columns: Array.isArray(payload.columns) ? payload.columns.map(String) : undefined,
          rows: Array.isArray(payload.rows) ? payload.rows : undefined,
          notes: Array.isArray(payload.notes) ? payload.notes.map(String) : undefined,
          resultCount: Number.isFinite(Number(payload.resultCount)) ? Number(payload.resultCount) : undefined,
          dataFreshness: payload.dataFreshness ? String(payload.dataFreshness) : undefined,
          analysisLevel: responseLevel,
          queryMode,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: queryMode === 'sql'
            ? 'The live SQL analysis service is unavailable right now, so this query was not executed.'
            : localAnswer(input),
          queryMode,
        },
      ]);
    } finally {
      setAsking(false);
    }
  };

  const periodTitle = period === 'all' ? 'All Time' : PERIODS.find((item) => item.id === period)?.label || period;

  return (
    <div className="min-h-screen bg-[#f6f8ff] pb-24 text-slate-900 dark:bg-slate-950 dark:text-slate-100 md:pb-8">
      <main className="mx-auto w-full max-w-[1500px] space-y-4 px-2.5 py-4 sm:px-4 lg:px-6">
        <section className="overflow-hidden rounded-[26px] border border-white/80 bg-gradient-to-br from-white via-blue-50/70 to-indigo-50/70 p-4 shadow-[0_20px_60px_rgba(37,99,235,0.10)] dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/20 dark:to-indigo-950/20 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <button type="button" onClick={onBack} className="mb-2 text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400">← Back to Today</button>
              <div className="flex items-center gap-2">
                <div className="rounded-2xl bg-blue-600 p-2.5 text-white shadow-lg shadow-blue-500/20"><BarChart3 className="h-5 w-5" /></div>
                <div>
                  <h1 className="text-xl font-black tracking-[-0.03em] sm:text-2xl">Data Analytics</h1>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">System Builder performance intelligence · live from your current app data</p>
                </div>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2.5 lg:w-auto lg:min-w-[420px] lg:items-end">
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                aria-label="Open AI data analyst"
                aria-expanded={chatOpen}
                aria-controls="analytics-ai-chat"
                className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-indigo-200/80 bg-white/90 px-3.5 py-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md active:translate-y-0 dark:border-indigo-900/70 dark:bg-slate-900/85 dark:hover:border-indigo-700 sm:px-4 lg:w-auto lg:min-w-[300px]"
                title="Ask AI Data Analyst"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                    <Bot className="h-4.5 w-4.5" />
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-black tracking-tight text-slate-900 dark:text-white">AI Data Analyst</span>
                      <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                        {analysisLevel === 'deep' ? 'Deep' : 'Live'}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">Ask anything about your System Builder data</span>
                  </span>
                </span>
                <span className="shrink-0 rounded-xl bg-slate-950 px-2.5 py-1.5 text-[10px] font-black text-white transition group-hover:bg-indigo-600 dark:bg-white dark:text-slate-950 dark:group-hover:bg-indigo-300">
                  Ask AI
                </span>
              </button>

              <div className="grid w-full grid-cols-7 rounded-2xl bg-slate-100/90 p-1 shadow-inner dark:bg-slate-800/90 lg:w-auto">
                {PERIODS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPeriod(item.id)}
                    className={'h-9 rounded-xl px-2 text-[10px] font-bold transition sm:text-xs ' + (period === item.id ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white')}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="DayCompletion" value={fmt(model.overall) + '%'} detail={periodTitle + ' average'} icon={Activity} tone="blue" />
          <KpiCard label="Successful Days" value={String(model.successfulDays)} detail={fmt(model.successRate) + '% of selected days'} icon={CheckCircle2} tone="emerald" />
          <KpiCard label="Achieved Weeks" value={String(model.achievedWeeks)} detail="All time · 7-day average > 80%" icon={Trophy} tone="amber" />
          <KpiCard label="Latest 7 Days" value={fmt(model.last7Average) + '%'} detail={(model.momentum >= 0 ? '+' : '') + model.momentum.toFixed(1) + 'pp vs previous 7'} icon={model.momentum >= 0 ? TrendingUp : TrendingDown} tone={model.momentum >= 0 ? 'emerald' : 'rose'} />
          <KpiCard label="Task Completion" value={fmt(model.taskRate) + '%'} detail={model.completedTasks + ' / ' + model.selectedTasks.length + ' tasks'} icon={ListChecks} tone="violet" />
          <KpiCard label="Habit Adherence" value={fmt(model.habitRate) + '%'} detail={model.habitDone + ' / ' + model.habitDue + ' due check-ins'} icon={Target} tone="amber" />
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.65fr_.85fr]">
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black">Performance Trend</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">DayCompletion with task and habit drivers</p>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{periodTitle}</span>
            </div>
            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={model.trend} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dayCompletionFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value: number) => [fmt(value) + '%', 'DayCompletion']} />
                  <Area type="monotone" dataKey="dayCompletion" stroke="#2563eb" strokeWidth={2.4} fill="url(#dayCompletionFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <h2 className="text-sm font-black">Executive Readout</h2>
            <div className="mt-3 space-y-2.5">
              {model.insights.map((item) => (
                <div key={item.title} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/45">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{item.title}</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{item.text}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <h2 className="text-sm font-black">Task vs Habit Drivers</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">Which component is driving DayCompletion</p>
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={model.trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value: number, name: string) => [fmt(value) + '%', name === 'taskRate' ? 'Tasks' : 'Habits']} />
                  <Bar dataKey="taskRate" fill="#4f46e5" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="habitRate" fill="#f59e0b" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <h2 className="text-sm font-black">Weekday Pattern</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">Average DayCompletion by weekday</p>
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={model.weekdays} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value: number) => [fmt(value) + '%', 'DayCompletion']} />
                  <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-center gap-2"><ListChecks className="h-4 w-4 text-indigo-500" /><h2 className="text-sm font-black">Task Portfolio</h2></div>
            <div className="mt-3 space-y-2">
              {model.quadrants.length ? model.quadrants.map((row) => (
                <div key={row.label} className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-950/45">
                  <div className="flex items-center justify-between gap-2 text-xs"><span className="font-semibold">{row.label}</span><span className="font-black">{fmt(row.rate)}%</span></div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-indigo-500" style={{ width: Math.max(2, row.rate) + '%' }} /></div>
                  <div className="mt-1 text-[10px] text-slate-500">{row.done}/{row.total} completed</div>
                </div>
              )) : <div className="text-xs text-slate-500">No tasks in this period.</div>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-center gap-2"><Flame className="h-4 w-4 text-amber-500" /><h2 className="text-sm font-black">Habit Performance</h2></div>
            <div className="mt-3 space-y-2">
              {model.habitPerformance.slice(0, 6).map((habit) => (
                <div key={habit.id} className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-950/45">
                  <div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold">{habit.name}</span><span className="text-xs font-black">{fmt(habit.rate)}%</span></div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-amber-500" style={{ width: Math.max(2, habit.rate) + '%' }} /></div>
                  <div className="mt-1 text-[10px] text-slate-500">{habit.done}/{habit.due} due check-ins</div>
                </div>
              ))}
              {!model.habitPerformance.length && <div className="text-xs text-slate-500">No due habit observations in this period.</div>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-blue-500" /><h2 className="text-sm font-black">Focus & Time</h2></div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/45"><div className="text-[10px] uppercase tracking-wide text-slate-500">Planned</div><div className="mt-1 text-lg font-black">{fmt(model.plannedMinutes / 60)}h</div></div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/45"><div className="text-[10px] uppercase tracking-wide text-slate-500">Actual</div><div className="mt-1 text-lg font-black">{fmt(model.actualMinutes / 60)}h</div></div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/45"><div className="text-[10px] uppercase tracking-wide text-slate-500">Estimated tasks</div><div className="mt-1 text-lg font-black">{model.tasksWithEstimate}</div></div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/45"><div className="text-[10px] uppercase tracking-wide text-slate-500">Actual-time tasks</div><div className="mt-1 text-lg font-black">{model.tasksWithActual}</div></div>
            </div>
            <div className="mt-2.5 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-[11px] leading-relaxed text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
              {model.tasksWithActual > 0
                ? `Estimation accuracy: ${fmt(model.estimationAccuracy)}%. Compare planned versus actual time to identify under-estimation and over-estimation patterns.`
                : 'ActualTime is not yet populated for this period. Start capturing completed-task focus time to unlock estimation accuracy, productivity per hour, and workload efficiency.'}
            </div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /><h2 className="text-sm font-black">Consistency & Reliability</h2></div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-950/45"><div className="text-xl font-black">{model.allTimeSuccessfulDays}</div><div className="mt-1 text-[10px] text-slate-500">Successful days · all time</div></div>
              <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-950/45"><div className="text-xl font-black">{model.achievedWeeks}</div><div className="mt-1 text-[10px] text-slate-500">Achieved weeks</div></div>
              <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-950/45"><div className="text-xl font-black">{model.currentStreak}</div><div className="mt-1 text-[10px] text-slate-500">Current ≥80% streak</div></div>
              <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-950/45"><div className="text-xl font-black">{model.maxStreak}</div><div className="mt-1 text-[10px] text-slate-500">Best ≥80% streak</div></div>
            </div>
            <div className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Successful day = DayCompletion ≥ 80%. Achieved week = a completed Monday–Sunday week whose 7-day average DayCompletion is greater than 80%.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-blue-500" /><h2 className="text-sm font-black">Data Coverage & Quality</h2></div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/45"><span className="text-slate-500">Calendar days analyzed</span><b>{model.calendarDays.length}</b></div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/45"><span className="text-slate-500">Tasks analyzed</span><b>{model.selectedTasks.length}</b></div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/45"><span className="text-slate-500">Active/current habits visible</span><b>{habits.length}</b></div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/45"><span className="text-slate-500">Actual-time coverage</span><b>{model.selectedTasks.length ? fmt(model.tasksWithActual / model.selectedTasks.length * 100) : '0.0'}%</b></div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/45"><span className="truncate pr-2 text-slate-500">{goal?.reason || 'Goal countdown'}</span><b>{model.goalDaysRemaining === null ? '—' : model.goalDaysRemaining + ' days'}</b></div>
            </div>
          </div>
        </section>
      </main>

      {chatOpen && (
        <div className="fixed inset-0 z-[190] flex items-end justify-end bg-slate-950/30 p-0 backdrop-blur-[3px] sm:p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) setChatOpen(false); }}>
          <section id="analytics-ai-chat" className="flex h-[88dvh] w-full flex-col overflow-hidden rounded-t-[26px] border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:h-[760px] sm:max-w-2xl sm:rounded-[26px]">
            <div className="border-b border-slate-100 bg-white/95 px-3.5 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 sm:px-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="relative rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-2.5 text-white shadow-md shadow-blue-500/20">
                    <Bot className="h-4 w-4" />
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-black">Query Intelligence</div>
                      <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">{analysisLevel === 'deep' ? 'Deep' : 'Live'}</span>
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Read only</span>
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-slate-500">Natural language + SQL over live System Builder data</div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={resetChat} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Start new analysis chat" title="New chat"><RotateCcw className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setChatOpen(false)} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Close AI analyst"><X className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setQueryMode('ask')}
                    className={'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[10px] font-black transition ' + (queryMode === 'ask' ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400')}
                    aria-pressed={queryMode === 'ask'}
                  >
                    <Bot className="h-3.5 w-3.5" /> Ask
                  </button>
                  <button
                    type="button"
                    onClick={() => setQueryMode('sql')}
                    className={'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[10px] font-black transition ' + (queryMode === 'sql' ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400')}
                    aria-pressed={queryMode === 'sql'}
                  >
                    <Code2 className="h-3.5 w-3.5" /> SQL
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSchemaOpen((value) => !value)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 text-[10px] font-bold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:text-slate-300"
                  aria-expanded={schemaOpen}
                >
                  <Database className="h-3.5 w-3.5" /> Schema
                </button>
              </div>

              {schemaOpen && (
                <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-950/55">
                  <div className="mb-2 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Virtual SQL schema</div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {[
                      ['day_facts', 'dateKey · DayCompletion · task/habit rates · workload · time'],
                      ['task_facts', 'taskId · title · date · completed · quadrant · priority · time · notes'],
                      ['habit_logs', 'habitId · dateKey · Iscompleted'],
                      ['habit_facts', 'habit · completed/incomplete logs · completion rate'],
                      ['weekly_facts', 'week · averages · successful days · achieved-week score'],
                      ['monthly_facts', 'month · averages · tasks · time'],
                      ['habits', 'name · repeatDays · activeFrom · isActive'],
                      ['countdowns', 'goal · targetDate · isActive'],
                    ].map(([table, fields]) => (
                      <div key={table} className="rounded-lg bg-white px-2.5 py-2 dark:bg-slate-900">
                        <div className="font-mono text-[10px] font-black text-indigo-600 dark:text-indigo-300">{table}</div>
                        <div className="mt-0.5 text-[9px] leading-relaxed text-slate-500">{fields}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {(queryMode === 'sql'
                  ? [
                      'SELECT dateKey, DayCompletion FROM day_facts ORDER BY DayCompletion DESC LIMIT 5',
                      'SELECT quadrant, COUNT(*) AS tasks FROM task_facts GROUP BY quadrant ORDER BY tasks DESC',
                      'SELECT * FROM weekly_facts ORDER BY key DESC LIMIT 8',
                    ]
                  : [
                      'Find my biggest anomaly',
                      'Compare last 30 vs previous 30 days',
                      'What drives low DayCompletion?',
                      'Which tasks overran estimates?',
                    ]
                ).map((prompt) => (
                  <button key={prompt} type="button" onClick={() => void askQuestion(prompt)} className="whitespace-nowrap rounded-full border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300">{prompt}</button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/45 p-3 dark:bg-slate-950/25 sm:p-4">
              {messages.map((message, index) => (
                <div key={index} className={'flex ' + (message.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={'max-w-[94%] sm:max-w-[90%] ' + (message.role === 'user' ? '' : 'w-full')}>
                    <div className={'rounded-2xl px-3 py-2.5 text-xs leading-relaxed ' + (message.role === 'user' ? 'ml-auto w-fit max-w-full bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200')}>
                      <div className="whitespace-pre-wrap">{message.text}</div>
                    </div>

                    {message.role === 'assistant' && message.sql && (
                      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-sm dark:border-slate-700">
                        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400"><Code2 className="h-3.5 w-3.5" /> Executed SQL</div>
                          <button type="button" onClick={() => void copySql(message.sql!, index)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-bold text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Copy SQL query">
                            {copiedSqlIndex === index ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            {copiedSqlIndex === index ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[10px] leading-relaxed text-emerald-300">{message.sql}</pre>
                      </div>
                    )}

                    {message.role === 'assistant' && message.rows && message.rows.length > 0 && (
                      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500"><Table2 className="h-3.5 w-3.5" /> Query result</div>
                          <div className="text-[9px] font-semibold text-slate-400">{message.resultCount ?? message.rows.length} row{(message.resultCount ?? message.rows.length) === 1 ? '' : 's'}</div>
                        </div>
                        <div className="max-h-64 overflow-auto">
                          <table className="min-w-full border-collapse text-left text-[10px]">
                            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950">
                              <tr>
                                {(message.columns?.length ? message.columns : Object.keys(message.rows[0])).map((column) => (
                                  <th key={column} className="whitespace-nowrap border-b border-slate-200 px-2.5 py-2 font-black text-slate-600 dark:border-slate-800 dark:text-slate-300">{column}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {message.rows.slice(0, 50).map((row, rowIndex) => (
                                <tr key={rowIndex} className="border-b border-slate-100 last:border-0 dark:border-slate-800/70">
                                  {(message.columns?.length ? message.columns : Object.keys(message.rows![0])).map((column) => (
                                    <td key={column} className="max-w-[260px] whitespace-nowrap px-2.5 py-2 text-slate-600 dark:text-slate-300">{displayCell(row[column])}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {message.role === 'assistant' && message.notes && message.notes.length > 0 && (
                      <div className="mt-2 rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-[10px] leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200">
                        {message.notes.join(' · ')}
                      </div>
                    )}

                    {message.role === 'assistant' && message.dataFreshness && (
                      <div className="mt-1.5 text-right text-[9px] font-medium text-slate-400">
                        Live data · {new Date(message.dataFreshness).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {asking && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    {queryMode === 'sql' ? 'Executing read-only SQL…' : 'Building query and analyzing live data…'}
                  </div>
                </div>
              )}
            </div>

            <form
              className="border-t border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
              onSubmit={(event) => { event.preventDefault(); void askQuestion(); }}
            >
              <div className={'flex items-end gap-2 rounded-2xl border bg-slate-50 p-2 transition focus-within:ring-2 dark:bg-slate-950 ' + (queryMode === 'sql' ? 'border-indigo-200 focus-within:border-indigo-400 focus-within:ring-indigo-100 dark:border-indigo-900 dark:focus-within:ring-indigo-950' : 'border-slate-200 focus-within:border-blue-400 focus-within:ring-blue-100 dark:border-slate-700 dark:focus-within:ring-blue-950')}>
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void askQuestion();
                    }
                  }}
                  rows={queryMode === 'sql' ? 3 : 2}
                  placeholder={queryMode === 'sql' ? 'SELECT ... FROM day_facts ...' : 'Ask anything about your data…'}
                  className={'min-h-12 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-xs outline-none ' + (queryMode === 'sql' ? 'font-mono' : '')}
                  aria-label={queryMode === 'sql' ? 'SQL query' : 'Ask data question'}
                />
                <button type="submit" disabled={!question.trim() || asking} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label={queryMode === 'sql' ? 'Run SQL query' : 'Ask AI analyst'}><Send className="h-4 w-4" /></button>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3 px-1 text-[9px] text-slate-400">
                <span>{queryMode === 'sql' ? 'SELECT / WITH only · Enter to run · Shift+Enter for new line' : 'AI generates verified read-only SQL when useful · Enter to send'}</span>
                <span className="hidden sm:inline">Live Firestore source</span>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};
