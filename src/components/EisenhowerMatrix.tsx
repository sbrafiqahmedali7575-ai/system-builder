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
import { MatrixQuadrant, TaskItem } from '../types';
import { CONFIGURED_TIMEZONE, getIsoDateKeyInTimezone } from '../utils/taskDateUtils';

interface EisenhowerMatrixProps {
  tasks: TaskItem[];
  onAddTask: (task: Omit<TaskItem, 'id'>) => Promise<void>;
  onUpdateTask: (task: TaskItem) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onToggleTaskStatus: (taskId: string) => Promise<void>;
  isSyncing?: boolean;
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
    surface: 'bg-rose-50/55',
    iconSurface: 'bg-rose-100',
    iconText: 'text-rose-700',
    accentBorder: 'border-rose-200',
  },
  amber: {
    label: 'Amber',
    header: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    surface: 'bg-amber-50/55',
    iconSurface: 'bg-amber-100',
    iconText: 'text-amber-700',
    accentBorder: 'border-amber-200',
  },
  indigo: {
    label: 'Indigo',
    header: 'text-indigo-700',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
    surface: 'bg-indigo-50/55',
    iconSurface: 'bg-indigo-100',
    iconText: 'text-indigo-700',
    accentBorder: 'border-indigo-200',
  },
  emerald: {
    label: 'Emerald',
    header: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    surface: 'bg-emerald-50/55',
    iconSurface: 'bg-emerald-100',
    iconText: 'text-emerald-700',
    accentBorder: 'border-emerald-200',
  },
  blue: {
    label: 'Blue',
    header: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    surface: 'bg-blue-50/55',
    iconSurface: 'bg-blue-100',
    iconText: 'text-blue-700',
    accentBorder: 'border-blue-200',
  },
  violet: {
    label: 'Violet',
    header: 'text-violet-700',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
    surface: 'bg-violet-50/55',
    iconSurface: 'bg-violet-100',
    iconText: 'text-violet-700',
    accentBorder: 'border-violet-200',
  },
  cyan: {
    label: 'Cyan',
    header: 'text-cyan-700',
    border: 'border-cyan-200',
    dot: 'bg-cyan-500',
    surface: 'bg-cyan-50/55',
    iconSurface: 'bg-cyan-100',
    iconText: 'text-cyan-700',
    accentBorder: 'border-cyan-200',
  },
  slate: {
    label: 'Slate',
    header: 'text-slate-700',
    border: 'border-slate-300',
    dot: 'bg-slate-500',
    surface: 'bg-slate-50/70',
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
    classes: 'bg-slate-50 text-slate-600 border-slate-200',
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

    tasks.forEach((task) => {
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
  }, [tasks, showCompleted]);

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
        taskKey: getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE),
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] font-black text-blue-600">
            Priority workspace
          </p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight">
            Eisenhower Matrix
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            Drag with the grip handle, or use Move to on touch devices. Quadrant and priority are controlled separately.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {draggedTaskId && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 h-9 inline-flex items-center text-xs font-black text-blue-700">
              Dragging task • choose a quadrant
            </div>
          )}
          <div className="text-xs font-bold text-slate-600">
            {tasks.filter((task) => !task.isCompleted).length} active •{' '}
            {tasks.filter((task) => task.isCompleted).length} done
          </div>
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 h-9 text-xs font-black">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(event) => setShowCompleted(event.target.checked)}
            />
            Show completed
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
              className={`relative min-h-[300px] rounded-2xl border transition-all ${theme.border} ${theme.surface} ${
                isDropTarget && draggedTaskId
                  ? sameQuadrant
                    ? 'ring-2 ring-slate-300 ring-offset-2 ring-offset-slate-50'
                    : 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-50 shadow-lg -translate-y-0.5'
                  : ''
              }`}
            >
              {isDropTarget && draggedTaskId && (
                <div
                  className={`absolute inset-0 z-20 rounded-2xl pointer-events-none flex items-center justify-center ${
                    sameQuadrant ? 'bg-slate-100/65' : 'bg-blue-50/75'
                  }`}
                >
                  <div
                    className={`rounded-xl border px-4 py-2 text-sm font-black shadow-sm ${
                      sameQuadrant
                        ? 'bg-white border-slate-200 text-slate-600'
                        : 'bg-white border-blue-200 text-blue-700'
                    }`}
                  >
                    {sameQuadrant
                      ? `Already in ${quadrant.title}`
                      : `Drop in ${quadrant.title}`}
                  </div>
                </div>
              )}

              <div className="px-4 py-3 border-b border-slate-200/80 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <div className="relative shrink-0 mt-0.5">
                    <span
                      className={`w-9 h-9 rounded-xl border ${theme.iconSurface} ${theme.iconText} ${theme.accentBorder} flex items-center justify-center`}
                      title={QUADRANT_ICONS[quadrant.icon].label}
                    >
                      <QuadrantIconComponent className="w-4 h-4" />
                    </span>
                    <span
                      className={`absolute -right-1.5 -bottom-1.5 min-w-4 h-4 px-1 rounded-full ${theme.dot} text-white flex items-center justify-center text-[8px] font-black shadow-sm`}
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
                        className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm font-black outline-none focus:border-blue-400"
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
                        className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold outline-none focus:border-blue-400"
                        aria-label={`Edit quadrant ${quadrant.roman} action`}
                      />
                      <div className="rounded-xl border border-black/10 bg-white p-2.5 space-y-2.5">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider font-black text-slate-500 mb-1.5">
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
                                  className={`w-7 h-7 rounded-full ${optionTheme.dot} transition-all ${
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
                          <div className="text-[10px] uppercase tracking-wider font-black text-slate-500 mb-1.5">
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
                                  className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
                                    selected
                                      ? `${selectedTheme.iconSurface} ${selectedTheme.iconText} ${selectedTheme.accentBorder} ring-1 ring-current`
                                      : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600'
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
                          className="h-7 px-2 rounded-lg bg-blue-600 text-white inline-flex items-center gap-1 text-[10px] font-black disabled:opacity-40"
                        >
                          <Save className="w-3 h-3" />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => resetQuadrant(quadrant.id)}
                          className="h-7 px-2 rounded-lg border border-slate-200 inline-flex items-center gap-1 text-[10px] font-black hover:bg-slate-100"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={cancelQuadrantEdit}
                          className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100"
                          aria-label="Cancel quadrant editing"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <div className={`text-sm font-black ${theme.header}`}>
                        {quadrant.title}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
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
                    className={`min-w-7 h-7 px-2 rounded-lg border ${theme.iconSurface} ${theme.iconText} ${theme.accentBorder} flex items-center justify-center text-xs font-black`}
                  >
                    {grouped[quadrant.id].length}
                  </span>
                </div>
              </div>

              <div className="p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    value={drafts[quadrant.id]}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [quadrant.id]: event.target.value,
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void addTask(quadrant.id);
                    }}
                    placeholder="Add task..."
                    className="min-w-0 flex-1 h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => void addTask(quadrant.id)}
                    disabled={!drafts[quadrant.id].trim() || isSyncing}
                    className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center disabled:opacity-40"
                    title="Add task"
                    aria-label={`Add task to ${quadrant.title}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {grouped[quadrant.id].length === 0 ? (
                  <div
                    className={`min-h-[175px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-sm font-semibold transition ${
                      draggedTaskId
                        ? 'border-blue-200 bg-blue-50/40 text-blue-600'
                        : `${theme.border} ${theme.iconText} bg-white`
                    }`}
                  >
                    <GripVertical className="w-5 h-5 mb-1 opacity-60" />
                    {draggedTaskId ? 'Drop task here' : 'No tasks'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {grouped[quadrant.id].map((task) => {
                      const priority = task.priority || 'Normal';
                      const priorityConfig =
                        PRIORITY_OPTIONS.find((option) => option.value === priority) ||
                        PRIORITY_OPTIONS[2];
                      const dragging = draggedTaskId === task.id;

                      return (
                        <div
                          key={task.id}
                          className={`rounded-xl border ${theme.accentBorder} bg-white px-2.5 py-2.5 shadow-sm transition-all ${
                            busyTaskId === task.id ? 'opacity-60' : ''
                          } ${dragging ? 'opacity-40 scale-[0.99] border-blue-300' : ''}`}
                        >
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              draggable={!task.isCompleted}
                              onDragStart={(event) => {
                                if (task.isCompleted) {
                                  event.preventDefault();
                                  return;
                                }
                                event.dataTransfer.setData('text/task-id', task.id);
                                event.dataTransfer.effectAllowed = 'move';
                                setDraggedTaskId(task.id);
                              }}
                              onDragEnd={endDrag}
                              disabled={task.isCompleted}
                              className={`mt-0.5 w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center shrink-0 ${
                                task.isCompleted
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'text-slate-500 cursor-grab active:cursor-grabbing hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50'
                              }`}
                              title={
                                task.isCompleted
                                  ? 'Completed tasks cannot be dragged'
                                  : 'Drag task to another quadrant'
                              }
                              aria-label={`Drag ${task.taskOfTheDay}`}
                            >
                              <GripVertical className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => void onToggleTaskStatus(task.id)}
                              className={`mt-1 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                                task.isCompleted
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'border-slate-300 text-transparent hover:border-blue-500'
                              }`}
                              aria-label={
                                task.isCompleted
                                  ? 'Mark task incomplete'
                                  : 'Mark task complete'
                              }
                            >
                              {task.isCompleted ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <Circle className="w-2 h-2" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div
                                className={`text-sm font-bold break-words ${
                                  task.isCompleted
                                    ? 'line-through text-slate-500'
                                    : 'text-slate-900'
                                }`}
                              >
                                {task.taskOfTheDay}
                              </div>

                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <select
                                  value={priority}
                                  onChange={(event) =>
                                    void updatePriority(
                                      task,
                                      event.target.value as NonNullable<
                                        TaskItem['priority']
                                      >
                                    )
                                  }
                                  disabled={busyTaskId === task.id}
                                  className={`h-7 rounded-lg border px-2 text-[10px] font-black outline-none cursor-pointer ${priorityConfig.classes}`}
                                  title="Task priority"
                                  aria-label={`Priority for ${task.taskOfTheDay}`}
                                >
                                  {PRIORITY_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label} priority
                                    </option>
                                  ))}
                                </select>

                                <select
                                  value={inferQuadrant(task)}
                                  onChange={(event) =>
                                    void moveTask(
                                      task.id,
                                      event.target.value as MatrixQuadrant
                                    )
                                  }
                                  disabled={
                                    task.isCompleted || busyTaskId === task.id
                                  }
                                  className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-black text-slate-600 outline-none cursor-pointer disabled:opacity-50"
                                  title="Move task to another quadrant"
                                  aria-label={`Move ${task.taskOfTheDay}`}
                                >
                                  {quadrants.map((target) => (
                                    <option key={target.id} value={target.id}>
                                      {target.roman}. {target.title}
                                    </option>
                                  ))}
                                </select>

                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                  <CalendarDays className="w-3 h-3" />
                                  {task.taskKey}
                                </span>

                                {task.timeEstimate && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                    <Clock3 className="w-3 h-3" />
                                    {task.timeEstimate}
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => void onDeleteTask(task.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                              title="Delete task"
                              aria-label="Delete task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
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
