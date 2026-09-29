import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  Check,
  Circle,
  CircleSlash2,
  Clock3,
  Flame,
  GripVertical,
  Lightbulb,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Siren,
  Sparkles,
  Target,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import { MatrixQuadrant, TaskItem, ToolsDensity } from '../types';
import { areDatesEqual, CONFIGURED_TIMEZONE } from '../utils/taskDateUtils';
import { useCurrentDateKey } from '../hooks/useCurrentDateKey';

interface EisenhowerMatrixProps {
  tasks: TaskItem[];
  onAddTask: (task: Omit<TaskItem, 'id'>) => Promise<void>;
  onUpdateTask: (task: TaskItem) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onToggleTaskStatus: (taskId: string) => Promise<void>;
  isSyncing?: boolean;
  density?: ToolsDensity;
}

type QuadrantColor =
  | 'rose'
  | 'amber'
  | 'indigo'
  | 'emerald'
  | 'blue'
  | 'violet'
  | 'cyan'
  | 'slate';

type QuadrantIcon =
  | 'siren'
  | 'calendar'
  | 'users'
  | 'ban'
  | 'target'
  | 'flame'
  | 'lightbulb'
  | 'sparkles';

type QuadrantDisplay = {
  id: MatrixQuadrant;
  roman: string;
  title: string;
  action: string;
  color: QuadrantColor;
  icon: QuadrantIcon;
};

type EditableQuadrant = Pick<
  QuadrantDisplay,
  'title' | 'action' | 'color' | 'icon'
>;

const MATRIX_SETTINGS_KEY = 'SYSTEM_BUILDER_MATRIX_SETTINGS_V2';
const LEGACY_MATRIX_SETTINGS_KEY = 'SYSTEM_BUILDER_MATRIX_LABELS_V1';

const QUADRANT_THEMES: Record<
  QuadrantColor,
  {
    label: string;
    header: string;
    border: string;
    dot: string;
    surface: string;
    iconSurface: string;
    iconText: string;
    accentBorder: string;
  }
> = {
  rose: {
    label: 'Rose',
    header: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    surface: 'bg-rose-50/35',
    iconSurface: 'bg-rose-100',
    iconText: 'text-rose-700',
    accentBorder: 'border-rose-200',
  },
  amber: {
    label: 'Amber',
    header: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    surface: 'bg-amber-50/35',
    iconSurface: 'bg-amber-100',
    iconText: 'text-amber-700',
    accentBorder: 'border-amber-200',
  },
  indigo: {
    label: 'Indigo',
    header: 'text-indigo-700',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
    surface: 'bg-indigo-50/35',
    iconSurface: 'bg-indigo-100',
    iconText: 'text-indigo-700',
    accentBorder: 'border-indigo-200',
  },
  emerald: {
    label: 'Emerald',
    header: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    surface: 'bg-emerald-50/35',
    iconSurface: 'bg-emerald-100',
    iconText: 'text-emerald-700',
    accentBorder: 'border-emerald-200',
  },
  blue: {
    label: 'Blue',
    header: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    surface: 'bg-blue-50/35',
    iconSurface: 'bg-blue-100',
    iconText: 'text-blue-700',
    accentBorder: 'border-blue-200',
  },
  violet: {
    label: 'Violet',
    header: 'text-violet-700',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
    surface: 'bg-violet-50/35',
    iconSurface: 'bg-violet-100',
    iconText: 'text-violet-700',
    accentBorder: 'border-violet-200',
  },
  cyan: {
    label: 'Cyan',
    header: 'text-cyan-700',
    border: 'border-cyan-200',
    dot: 'bg-cyan-500',
    surface: 'bg-cyan-50/35',
    iconSurface: 'bg-cyan-100',
    iconText: 'text-cyan-700',
    accentBorder: 'border-cyan-200',
  },
  slate: {
    label: 'Slate',
    header: 'text-slate-700',
    border: 'border-slate-300',
    dot: 'bg-slate-500',
    surface: 'bg-slate-50/45',
    iconSurface: 'bg-slate-200',
    iconText: 'text-slate-700',
    accentBorder: 'border-slate-300',
  },
};

const QUADRANT_ICONS: Record<
  QuadrantIcon,
  {
    label: string;
    component: React.ComponentType<{ className?: string }>;
  }
> = {
  siren: { label: 'Urgent', component: Siren },
  calendar: { label: 'Schedule', component: CalendarClock },
  users: { label: 'Delegate', component: UsersRound },
  ban: { label: 'Eliminate', component: CircleSlash2 },
  target: { label: 'Target', component: Target },
  flame: { label: 'Focus', component: Flame },
  lightbulb: { label: 'Ideas', component: Lightbulb },
  sparkles: { label: 'Improve', component: Sparkles },
};

