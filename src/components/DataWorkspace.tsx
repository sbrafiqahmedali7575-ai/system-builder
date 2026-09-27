import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Database, KeyRound, RefreshCw } from 'lucide-react';
import {
  subscribeToCanonicalData,
  type CanonicalCollectionName,
  type CanonicalDataRow,
} from '../services/firebaseService';

type SortDirection = 'asc' | 'desc';
type SortState = { column: string; direction: SortDirection } | null;

const KEY_COLUMNS: Record<CanonicalCollectionName, Record<string, 'PK' | 'FK'>> = {
  users: { userId: 'PK' },
  days: { dateKey: 'PK' },
  tasks: { taskId: 'PK', scheduledDate: 'FK' },
  habits: { habitId: 'PK' },
  habitLogs: { habitLogId: 'PK', habitId: 'FK', dateKey: 'FK' },
  countdowns: { countdownId: 'PK' },
};

const TABLE_COLUMNS: Record<CanonicalCollectionName, string[]> = {
  users: ['userId', 'name', 'email'],
  days: [
    'dateKey',
    'tasksCompleted',
    'taskTotal',
    'taskCompletionRate',
    'habitsCompleted',
    'habitTotal',
    'habitCompletionRate',
    'IsdayCompleted',
  ],
  tasks: ['taskId', 'title', 'quadrant', 'scheduledDate', 'taskOrder', 'notes', 'Iscompleted'],
  habits: ['habitId', 'name', 'repeatDays', 'activeFrom', 'isActive', 'color'],
  habitLogs: ['habitLogId', 'habitId', 'dateKey', 'Iscompleted'],
  countdowns: ['countdownId', 'title', 'targetDate', 'isActive'],
};

const COLLECTIONS: Array<{ id: CanonicalCollectionName; label: string }> = [
  { id: 'days', label: 'Days' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'habitLogs', label: 'HabitLogs' },
  { id: 'habits', label: 'Habits' },
  { id: 'countdowns', label: 'Countdowns' },
  { id: 'users', label: 'Users' },
];

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export const DataWorkspace: React.FC = () => {
  const [active, setActive] = useState<CanonicalCollectionName>('days');
  const [data, setData] = useState<Record<CanonicalCollectionName, CanonicalDataRow[]>>({
    users: [], days: [], tasks: [], habits: [], habitLogs: [], countdowns: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState>(null);

  useEffect(() => subscribeToCanonicalData(setData, (err) => setError(err.message)), []);

  const rows = data[active];
  const sortedRows = useMemo(() => {
    const effectiveSort = sort || (active === 'tasks' ? { column: 'scheduledDate', direction: 'asc' as const } : null);
    if (!effectiveSort) return rows;
    return [...rows].sort((a, b) => {
      const left = renderValue(a[effectiveSort.column]).toLocaleLowerCase();
      const right = renderValue(b[effectiveSort.column]).toLocaleLowerCase();
      const comparison = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
      return effectiveSort.direction === 'asc' ? comparison : -comparison;
    });
  }, [rows, sort, active]);

  const cycleSort = (column: string) => {
    if (!KEY_COLUMNS[active][column]) return;
    setSort((current) => {
      if (!current || current.column !== column) return { column, direction: 'asc' };
      if (current.direction === 'asc') return { column, direction: 'desc' };
      return null;
    });
  };

  const selectCollection = (collection: CanonicalCollectionName) => {
    setActive(collection);
    setSort(null);
  };
  const columns = TABLE_COLUMNS[active];

  return (
    <div className="space-y-3 lg:h-full lg:flex lg:flex-col lg:overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 lg:shrink-0">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] font-black text-blue-600">Firestore workspace</p>
        </div>
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
          <RefreshCw className="w-3.5 h-3.5" /> Live sync
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 lg:shrink-0">
        {COLLECTIONS.map((collection) => {
          const selected = active === collection.id;
          return (
            <button
              key={collection.id}
              type="button"
              onClick={() => selectCollection(collection.id)}
              className={`relative rounded-xl border px-2 py-2 text-left transition-all ${selected
                ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200'
                : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-1.5">
                <Database className={`w-3.5 h-3.5 ${selected ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className={`text-[11px] font-black truncate ${selected ? 'text-blue-800' : 'text-slate-700'}`}>
                  {collection.label}
                </span>
              </div>
              <div className="mt-1 text-lg font-black text-slate-900">{data[collection.id].length}</div>
              <div className="text-[9px] uppercase tracking-wide font-bold text-slate-400">rows</div>
            </button>
          );
        })}
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</div>}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden lg:flex-1 lg:min-h-0">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="font-black text-sm">{COLLECTIONS.find((item) => item.id === active)?.label}</div>
          <div className="text-[10px] font-bold text-slate-500">{rows.length} document{rows.length === 1 ? '' : 's'}</div>
        </div>
        <div className="overflow-auto lg:h-[calc(100%-41px)]">
          {rows.length === 0 ? (
            <div className="min-h-40 flex items-center justify-center text-sm font-bold text-slate-400">No documents</div>
          ) : (
            <table className="w-full min-w-max border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-white shadow-sm">
                <tr>
                  {columns.map((column) => {
                    const keyType = KEY_COLUMNS[active][column];
                    const isSorted = sort?.column === column;
                    return (
                      <th key={column} className="border-b border-r border-slate-200 p-0 text-[10px] uppercase tracking-wide font-black text-slate-500 whitespace-nowrap">
                        {keyType ? (
                          <button
                            type="button"
                            onClick={() => cycleSort(column)}
                            className="w-full px-2.5 py-2 inline-flex items-center gap-1.5 text-left hover:bg-slate-100 transition-colors"
                            title={`Sort by ${column} (${keyType})`}
                          >
                            <KeyRound className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>{column}</span>
                            <span className="rounded bg-slate-100 px-1 py-0.5 text-[8px] text-slate-500">{keyType}</span>
                            {isSorted ? (
                              sort?.direction === 'asc'
                                ? <ArrowUp className="w-3 h-3 text-blue-600 ml-auto" />
                                : <ArrowDown className="w-3 h-3 text-blue-600 ml-auto" />
                            ) : (
                              <ChevronsUpDown className="w-3 h-3 text-slate-300 ml-auto" />
                            )}
                          </button>
                        ) : (
                          <div className="px-2.5 py-2">{column}</div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/40">
                    {columns.map((column) => (
                      <td key={column} className="max-w-[320px] border-b border-r border-slate-100 px-2.5 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis">
                        {renderValue(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
