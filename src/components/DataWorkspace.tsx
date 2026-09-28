import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Database, Eye, KeyRound, RefreshCw } from 'lucide-react';
import {
  subscribeToCanonicalData,
  type CanonicalCollectionName,
  type CanonicalDataRow,
} from '../services/firebaseService';

type SortDirection = 'asc' | 'desc';
type SortState = { column: string; direction: SortDirection } | null;

type RecoveryCandidate = {
  habitId?: string;
  dateKey?: string;
  Iscompleted?: boolean;
  evidence?: string;
  confidence?: string;
  status?: string;
  existingHabitLogIds?: string[];
};

type RecoveryReport = {
  generatedAt?: string;
  readOnly?: boolean;
  previewOnly?: boolean;
  writesPerformed?: number;
  canRestoreAutomatically?: number;
  damagedRows?: Array<{ documentId?: string; habitLogId?: string; missingFields?: string[] }>;
  restorable?: RecoveryCandidate[];
};

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

const COLLECTIONS: Array<{ id: CanonicalCollectionName; label: string }> = [
  { id: 'days', label: 'Days' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'habitLogs', label: 'HabitLogs' },
  { id: 'habits', label: 'Habits' },
  { id: 'countdowns', label: 'Countdowns' },
  { id: 'users', label: 'Users' },
];

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
  const [recoveryReport, setRecoveryReport] = useState<RecoveryReport | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

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
  const previewHabitLogRecovery = async () => {
    setRecoveryLoading(true);
    setRecoveryError(null);
    try {
      const response = await fetch('/api/habitlogs/recovery-report', { method: 'GET' });
      const report = await response.json();
      if (!response.ok) throw new Error(report.error || 'Recovery preview failed');
      if (report.readOnly !== true || report.previewOnly !== true || Number(report.writesPerformed || 0) !== 0) {
        throw new Error('Server did not confirm a read-only recovery preview.');
      }
      setRecoveryReport(report);
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : 'Recovery preview failed');
    } finally {
      setRecoveryLoading(false);
    }
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

      {active === 'habitLogs' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 lg:shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-xs font-black text-amber-900">HabitLog recovery preview</div>
              <div className="text-[10px] font-semibold text-amber-700">Read-only analysis. Previewing performs zero Firestore writes or deletes.</div>
            </div>
            <button
              type="button"
              onClick={previewHabitLogRecovery}
              disabled={recoveryLoading}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-black text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5" />
              {recoveryLoading ? 'Analyzing…' : 'Preview recoverable values'}
            </button>
          </div>
          {recoveryError && <div className="mt-2 text-xs font-bold text-rose-700">{recoveryError}</div>}
          {recoveryReport && (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                <span className="rounded bg-white px-2 py-1 border border-amber-200">Damaged rows: {recoveryReport.damagedRows?.length || 0}</span>
                <span className="rounded bg-white px-2 py-1 border border-amber-200">Evidence-backed candidates: {recoveryReport.restorable?.length || 0}</span>
                <span className="rounded bg-emerald-50 px-2 py-1 border border-emerald-200 text-emerald-700">Writes: {recoveryReport.writesPerformed || 0}</span>
              </div>
              {(recoveryReport.restorable?.length || 0) > 0 ? (
                <div className="overflow-auto max-h-56 rounded-lg border border-amber-200 bg-white">
                  <table className="w-full min-w-max text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr>
                        {['habitId', 'dateKey', 'Iscompleted', 'evidence', 'confidence', 'status'].map((column) => (
                          <th key={column} className="border-b border-r border-slate-200 px-2 py-1.5 text-[9px] uppercase tracking-wide text-slate-500">{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recoveryReport.restorable?.map((candidate, index) => (
                        <tr key={`${candidate.habitId}-${candidate.dateKey}-${index}`}>
                          <td className="border-b border-r border-slate-100 px-2 py-1.5 font-bold">{candidate.habitId || '—'}</td>
                          <td className="border-b border-r border-slate-100 px-2 py-1.5 font-bold">{candidate.dateKey || '—'}</td>
                          <td className="border-b border-r border-slate-100 px-2 py-1.5">{candidate.Iscompleted ? '1' : '0'}</td>
                          <td className="border-b border-r border-slate-100 px-2 py-1.5">{candidate.evidence || '—'}</td>
                          <td className="border-b border-r border-slate-100 px-2 py-1.5">{candidate.confidence || '—'}</td>
                          <td className="border-b border-slate-100 px-2 py-1.5">{candidate.status || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs font-semibold text-slate-600">No evidence-backed missing habit/date pairs were found.</div>
              )}
            </div>
          )}
        </div>
      )}

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
