import React, { useMemo, useState } from 'react';
import {
  Check,
  History,
  ListChecks,
  Pencil,
  Plus,
  Target,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { HabitItem, MatrixQuadrant, TaskItem, ToolsDensity } from '../types';
import { CONFIGURED_TIMEZONE } from '../utils/taskDateUtils';
import { useCurrentDateKey } from '../hooks/useCurrentDateKey';
import { addHabitDays, parseHabitDateKey } from '../utils/habitUtils';
import { CalendarWorkspace } from './CalendarWorkspace';

interface TaskTrackerProps {
  tasks: TaskItem[];
  habits: HabitItem[];
  onAddTask: (task: Omit<TaskItem, 'id'>) => Promise<void>;
  onUpdateTask: (task: TaskItem) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onToggleTaskStatus: (taskId: string) => Promise<void>;
  onUpdateHabit: (habit: HabitItem) => Promise<void>;
  density?: ToolsDensity;
}

type TaskDraft = {
  title: string;
  dateKey: string;
  quadrant: MatrixQuadrant | '';
};

const WEEKLY_TARGET_PERCENTAGE = 80;

const QUADRANTS: Array<{
  value: MatrixQuadrant;
  roman: string;
  label: string;
}> = [
  { value: 'urgent-important', roman: 'I', label: 'Urgent & Important' },
  { value: 'important', roman: 'II', label: 'Not Urgent & Important' },
  { value: 'urgent', roman: 'III', label: 'Urgent & Unimportant' },
  { value: 'neither', roman: 'IV', label: 'Not Urgent & Unimportant' },
];

function getMonday(dateKey: string): string {
  const anchor = parseHabitDateKey(dateKey);
  const day = anchor.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addHabitDays(dateKey, mondayOffset);
}

function priorityForQuadrant(
  quadrant: MatrixQuadrant
): NonNullable<TaskItem['priority']> {
  if (quadrant === 'urgent-important') return 'High';
  if (quadrant === 'important' || quadrant === 'urgent') return 'Medium';
  return 'Normal';
}

function getQuadrantLabel(quadrant?: MatrixQuadrant): string {
  return (
    QUADRANTS.find((item) => item.value === quadrant)?.label || 'Unassigned'
  );
}

function getDailyTaskRate(tasks: TaskItem[], dateKey: string): number {
  const dayTasks = tasks.filter((task) => task.taskKey === dateKey);
  if (dayTasks.length === 0) return 0;
  const completed = dayTasks.filter((task) => task.isCompleted).length;
  return (completed / dayTasks.length) * 100;
}

export const TaskTracker: React.FC<TaskTrackerProps> = ({
  tasks,
  habits,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onToggleTaskStatus,
  onUpdateHabit,
  density = 'compact',
}) => {
  const today = useCurrentDateKey(CONFIGURED_TIMEZONE);
  const compact = density === 'compact';
  const weekAnchor = today;
  const [formOpen, setFormOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [historyTaskId, setHistoryTaskId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaskDraft>({
    title: '',
    dateKey: today,
    quadrant: '',
  });

  const weekDates = useMemo(() => {
    const monday = getMonday(weekAnchor);
    return Array.from({ length: 7 }, (_, index) => addHabitDays(monday, index));
  }, [weekAnchor]);

  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const weekTasks = useMemo(
    () =>
      [...tasks]
        .filter(
          (task) => task.taskKey >= weekStart && task.taskKey <= weekEnd
        )
        .sort((a, b) => {
          const dateCompare = a.taskKey.localeCompare(b.taskKey);
          if (dateCompare !== 0) return dateCompare;
          if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
          return a.taskOfTheDay.localeCompare(b.taskOfTheDay);
        }),
    [tasks, weekStart, weekEnd]
  );

  const todayTasks = tasks.filter((task) => task.taskKey === today);
  const completedToday = todayTasks.filter((task) => task.isCompleted).length;
  const completedThisWeek = weekTasks.filter((task) => task.isCompleted).length;

  const weekScore = useMemo(() => {
    const elapsedDates = weekDates.filter((dateKey) => dateKey <= today);
    if (elapsedDates.length === 0) return 0;

    const totalDailyPercentage = elapsedDates.reduce(
      (sum, dateKey) => sum + getDailyTaskRate(tasks, dateKey),
      0
    );

    return (
      Math.round(
        (totalDailyPercentage / (elapsedDates.length * 100)) * 1000
      ) / 10
    );
  }, [tasks, weekDates, today]);

  const achievedDays = useMemo(() => {
    const loggedDates = Array.from(
      new Set<string>(
        tasks
          .filter((task) => task.taskKey <= today)
          .map((task) => task.taskKey)
      )
    );

    return loggedDates.filter(
      (dateKey) => getDailyTaskRate(tasks, dateKey) >= WEEKLY_TARGET_PERCENTAGE
    ).length;
  }, [tasks, today]);

  const achievedWeeks = useMemo(() => {
    if (tasks.length === 0) return 0;

    const firstTaskDate = [...tasks]
      .map((task) => task.taskKey)
      .sort((a, b) => a.localeCompare(b))[0];

    if (!firstTaskDate) return 0;

    let weekStartKey = getMonday(firstTaskDate);
    const currentWeekStart = getMonday(today);
    let achieved = 0;
    let guard = 0;

    while (weekStartKey < currentWeekStart && guard < 5200) {
      const dailyRates = Array.from({ length: 7 }, (_, index) =>
        getDailyTaskRate(tasks, addHabitDays(weekStartKey, index))
      );

      const weeklyScore =
        dailyRates.reduce((sum, rate) => sum + rate, 0) / dailyRates.length;

      if (weeklyScore >= WEEKLY_TARGET_PERCENTAGE) achieved += 1;
      weekStartKey = addHabitDays(weekStartKey, 7);
      guard += 1;
    }

    return achieved;
  }, [tasks, today]);

  const historyTask =
    tasks.find((task) => task.id === historyTaskId) || null;

  const openAdd = () => {
    setEditingTaskId(null);
    setDraft({ title: '', dateKey: today, quadrant: '' });
    setFormOpen(true);
  };

  const openEdit = (task: TaskItem) => {
    setEditingTaskId(task.id);
    setDraft({
      title: task.taskOfTheDay,
      dateKey: task.taskKey,
      quadrant: task.matrixQuadrant || '',
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingTaskId(null);
    setDraft({ title: '', dateKey: today, quadrant: '' });
  };

  const saveTask = async () => {
    const title = draft.title.trim();
    if (!title || !draft.dateKey || !draft.quadrant) return;

    if (editingTaskId) {
      const existing = tasks.find((task) => task.id === editingTaskId);
      if (!existing) return;

      await onUpdateTask({
        ...existing,
        taskOfTheDay: title,
        taskKey: draft.dateKey,
        matrixQuadrant: draft.quadrant,
        priority: priorityForQuadrant(draft.quadrant),
        updatedAt: new Date().toISOString(),
      });
    } else {
      await onAddTask({
        taskKey: draft.dateKey,
        taskOfTheDay: title,
        isCompleted: false,
        priority: priorityForQuadrant(draft.quadrant),
        category: 'General',
        matrixQuadrant: draft.quadrant,
        updatedAt: new Date().toISOString(),
      });
    }

    closeForm();
  };

  const toggleTask = async (task: TaskItem) => {
    if (task.taskKey > today) return;
    try {
      setBusyId(task.id);
      await onToggleTaskStatus(task.id);
    } finally {
      setBusyId(null);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (historyTaskId === taskId) setHistoryTaskId(null);
    if (editingTaskId === taskId) closeForm();
    await onDeleteTask(taskId);
  };

  return (
    <div
      className={`${compact ? 'space-y-2' : 'space-y-4'} lg:h-full lg:overflow-y-auto lg:pr-1`}
    >
      <div
        className={`flex flex-col lg:flex-row lg:items-center justify-between ${
          compact ? 'gap-2' : 'gap-3'
        }`}
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] font-black text-blue-600">
            Consistency workspace
          </p>
          <h2
            className={`${
              compact ? 'mt-0.5 text-xl sm:text-2xl' : 'mt-1 text-2xl sm:text-3xl'
            } font-black tracking-tight`}
          >
            Task Tracker
          </h2>
          <p
            className={`${
              compact ? 'mt-0.5 text-xs' : 'mt-1 text-sm'
            } font-semibold text-slate-600 hidden md:block`}
          >
            Daily tasks, weekly completion, streaks, and achievement history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={formOpen && !editingTaskId ? closeForm : openAdd}
            className={`${
              compact
                ? 'h-8 px-2.5 rounded-lg text-xs gap-1.5'
                : 'h-10 px-3 rounded-xl text-sm gap-2'
            } bg-blue-600 text-white font-black inline-flex items-center`}
          >
            {formOpen && !editingTaskId ? (
              <X className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {formOpen && !editingTaskId ? 'Cancel' : 'Add Task'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="rounded-xl border border-blue-200/80 bg-blue-50/60 px-3 py-2">
          <div className="text-[9px] uppercase tracking-wider font-black text-blue-600">
            Today
          </div>
          <div className="mt-1 text-lg font-black text-slate-900">
            {completedToday}/{todayTasks.length}
          </div>
          <div className="text-[9px] font-bold text-slate-500">
            tasks completed
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2">
          <div className="text-[9px] uppercase tracking-wider font-black text-emerald-600">
            This week
          </div>
          <div className="mt-1 text-lg font-black text-slate-900">
            {weekScore.toFixed(1)}%
          </div>
          <div className="text-[9px] font-bold text-slate-500">
            {completedThisWeek}/{weekTasks.length} tasks • target {WEEKLY_TARGET_PERCENTAGE}%
          </div>
        </div>

        <div className="rounded-xl border border-orange-200/80 bg-orange-50/60 px-3 py-2">
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-black text-orange-600">
            <Check className="w-3 h-3" />
            Achieved Days
          </div>
          <div className="mt-1 text-lg font-black text-slate-900">
            {achievedDays}
          </div>
          <div className="text-[9px] font-bold text-slate-500">
            days at {WEEKLY_TARGET_PERCENTAGE}%+ target
          </div>
        </div>

        <div className="rounded-xl border border-violet-200/80 bg-violet-50/60 px-3 py-2">
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-black text-violet-600">
            <Trophy className="w-3 h-3" />
            Achieved Weeks
          </div>
          <div className="mt-1 text-lg font-black text-slate-900">
            {achievedWeeks}
          </div>
          <div className="text-[9px] font-bold text-slate-500">
            weeks at {WEEKLY_TARGET_PERCENTAGE}%+ target
          </div>
        </div>
      </div>

      <div className="h-[680px] lg:h-[720px] min-h-[640px] overflow-hidden bg-white">
        <CalendarWorkspace
          tasks={tasks}
          habits={habits}
          onAddTask={onAddTask}
          onUpdateTask={onUpdateTask}
          onToggleTaskStatus={onToggleTaskStatus}
          onUpdateHabit={onUpdateHabit}
          density="compact"
        />
      </div>

      {formOpen && (
        <div
          className={`${
            compact ? 'rounded-xl p-3' : 'rounded-2xl p-4'
          } border border-slate-200 bg-slate-50`}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-black">
                {editingTaskId ? 'Edit Task' : 'New Task'}
              </div>
              <div className="text-[11px] font-semibold text-slate-500">
                Title, scheduled date, and Eisenhower quadrant.
              </div>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100"
              aria-label="Close task editor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px_230px_auto] gap-2">
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter' && draft.quadrant) {
                  void saveTask();
                }
              }}
              placeholder="Task title"
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-400"
            />
            <input
              type="date"
              value={draft.dateKey}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  dateKey: event.target.value,
                }))
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-400"
            />
            <select
              value={draft.quadrant}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  quadrant: event.target.value as MatrixQuadrant | '',
                }))
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none"
            >
              <option value="">Select quadrant</option>
              {QUADRANTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.roman} · {item.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void saveTask()}
              disabled={!draft.title.trim() || !draft.dateKey || !draft.quadrant}
              className="h-10 rounded-xl bg-blue-600 text-white px-4 font-black text-sm disabled:opacity-40"
            >
              {editingTaskId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
