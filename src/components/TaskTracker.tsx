import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  History,
  ListChecks,
  Pencil,
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
  focusMode?: boolean;
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
  focusMode = false,
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
      className="tools-workspace-view lg:overflow-y-auto"
    >
      <section id="task-planner-calendar" aria-label="Task planner calendar" className="system-planning-surface h-[calc(100dvh-9.5rem)] min-h-[320px] sm:h-[calc(100dvh-8.5rem)] sm:min-h-[420px] md:h-[calc(100dvh-7.5rem)] md:min-h-[480px] lg:h-[min(720px,calc(100dvh-7rem))] lg:min-h-[520px] overflow-hidden border-0 bg-white dark:bg-slate-950 flex flex-col">
        {!focusMode && <div className="tools-view-header">
          <div className="min-w-0"><h2 className="tools-view-title">Task Planner</h2><p className="tools-view-subtitle">{todayTasks.length} today · {completedToday} completed · {weekTasks.length} this week</p></div>
        </div>}
        {!focusMode && formOpen && (
          <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 px-3 sm:px-4 py-3">
            <div className="flex items-center justify-between mb-2"><div className="text-sm font-semibold">{editingTaskId ? 'Edit task' : 'Add task'}</div><button type="button" onClick={closeForm} className="w-11 h-11 sm:w-8 sm:h-8 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Close task editor"><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,1fr)_160px_220px_auto] gap-2">
              <input autoFocus value={draft.title} onChange={e=>setDraft(v=>({...v,title:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'&&draft.quadrant)void saveTask()}} placeholder="What needs to be done?" className="h-11 sm:h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"/>
              <input type="date" value={draft.dateKey} onChange={e=>setDraft(v=>({...v,dateKey:e.target.value}))} className="h-11 sm:h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 text-sm outline-none focus:border-blue-500"/>
              <select value={draft.quadrant} onChange={e=>setDraft(v=>({...v,quadrant:e.target.value as MatrixQuadrant|''}))} className="h-11 sm:h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 text-sm outline-none focus:border-blue-500"><option value="">Priority / quadrant</option>{QUADRANTS.map(item=><option key={item.value} value={item.value}>{item.roman} · {item.label}</option>)}</select>
              <button type="button" onClick={()=>void saveTask()} disabled={isSavingTask||!draft.title.trim()||!draft.dateKey||!draft.quadrant} className="tools-primary-action h-11 sm:h-9 px-4 text-sm font-medium disabled:opacity-40">{isSavingTask?'Saving…':editingTaskId?'Update':'Add task'}</button>
            </div>
            <textarea value={draft.notes} onChange={e=>setDraft(v=>({...v,notes:e.target.value}))} placeholder="Add notes (optional)" rows={2} className="mt-2 w-full min-h-[72px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"/>
          </div>
        )}
        <div className="min-h-0 flex-1 bg-white dark:bg-slate-950">
        <CalendarWorkspace
          tasks={tasks}
          habits={habits}
          onAddTask={onAddTask}
          onToggleTaskStatus={onToggleTaskStatus}
          onUpdateTask={onUpdateTask}
          onUpdateHabit={onUpdateHabit}
          density="compact"
          focusMode={focusMode}
        />
        </div>
      </section>



    </div>
  );
};
