import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { TaskItem } from '../types';

interface TaskSearchDialogProps {
  tasks: TaskItem[];
  onClose: () => void;
}

export const TaskSearchDialog: React.FC<TaskSearchDialogProps> = ({ tasks, onClose }) => {
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks.slice(0, 12);
    return tasks.filter((task) =>
      [task.taskOfTheDay, task.notes || '', task.taskKey]
        .some((value) => value.toLowerCase().includes(q))
    ).slice(0, 30);
  }, [query, tasks]);

  return (
    <div className="fixed inset-0 z-[180] bg-slate-950/40 backdrop-blur-[2px] p-0 sm:p-6 flex items-end sm:items-start justify-center" role="dialog" aria-modal="true" aria-label="Search tasks" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mt-[8vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 p-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && onClose()} placeholder="Search task title, notes, or date…" className="min-w-0 flex-1 bg-transparent outline-none text-sm text-slate-900 dark:text-slate-100" />
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-lg inline-flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close search"><X className="w-4 h-4" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {results.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No matching tasks.</div> : results.map((task) => (
            <div key={task.id} className="p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/70 flex items-start justify-between gap-3">
              <div className="min-w-0"><div className={`text-sm font-semibold ${task.isCompleted ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>{task.taskOfTheDay}</div>{task.notes && <div className="mt-1 text-xs text-slate-500 line-clamp-2">{task.notes}</div>}</div>
              <span className="shrink-0 text-[10px] font-mono text-slate-400">{task.taskKey}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
