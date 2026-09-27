import React, { useEffect, useMemo, useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import {
  subscribeToCanonicalData,
  type CanonicalCollectionName,
  type CanonicalDataRow,
} from '../services/firebaseService';

const COLLECTIONS: Array<{ id: CanonicalCollectionName; label: string }> = [
  { id: 'users', label: 'Users' },
  { id: 'days', label: 'Days' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'habits', label: 'Habits' },
  { id: 'habitLogs', label: 'HabitLogs' },
  { id: 'countdowns', label: 'Countdowns' },
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

  useEffect(() => subscribeToCanonicalData(setData, (err) => setError(err.message)), []);

  const rows = data[active];
  const columns = useMemo(() => {
    const keys = new Set<string>();
    rows.forEach((row) => Object.keys(row).forEach((key) => keys.add(key)));
    return ['id', ...Array.from(keys).filter((key) => key !== 'id')];
  }, [rows]);

  return (
    <div className="space-y-3 lg:h-full lg:flex lg:flex-col lg:overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 lg:shrink-0">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] font-black text-blue-600">Firestore workspace</p>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">Canonical Data</h2>
          <p className="text-xs text-slate-500 mt-0.5">Live, read-only view of the six System Builder collections.</p>
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
              onClick={() => setActive(collection.id)}
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
                  {columns.map((column) => (
                    <th key={column} className="border-b border-r border-slate-200 px-2.5 py-2 text-[10px] uppercase tracking-wide font-black text-slate-500 whitespace-nowrap">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
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
