import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  Check,
  Circle,
  Clock3,
  Plus,
  Trash2,
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

const QUADRANTS: Array<{
  id: MatrixQuadrant;
  roman: string;
  title: string;
  action: string;
  header: string;
  border: string;
  dot: string;
}> = [
  {
    id: 'urgent-important',
    roman: 'I',
    title: 'Urgent & Important',
    action: 'Do first',
    header: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  {
    id: 'important',
    roman: 'II',
    title: 'Not Urgent & Important',
    action: 'Schedule',
    header: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  {
    id: 'urgent',
    roman: 'III',
    title: 'Urgent & Unimportant',
    action: 'Delegate',
    header: 'text-indigo-700',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  {
    id: 'neither',
    roman: 'IV',
    title: 'Not Urgent & Unimportant',
    action: 'Eliminate',
    header: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
];

function inferQuadrant(task: TaskItem): MatrixQuadrant {
  if (task.matrixQuadrant) return task.matrixQuadrant;
  if (task.priority === 'High') return 'urgent-important';
  if (task.priority === 'Medium') return 'important';
  return 'neither';
}

function priorityForQuadrant(quadrant: MatrixQuadrant): TaskItem['priority'] {
  if (quadrant === 'urgent-important') return 'High';
  if (quadrant === 'important' || quadrant === 'urgent') return 'Medium';
  return 'Normal';
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
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<MatrixQuadrant | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      items.sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted) || b.taskKey.localeCompare(a.taskKey))
    );
    return result;
  }, [tasks, showCompleted]);

  const addTask = async (quadrant: MatrixQuadrant) => {
    const title = drafts[quadrant].trim();
    if (!title) return;
    try {
      setError(null);
      await onAddTask({
        taskKey: getIsoDateKeyInTimezone(0, CONFIGURED_TIMEZONE),
        taskOfTheDay: title,
        isCompleted: false,
        priority: priorityForQuadrant(quadrant),
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
        priority: priorityForQuadrant(quadrant),
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to move task.');
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>, quadrant: MatrixQuadrant) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData('text/task-id');
    setDragOver(null);
    if (taskId) await moveTask(taskId, quadrant);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] font-black text-blue-600">Priority workspace</p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight">Eisenhower Matrix</h2>
          <p className="mt-1 text-sm font-semibold text-[#766653]">
            Drag tasks between quadrants. Changes stay attached to the same System Builder task.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs font-bold text-[#766653]">
            {tasks.filter((task) => !task.isCompleted).length} active • {tasks.filter((task) => task.isCompleted).length} done
          </div>
          <label className="inline-flex items-center gap-2 rounded-xl border border-[#dfd1b6] bg-[#fffaf0] px-3 h-9 text-xs font-black">
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
        {QUADRANTS.map((quadrant) => (
          <div
            key={quadrant.id}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(quadrant.id);
            }}
            onDragLeave={() => setDragOver((current) => (current === quadrant.id ? null : current))}
            onDrop={(event) => handleDrop(event, quadrant.id)}
            className={`min-h-[280px] rounded-2xl border bg-[#fffaf0] transition-all ${
              quadrant.border
            } ${dragOver === quadrant.id ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-[#f4ecd8]' : ''}`}
          >
            <div className="px-4 py-3 border-b border-black/8 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-6 h-6 rounded-full ${quadrant.dot} text-white flex items-center justify-center text-[10px] font-black shrink-0`}>
                  {quadrant.roman}
                </span>
                <div className="min-w-0">
                  <div className={`text-sm font-black ${quadrant.header}`}>{quadrant.title}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8b7a66]">{quadrant.action}</div>
                </div>
              </div>
              <span className="text-xs font-black text-[#8b7a66]">{grouped[quadrant.id].length}</span>
            </div>

            <div className="p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  value={drafts[quadrant.id]}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [quadrant.id]: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void addTask(quadrant.id);
                  }}
                  placeholder="Add task..."
                  className="min-w-0 flex-1 h-9 rounded-xl border border-[#dfd1b6] bg-white/80 px-3 text-sm font-semibold outline-none focus:border-blue-400"
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
                <div className="min-h-[170px] flex items-center justify-center text-sm font-semibold text-[#a18f78]">
                  No tasks
                </div>
              ) : (
                <div className="space-y-2">
                  {grouped[quadrant.id].map((task) => (
                    <div
                      key={task.id}
                      draggable={!task.isCompleted}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/task-id', task.id);
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      className={`rounded-xl border border-[#e7dbc4] bg-white/85 px-3 py-2.5 shadow-sm ${
                        busyTaskId === task.id ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => void onToggleTaskStatus(task.id)}
                          className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            task.isCompleted
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-[#b9aa91] text-transparent hover:border-blue-500'
                          }`}
                          aria-label={task.isCompleted ? 'Mark task incomplete' : 'Mark task complete'}
                        >
                          {task.isCompleted ? <Check className="w-3 h-3" /> : <Circle className="w-2 h-2" />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className={`text-sm font-bold break-words ${task.isCompleted ? 'line-through text-[#9e8f7b]' : 'text-[#3f3426]'}`}>
                            {task.taskOfTheDay}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-[#8b7a66]">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />
                              {task.taskKey}
                            </span>
                            {task.timeEstimate && (
                              <span className="inline-flex items-center gap-1">
                                <Clock3 className="w-3 h-3" />
                                {task.timeEstimate}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => void onDeleteTask(task.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#a18f78] hover:text-rose-600 hover:bg-rose-50"
                          title="Delete task"
                          aria-label="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