const COLOR_OPTIONS = Object.keys(QUADRANT_THEMES) as QuadrantColor[];
const ICON_OPTIONS = Object.keys(QUADRANT_ICONS) as QuadrantIcon[];

const DEFAULT_QUADRANTS: QuadrantDisplay[] = [
  {
    id: 'urgent-important',
    roman: 'I',
    title: 'Urgent & Important',
    action: 'Do first',
    color: 'rose',
    icon: 'siren',
  },
  {
    id: 'important',
    roman: 'II',
    title: 'Not Urgent & Important',
    action: 'Schedule',
    color: 'amber',
    icon: 'calendar',
  },
  {
    id: 'urgent',
    roman: 'III',
    title: 'Urgent & Unimportant',
    action: 'Delegate',
    color: 'indigo',
    icon: 'users',
  },
  {
    id: 'neither',
    roman: 'IV',
    title: 'Not Urgent & Unimportant',
    action: 'Eliminate',
    color: 'emerald',
    icon: 'ban',
  },
];

const QUADRANT_IDS = DEFAULT_QUADRANTS.map((quadrant) => quadrant.id);

const PRIORITY_OPTIONS: Array<{
  value: NonNullable<TaskItem['priority']>;
  label: string;
  classes: string;
}> = [
  {
    value: 'High',
    label: 'High',
    classes: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    value: 'Medium',
    label: 'Medium',
    classes: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    value: 'Normal',
    label: 'Normal',
    classes: 'bg-slate-50 text-slate-600 border-slate-200 dark:border-slate-800',
  },
];

function inferQuadrant(task: TaskItem): MatrixQuadrant {
  if (task.matrixQuadrant) return task.matrixQuadrant;
  if (task.priority === 'High') return 'urgent-important';
  if (task.priority === 'Medium') return 'important';
  return 'neither';
}

function defaultPriorityForQuadrant(
  quadrant: MatrixQuadrant
): NonNullable<TaskItem['priority']> {
  if (quadrant === 'urgent-important') return 'High';
  if (quadrant === 'important' || quadrant === 'urgent') return 'Medium';
  return 'Normal';
}

function loadQuadrantLabels(): Record<MatrixQuadrant, EditableQuadrant> {
  const defaults = Object.fromEntries(
    DEFAULT_QUADRANTS.map((quadrant) => [
      quadrant.id,
      {
        title: quadrant.title,
        action: quadrant.action,
        color: quadrant.color,
        icon: quadrant.icon,
      },
    ])
  ) as Record<MatrixQuadrant, EditableQuadrant>;

  if (typeof window === 'undefined') return defaults;

  try {
    const saved =
      localStorage.getItem(MATRIX_SETTINGS_KEY) ||
      localStorage.getItem(LEGACY_MATRIX_SETTINGS_KEY);
    if (!saved) return defaults;

    const parsed = JSON.parse(saved) as Partial<
      Record<MatrixQuadrant, Partial<EditableQuadrant>>
    >;

    QUADRANT_IDS.forEach((id) => {
      const savedQuadrant = parsed[id];
      if (!savedQuadrant) return;

      if (
        typeof savedQuadrant.title === 'string' &&
        savedQuadrant.title.trim()
      ) {
        defaults[id].title = savedQuadrant.title.trim();
      }

      if (
        typeof savedQuadrant.action === 'string' &&
        savedQuadrant.action.trim()
      ) {
        defaults[id].action = savedQuadrant.action.trim();
      }

      if (
        savedQuadrant.color &&
        COLOR_OPTIONS.includes(savedQuadrant.color)
      ) {
        defaults[id].color = savedQuadrant.color;
      }

      if (
        savedQuadrant.icon &&
        ICON_OPTIONS.includes(savedQuadrant.icon)
      ) {
        defaults[id].icon = savedQuadrant.icon;
      }
    });

    localStorage.setItem(MATRIX_SETTINGS_KEY, JSON.stringify(defaults));
  } catch (error) {
    console.warn('Unable to load Eisenhower Matrix settings:', error);
  }

  return defaults;
}

