import React, { useMemo, useRef, useState } from 'react';
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
  notes: string;
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
    setDraft({ title: '', dateKey: today, quadrant: '', notes: '' });
    setFormOpen(true);
  };

  const openEdit = (task: TaskItem) => {
    setEditingTaskId(task.id);
    setDraft({
      title: task.taskOfTheDay,
      dateKey: task.taskKey,
      quadrant: task.matrixQuadrant || '',
      notes: task.notes || '',
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingTaskId(null);
    setDraft({ title: '', dateKey: today, quadrant: '', notes: '' });
  };

  const savingTaskRef = useRef(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const saveTask = async () => {
    if (savingTaskRef.current) return;
    const title = draft.title.trim();
    if (!title || !draft.dateKey || !draft.quadrant) return;

    savingTaskRef.current = true;
    setIsSavingTask(true);
    try {
      if (editingTaskId) {
        const existing = tasks.find((task) => task.id === editingTaskId);
        if (!existing) return;

        await onUpdateTask({
          ...existing,
          taskOfTheDay: title,
          taskKey: draft.dateKey,
          matrixQuadrant: draft.quadrant,
          priority: priorityForQuadrant(draft.quadrant),
          notes: draft.notes.trim(),
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
          notes: draft.notes.trim(),
          updatedAt: new Date().toISOString(),
        });
      }

      closeForm();
    } finally {
      savingTaskRef.current = false;
      setIsSavingTask(false);
    }
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

  const deletingTaskIdsRef = useRef(new Set<string>());
  const deleteTask = async (taskId: string) => {
    // Guard against duplicate click/bubbled events while the first delete is running.
    if (deletingTaskIdsRef.current.has(taskId)) return;
    deletingTaskIdsRef.current.add(taskId);
    try {
      if (historyTaskId === taskId) setHistoryTaskId(null);
      if (editingTaskId === taskId) closeForm();
      await onDeleteTask(taskId);
    } finally {
      deletingTaskIdsRef.current.delete(taskId);
    }
  };

  return (
    <div
      className={`${compact ? 'space-y-2' : 'space-y-4'} lg:h-full lg:overflow-y-auto lg:pr-1`}
    >
      <section id="task-planner-calendar" aria-label="Task planner calendar" className="system-planning-surface h-[680px] lg:h-[720px] min-h-[640px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs flex flex-col">
        <div className="px-3 sm:px-4 pt-3 pb-2 border-b border-slate-100 bg-slate-50/60">
          <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-slate-400">Plan ahead</p>
          <h2 className="text-sm font-bold text-slate-800">Task Planner</h2>
        </div>
        <div className="min-h-0 flex-1">
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
      </section>

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
              disabled={isSavingTask || !draft.title.trim() || !draft.dateKey || !draft.quadrant}
              className="h-10 rounded-xl bg-blue-600 text-white px-4 font-black text-sm disabled:opacity-40"
            >
              {isSavingTask ? 'Saving…' : editingTaskId ? 'Update' : 'Save'}
            </button>
          <textarea
            value={draft.notes}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                notes: event.target.value,
              }))
            }
            placeholder="Notes"
            rows={3}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none resize-y focus:border-blue-400"
          />
          </div>
        </div>
      )}

    </div>
  );
};
