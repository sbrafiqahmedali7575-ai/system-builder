import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Database, KeyRound, ChevronDown, ChevronRight } from 'lucide-react';
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
    'tasksDone',
    'tasks',
    'tasksCompleted',
    'habitsDone',
    'Habits',
    'habitsCompleted',
    'dayCompleted',
    'IsdayCompleted',
  ],
  tasks: ['taskId', 'title', 'quadrant', 'scheduledDate', 'taskOrder', 'notes', 'Iscompleted'],
  habits: ['habitId', 'name', 'repeatDays', 'activeFrom', 'isActive', 'color'],
  habitLogs: ['habitLogId', 'habitId', 'dateKey', 'Iscompleted'],
  countdowns: ['countdownId', 'title', 'targetDate', 'isActive'],
};

const FACT_COLLECTIONS: Array<{ id: CanonicalCollectionName; label: string }> = [
  { id: 'days', label: 'Days' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'habitLogs', label: 'HabitLogs' },
];

const DIM_COLLECTIONS: Array<{ id: CanonicalCollectionName; label: string }> = [
  { id: 'habits', label: 'Habits' },
  { id: 'users', label: 'Users' },
  { id: 'countdowns', label: 'Countdowns' },
];

const COLLECTIONS = [...FACT_COLLECTIONS, ...DIM_COLLECTIONS];

function renderValue(value: unknown, column?: string): string {
  if (value === null || value === undefined) return '—';
  if ((column === 'IsdayCompleted' || column === 'Iscompleted') && typeof value === 'boolean') return value ? '1' : '0';
  if ((column === 'tasksCompleted' || column === 'habitsCompleted' || column === 'dayCompleted') && typeof value === 'number') return `${value}%`;
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
  const [showDimensions, setShowDimensions] = useState(false);

  useEffect(() => subscribeToCanonicalData(setData, (err) => setError(err.message)), []);

  const rows = data[active];
  const sortedRows = useMemo(() => {
    const effectiveSort = sort || (active === 'tasks'
      ? { column: 'scheduledDate', direction: 'desc' as const }
      : active === 'days' || active === 'habitLogs'
        ? { column: 'dateKey', direction: 'desc' as const }
        : null);
    if (!effectiveSort) return rows;
    return [...rows].sort((a, b) => {
      const left = renderValue(a[effectiveSort.column]).toLocaleLowerCase();
      const right = renderValue(b[effectiveSort.column]).toLocaleLowerCase();
      const comparison = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
      const primary = effectiveSort.direction === 'asc' ? comparison : -comparison;
      if (primary !== 0) return primary;

      // Default Tasks tie-breaker: same scheduledDate -> taskId DESC.
      if (!sort && active === 'tasks' && effectiveSort.column === 'scheduledDate') {
        const leftTaskId = renderValue(a.taskId).toLocaleLowerCase();
        const rightTaskId = renderValue(b.taskId).toLocaleLowerCase();
        return -leftTaskId.localeCompare(rightTaskId, undefined, { numeric: true, sensitivity: 'base' });
      }

      // Default HabitLogs tie-breaker: same dateKey -> habitLogId DESC.
      if (!sort && active === 'habitLogs' && effectiveSort.column === 'dateKey') {
        const leftHabitLogId = renderValue(a.habitLogId).toLocaleLowerCase();
        const rightHabitLogId = renderValue(b.habitLogId).toLocaleLowerCase();
        return -leftHabitLogId.localeCompare(rightHabitLogId, undefined, { numeric: true, sensitivity: 'base' });
      }
      return 0;
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
    <div className="tools-workspace-view lg:flex lg:flex-col">
      <div className="tools-view-header lg:shrink-0"><div><h2 className="tools-view-title">Data</h2><p className="tools-view-subtitle">Browse canonical System Builder collections.</p></div></div>

      <div className="space-y-2 p-3 border-b border-slate-100 dark:border-slate-800 lg:shrink-0">
        <div>
          <div className="mb-1 text-[10px] font-medium text-slate-500">Fact</div>
          <div className="grid grid-cols-3 gap-1.5">
            {FACT_COLLECTIONS.map((collection) => {
              const selected = active === collection.id;
              return (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => selectCollection(collection.id)}
                  className={`relative rounded-xl border px-2 py-2 text-left transition-colors ${
                    selected
                      ? 'border-[#4772fa] bg-blue-50/50 '
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Database
                      className={`w-3.5 h-3.5 ${
                        selected ? 'text-blue-600' : 'text-slate-400'
                      }`}
                    />
                    <span
                      className={`text-[11px] font-semibold truncate ${
                        selected ? 'text-blue-800' : 'text-slate-700'
                      }`}
                    >
                      {collection.label}
                    </span>
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {data[collection.id].length}
                  </div>
                  <div className="text-[11px] uppercase tracking-wide font-medium text-slate-400">
                    rows
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowDimensions((value) => !value)}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-slate-600"
            aria-expanded={showDimensions}
            title="Show dimension tables"
          >
            {showDimensions ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            Dim
          </button>
          {showDimensions && (
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {DIM_COLLECTIONS.map((collection) => {
                const selected = active === collection.id;
                return (
                  <button
                    key={collection.id}
                    type="button"
                    onClick={() => selectCollection(collection.id)}
                    className={`relative rounded-xl border px-2 py-2 text-left transition-colors ${
                      selected
                        ? 'border-[#4772fa] bg-blue-50/50 '
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Database
                        className={`w-3.5 h-3.5 ${
                          selected ? 'text-blue-600' : 'text-slate-400'
                        }`}
                      />
                      <span
                        className={`text-[11px] font-semibold truncate ${
                          selected ? 'text-blue-800' : 'text-slate-700'
                        }`}
                      >
                        {collection.label}
                      </span>
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {data[collection.id].length}
                    </div>
                    <div className="text-[11px] uppercase tracking-wide font-medium text-slate-400">
                      rows
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {error && <div className="tools-feedback-error">{error}</div>}

      <div className="bg-white dark:bg-slate-900 overflow-hidden lg:flex-1 lg:min-h-0">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="font-semibold text-sm">{COLLECTIONS.find((item) => item.id === active)?.label}</div>
          <div className="text-[10px] font-medium text-slate-500">{rows.length} document{rows.length === 1 ? '' : 's'}</div>
        </div>
        <div className="overflow-auto lg:h-[calc(100%-41px)]">
          {rows.length === 0 ? (
            <div className="min-h-40 flex items-center justify-center text-sm font-medium text-slate-400">No documents</div>
          ) : (
            <table className="w-full min-w-max border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-white ">
                <tr>
                  {columns.map((column) => {
                    const keyType = KEY_COLUMNS[active][column];
                    const isSorted = sort?.column === column;
                    return (
                      <th key={column} className="border-b border-r border-slate-200 p-0 text-[10px] uppercase tracking-wide font-semibold text-slate-500 whitespace-nowrap">
                        {keyType ? (
                          <button
                            type="button"
                            onClick={() => cycleSort(column)}
                            className="w-full px-2.5 py-2 inline-flex items-center gap-1.5 text-left hover:bg-slate-100 transition-colors"
                            title={`Sort by ${column} (${keyType})`}
                          >
                            <KeyRound className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>{column}</span>
                            <span className="rounded bg-slate-100 px-1 py-0.5 text-[11px] text-slate-500">{keyType}</span>
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
                  <tr key={row.id} className="hover:bg-slate-50">
                    {columns.map((column) => (
                      <td key={column} className="max-w-[320px] border-b border-r border-slate-100 px-2.5 py-2 text-xs font-medium text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis">
                        {renderValue(row[column], column)}
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