export const EisenhowerMatrix: React.FC<EisenhowerMatrixProps> = ({
  tasks,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onToggleTaskStatus,
  isSyncing = false,
  density = 'compact',
}) => {
  const [drafts, setDrafts] = useState<Record<MatrixQuadrant, string>>({
    'urgent-important': '',
    important: '',
    urgent: '',
    neither: '',
  });
  const [quadrantLabels, setQuadrantLabels] = useState<
    Record<MatrixQuadrant, EditableQuadrant>
  >(loadQuadrantLabels);
  const [editingQuadrant, setEditingQuadrant] =
    useState<MatrixQuadrant | null>(null);
  const [quadrantEditDraft, setQuadrantEditDraft] =
    useState<EditableQuadrant | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<MatrixQuadrant | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const compact = density === 'compact';
  const todayTaskKey = useCurrentDateKey(CONFIGURED_TIMEZONE);
  const todayTasks = useMemo(
    () => tasks.filter((task) => areDatesEqual(task.taskKey, todayTaskKey)),
    [tasks, todayTaskKey]
  );

  const quadrants = useMemo(
    () =>
      DEFAULT_QUADRANTS.map((quadrant) => ({
        ...quadrant,
        ...quadrantLabels[quadrant.id],
      })),
    [quadrantLabels]
  );

  const grouped = useMemo(() => {
    const result: Record<MatrixQuadrant, TaskItem[]> = {
      'urgent-important': [],
      important: [],
      urgent: [],
      neither: [],
    };

    todayTasks.forEach((task) => {
      if (!showCompleted && task.isCompleted) return;
      result[inferQuadrant(task)].push(task);
    });

    Object.values(result).forEach((items) =>
      items.sort(
        (a, b) =>
          Number(a.isCompleted) - Number(b.isCompleted) ||
          b.taskKey.localeCompare(a.taskKey)
      )
    );

    return result;
  }, [todayTasks, showCompleted]);


  const persistQuadrantLabels = (
    next: Record<MatrixQuadrant, EditableQuadrant>
  ) => {
    setQuadrantLabels(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(MATRIX_SETTINGS_KEY, JSON.stringify(next));
    }
  };

  const beginQuadrantEdit = (quadrant: QuadrantDisplay) => {
    setEditingQuadrant(quadrant.id);
    setQuadrantEditDraft({
      title: quadrant.title,
      action: quadrant.action,
      color: quadrant.color,
      icon: quadrant.icon,
    });
  };

  const cancelQuadrantEdit = () => {
    setEditingQuadrant(null);
    setQuadrantEditDraft(null);
  };

  const saveQuadrantEdit = (quadrantId: MatrixQuadrant) => {
    if (!quadrantEditDraft) return;

    const title = quadrantEditDraft.title.trim();
    const action = quadrantEditDraft.action.trim();
    if (!title || !action) return;

    persistQuadrantLabels({
      ...quadrantLabels,
      [quadrantId]: {
        title,
        action,
        color: quadrantEditDraft.color,
        icon: quadrantEditDraft.icon,
      },
    });
    cancelQuadrantEdit();
  };

  const resetQuadrant = (quadrantId: MatrixQuadrant) => {
    const original = DEFAULT_QUADRANTS.find(
      (quadrant) => quadrant.id === quadrantId
    );
    if (!original) return;

    persistQuadrantLabels({
      ...quadrantLabels,
      [quadrantId]: {
        title: original.title,
        action: original.action,
        color: original.color,
        icon: original.icon,
      },
    });

    setQuadrantEditDraft({
      title: original.title,
      action: original.action,
      color: original.color,
      icon: original.icon,
    });
  };

  const addTask = async (quadrant: MatrixQuadrant) => {
    const title = drafts[quadrant].trim();
    if (!title) return;

    try {
      setError(null);
      await onAddTask({
        taskKey: todayTaskKey,
        taskOfTheDay: title,
        isCompleted: false,
        priority: defaultPriorityForQuadrant(quadrant),
        category: 'Eisenhower Matrix',
        matrixQuadrant: quadrant,
      });
      setDrafts((current) => ({ ...current, [quadrant]: '' }));
    } catch (err: any) {
      setError(err?.message || 'Unable to add task.');
    }
  };

  const moveTask = async (taskId: string, quadrant: MatrixQuadrant) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || inferQuadrant(task) === quadrant) return;

    try {
      setBusyTaskId(taskId);
      setError(null);

      await onUpdateTask({
        ...task,
        matrixQuadrant: quadrant,
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to move task.');
    } finally {
      setBusyTaskId(null);
      setDraggedTaskId(null);
      setDragOver(null);
    }
  };

  const updatePriority = async (
    task: TaskItem,
    priority: NonNullable<TaskItem['priority']>
  ) => {
    if ((task.priority || 'Normal') === priority) return;

    try {
      setBusyTaskId(task.id);
      setError(null);
      await onUpdateTask({
        ...task,
        priority,
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to update task priority.');
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    quadrant: MatrixQuadrant
  ) => {
    event.preventDefault();
    const taskId =
      event.dataTransfer.getData('text/task-id') || draggedTaskId || '';
    if (taskId) await moveTask(taskId, quadrant);
  };

  const endDrag = () => {
    setDraggedTaskId(null);
    setDragOver(null);
  };


  return (
    <div
      className="tools-workspace-view lg:flex lg:flex-col"
    >
      <div className="tools-view-header lg:shrink-0">
        <div><h2 className="tools-view-title">Eisenhower Matrix</h2><p className="tools-view-subtitle">Prioritize today's tasks by importance and urgency.</p></div>
        <label className="matrix-mobile-filter min-h-11 sm:min-h-0 px-2 sm:px-0 rounded-lg sm:rounded-none inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 shrink-0">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(event) => setShowCompleted(event.target.checked)}
          />
          Show completed
        </label>
      </div>

      {error && (
        <div className="tools-feedback-error flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100 dark:bg-slate-800 flex-1 min-h-0 lg:grid-rows-2">
        {quadrants.map((quadrant) => {
          const theme = QUADRANT_THEMES[quadrant.color];
          const QuadrantIconComponent =
            QUADRANT_ICONS[quadrant.icon].component;
          const isEditing = editingQuadrant === quadrant.id;
          const isDropTarget = dragOver === quadrant.id;
          const draggedTask = draggedTaskId
            ? tasks.find((task) => task.id === draggedTaskId)
            : null;
          const sameQuadrant =
            draggedTask && inferQuadrant(draggedTask) === quadrant.id;

          return (
            <div
              key={quadrant.id}
              id={`matrix-panel-${quadrant.id}`}
              role="tabpanel"
              aria-label={`Quadrant ${quadrant.roman}: ${quadrant.title}`}
              onDragEnter={(event) => {
                if (!draggedTaskId) return;
                event.preventDefault();
                setDragOver(quadrant.id);
              }}
              onDragOver={(event) => {
                if (!draggedTaskId) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDragOver(quadrant.id);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                setDragOver((current) =>
                  current === quadrant.id ? null : current
                );
              }}
              onDrop={(event) => void handleDrop(event, quadrant.id)}
              className={`relative min-h-[280px] sm:min-h-[300px] lg:min-h-0 border-0 transition-colors overflow-hidden flex flex-col bg-white dark:bg-slate-950 ${
                isDropTarget && draggedTaskId
                  ? sameQuadrant
                    ? 'ring-2 ring-slate-300 ring-offset-2 ring-offset-slate-50'
                    : 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-50 '
                  : ''
              }`}
            >
              {isDropTarget && draggedTaskId && (
                <div
                  className={`absolute inset-0 z-20 rounded-xl pointer-events-none flex items-center justify-center ${
                    sameQuadrant ? 'bg-slate-100/65' : 'bg-blue-50/75'
                  }`}
                >
                  <div
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold  ${
                      sameQuadrant
                        ? 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600'
                        : 'bg-white dark:bg-slate-950 border-blue-200 text-blue-700'
                    }`}
                  >
                    {sameQuadrant
                      ? `Already in ${quadrant.title}`
                      : `Drop in ${quadrant.title}`}
                  </div>
                </div>
              )}

              <div className={`${compact ? 'px-4 py-3' : 'px-4 py-3'} border-b border-slate-100 bg-white dark:bg-slate-950/65 flex items-start justify-between gap-2 shrink-0`}>
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <div className="relative shrink-0 mt-0.5">
                    <span
                      className={`w-8 h-8 rounded-lg border ${theme.iconSurface} ${theme.iconText} ${theme.accentBorder} flex items-center justify-center`}
                      title={QUADRANT_ICONS[quadrant.icon].label}
                    >
                      <QuadrantIconComponent className="w-4 h-4" />
                    </span>
                    <span
                      className={`absolute -right-1.5 -bottom-1.5 min-w-4 h-4 px-1 rounded-full ${theme.dot} text-white flex items-center justify-center text-[11px] font-semibold `}
                    >
                      {quadrant.roman}
                    </span>
                  </div>

                  {isEditing && quadrantEditDraft ? (
                    <div className="min-w-0 flex-1 space-y-2">
                      <input
                        value={quadrantEditDraft.title}
                        onChange={(event) =>
                          setQuadrantEditDraft((current) =>
                            current
                              ? { ...current, title: event.target.value }
                              : current
                          )
                        }
                        className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-sm font-semibold outline-none focus:border-blue-400"
                        aria-label={`Edit quadrant ${quadrant.roman} title`}
                      />
                      <input
                        value={quadrantEditDraft.action}
                        onChange={(event) =>
                          setQuadrantEditDraft((current) =>
                            current
                              ? { ...current, action: event.target.value }
                              : current
                          )
                        }
                        className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-[11px] font-medium outline-none focus:border-blue-400"
                        aria-label={`Edit quadrant ${quadrant.roman} action`}
                      />
                      <div className="rounded-xl border border-black/10 bg-white dark:bg-slate-950 p-2.5 space-y-2.5">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5">
                            Color theme
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {COLOR_OPTIONS.map((color) => {
                              const optionTheme = QUADRANT_THEMES[color];
                              const selected =
                                quadrantEditDraft.color === color;
                              return (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() =>
                                    setQuadrantEditDraft((current) =>
                                      current
                                        ? { ...current, color }
                                        : current
                                    )
                                  }
                                  className={`w-7 h-7 rounded-full ${optionTheme.dot} transition-colors ${
                                    selected
                                      ? 'ring-2 ring-offset-2 ring-[#0f172a] scale-105'
                                      : 'hover:scale-105'
                                  }`}
                                  title={optionTheme.label}
                                  aria-label={`Use ${optionTheme.label} quadrant color`}
                                />
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5">
                            Icon
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {ICON_OPTIONS.map((icon) => {
                              const option = QUADRANT_ICONS[icon];
                              const IconComponent = option.component;
                              const selected =
                                quadrantEditDraft.icon === icon;
                              const selectedTheme =
                                QUADRANT_THEMES[quadrantEditDraft.color];

                              return (
                                <button
                                  key={icon}
                                  type="button"
                                  onClick={() =>
                                    setQuadrantEditDraft((current) =>
                                      current
                                        ? { ...current, icon }
                                        : current
                                    )
                                  }
                                  className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                                    selected
                                      ? `${selectedTheme.iconSurface} ${selectedTheme.iconText} ${selectedTheme.accentBorder} ring-1 ring-current`
                                      : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-blue-300 hover:text-blue-600'
                                  }`}
                                  title={option.label}
                                  aria-label={`Use ${option.label} icon`}
                                >
                                  <IconComponent className="w-4 h-4" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => saveQuadrantEdit(quadrant.id)}
                          disabled={
                            !quadrantEditDraft.title.trim() ||
                            !quadrantEditDraft.action.trim()
                          }
                          className="h-7 px-2 rounded-lg bg-blue-600 text-white inline-flex items-center gap-1 text-[10px] font-semibold disabled:opacity-40"
                        >
                          <Save className="w-2.5 h-2.5" />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => resetQuadrant(quadrant.id)}
                          className="h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-800 inline-flex items-center gap-1 text-[10px] font-semibold hover:bg-slate-100"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={cancelQuadrantEdit}
                          className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-slate-100"
                          aria-label="Cancel quadrant editing"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <div className={`text-[13px] font-medium ${theme.header}`}>
                        {quadrant.title}
                      </div>
                      <div className="text-[10px] font-medium text-slate-500">
                        {quadrant.action}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => beginQuadrantEdit(quadrant)}
                      className="w-7 h-7 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center"
                      title="Edit quadrant"
                      aria-label={`Edit ${quadrant.title}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <span
                    className={`min-w-6 h-6 px-1.5 rounded-full border ${theme.iconSurface} ${theme.iconText} ${theme.accentBorder} flex items-center justify-center text-xs font-semibold`}
                  >
                    {grouped[quadrant.id].length}
                  </span>
                </div>
              </div>

              <div
                className={`${compact ? 'p-3 space-y-2' : 'p-3 space-y-2.5'} flex-1 min-h-0 overflow-y-auto`}
              >
                {grouped[quadrant.id].length === 0 ? (
                  <div
                    className={`min-h-[96px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-sm font-semibold transition ${
                      draggedTaskId
                        ? 'border-blue-200 bg-blue-50/40 text-blue-600'
                        : `${theme.border} ${theme.iconText} bg-white dark:bg-slate-950`
                    }`}
                  >
                    <GripVertical className="w-5 h-5 mb-1 opacity-60" />
                    {draggedTaskId ? 'Drop task here' : 'No tasks'}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {grouped[quadrant.id].map((task) => (
                      <div
                        key={task.id}
                        className={`rounded-md bg-white dark:bg-slate-950/80 px-2.5 py-1.5 text-[13px] font-medium leading-5 ${
                          task.isCompleted
                            ? 'line-through text-slate-400'
                            : 'text-slate-800'
                        }`}
                      >
                        {task.taskOfTheDay}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
