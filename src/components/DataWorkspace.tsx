import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
  Database,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Loader2,
} from 'lucide-react';
import {
  importCanonicalDataRows,
  subscribeToCanonicalData,
  type CanonicalCollectionName,
  type CanonicalDataRow,
} from '../services/firebaseService';
import {
  DATA_TABLE_COLUMNS,
  exportAllCanonicalData,
  exportCanonicalDataFile,
  parseAllCanonicalDataFile,
  type DataTransferFormat,
} from '../utils/dataTransfer';
import { useToast } from './ui/ToastProvider';

type SortDirection = 'asc' | 'desc';
type SortState = { column: string; direction: SortDirection } | null;
type CollectionDescriptor = { id: CanonicalCollectionName; label: string };

const KEY_COLUMNS: Record<CanonicalCollectionName, Record<string, 'PK' | 'FK'>> = {
  users: { userId: 'PK' },
  days: { dateKey: 'PK' },
  tasks: { taskId: 'PK', scheduledDate: 'FK' },
  habits: { habitId: 'PK' },
  habitLogs: { habitLogId: 'PK', habitId: 'FK', dateKey: 'FK' },
  countdowns: { countdownId: 'PK' },
};

const FACT_COLLECTIONS: CollectionDescriptor[] = [
  { id: 'days', label: 'Days' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'habitLogs', label: 'HabitLogs' },
];

const DIM_COLLECTIONS: CollectionDescriptor[] = [
  { id: 'habits', label: 'Habits' },
  { id: 'users', label: 'Users' },
  { id: 'countdowns', label: 'Countdowns' },
];

const COLLECTIONS = [...FACT_COLLECTIONS, ...DIM_COLLECTIONS];

function collectionLabel(collectionName: CanonicalCollectionName): string {
  return COLLECTIONS.find((item) => item.id === collectionName)?.label || collectionName;
}

function renderValue(value: unknown, column?: string): string {
  if (value === null || value === undefined) return '—';
  if ((column === 'IsdayCompleted' || column === 'Iscompleted') && typeof value === 'boolean') return value ? '1' : '0';
  if ((column === 'taskCompletionRate' || column === 'habitCompletionRate' || column === 'DayCompletion') && typeof value === 'number') return `${value}%`;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

interface DataCollectionCardProps {
  collection: CollectionDescriptor;
  selected: boolean;
  rowCount: number;
  onSelect: () => void;
}

const DataCollectionCard: React.FC<DataCollectionCardProps> = ({
  collection,
  selected,
  rowCount,
  onSelect,
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={`w-full rounded-xl border px-2 py-2 text-left transition-colors ${
      selected
        ? 'border-[#4772fa] bg-blue-50/50 dark:bg-blue-950/20'
        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900'
    }`}
  >
    <div className="flex items-center gap-1.5">
      <Database className={`w-3.5 h-3.5 ${selected ? 'text-blue-600' : 'text-slate-400'}`} />
      <span className={`text-[11px] font-semibold truncate ${selected ? 'text-blue-800 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>
        {collection.label}
      </span>
    </div>
    <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{rowCount}</div>
    <div className="text-[11px] uppercase tracking-wide font-medium text-slate-400">rows</div>
  </button>
);

export const DataWorkspace: React.FC<{ focusMode?: boolean }> = ({ focusMode = false }) => {
  const { notify } = useToast();
  const [active, setActive] = useState<CanonicalCollectionName>('days');
  const [data, setData] = useState<Record<CanonicalCollectionName, CanonicalDataRow[]>>({
    users: [], days: [], tasks: [], habits: [], habitLogs: [], countdowns: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState>(null);
  const [showDimensions, setShowDimensions] = useState(false);
  const [allTransferMenu, setAllTransferMenu] = useState(false);
  const [allTransferBusy, setAllTransferBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImportRef = useRef<{ scope: 'all'; format: DataTransferFormat } | null>(null);

  useEffect(() => subscribeToCanonicalData(setData, (err) => setError(err.message)), []);

  useEffect(() => {
    if (!allTransferMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-transfer-menu]')) {
        setAllTransferMenu(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [allTransferMenu]);

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

      if (!sort && active === 'tasks' && effectiveSort.column === 'scheduledDate') {
        const leftTaskId = renderValue(a.taskId).toLocaleLowerCase();
        const rightTaskId = renderValue(b.taskId).toLocaleLowerCase();
        return -leftTaskId.localeCompare(rightTaskId, undefined, { numeric: true, sensitivity: 'base' });
      }

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

  const handleExportAll = async (format: DataTransferFormat) => {
    setError(null);
    setAllTransferMenu(false);
    setAllTransferBusy(true);
    try {
      await exportAllCanonicalData(data, format);
      notify(
        format === 'xlsx'
          ? 'All 6 tables exported in one Excel workbook.'
          : 'All 6 tables exported as CSV files in one ZIP.'
      );
    } catch (exportError) {
      const message = exportError instanceof Error
        ? exportError.message
        : String(exportError);
      setError(`Export All failed: ${message}`);
    } finally {
      setAllTransferBusy(false);
    }
  };

  const beginImportAll = (format: DataTransferFormat) => {
    setError(null);
    setAllTransferMenu(false);
    pendingImportRef.current = { scope: 'all', format };

    const input = fileInputRef.current;
    if (!input) return;
    input.value = '';
    input.accept = format === 'xlsx'
      ? '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
      : '.zip,application/zip,application/x-zip-compressed';
    input.click();
  };

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    const pending = pendingImportRef.current;
    if (!file || !pending) return;

    setError(null);

    setAllTransferBusy(true);
      try {
        const importedData = await parseAllCanonicalDataFile(
          file,
          pending.format
        );
        const importOrder: CanonicalCollectionName[] = [
          'users',
          'habits',
          'tasks',
          'habitLogs',
          'countdowns',
          'days',
        ];

        let totalImported = 0;
        for (const collection of importOrder) {
          const result = await importCanonicalDataRows(
            collection,
            importedData[collection]
          );
          totalImported += result.imported;
        }

        window.dispatchEvent(
          new CustomEvent('system-builder:auth-profile-changed')
        );
        notify(
          `Import All completed: ${totalImported} rows upserted across 6 tables.`
        );
      } catch (importError) {
        const message = importError instanceof Error
          ? importError.message
          : String(importError);
        setError(`Import All failed: ${message}`);
      } finally {
        setAllTransferBusy(false);
        pendingImportRef.current = null;
        event.target.value = '';
      }
  };

  const renderCollectionCard = (collection: CollectionDescriptor) => (
    <DataCollectionCard
      key={collection.id}
      collection={collection}
      selected={active === collection.id}
      rowCount={data[collection.id].length}
      onSelect={() => selectCollection(collection.id)}
    />
  );

  const columns = DATA_TABLE_COLUMNS[active];

  return (
    <div className="tools-workspace-view lg:flex lg:flex-col">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleImportFile}
        aria-hidden="true"
      />

      {!focusMode && (
        <div className="tools-view-header lg:shrink-0 flex items-center justify-between gap-3">
          <div>
            <h2 className="tools-view-title">Data</h2>
            <p className="tools-view-subtitle"></p>
          </div>

          <div className="relative shrink-0" data-transfer-menu>
            <button
              type="button"
              onClick={() => {
                setAllTransferMenu((open) => !open);
              }}
              disabled={allTransferBusy}
              className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-haspopup="menu"
              aria-expanded={allTransferMenu}
              title="Import or export all six data tables"
            >
              {allTransferBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRightLeft className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Data Transfer</span>
              <span className="sm:hidden">All</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {allTransferMenu && (
              <div
                role="menu"
                className="absolute right-0 top-11 z-[70] w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Export All
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => handleExportAll('xlsx')}
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportAll('csv')}
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FileText className="h-3.5 w-3.5 text-blue-600" />
                    CSV ZIP
                  </button>
                </div>

                <div className="mt-2 border-t border-slate-100 px-1 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800">
                  Import All
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => beginImportAll('xlsx')}
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => beginImportAll('csv')}
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FileText className="h-3.5 w-3.5 text-blue-600" />
                    CSV ZIP
                  </button>
                </div>

                <p className="px-1 pt-2 text-[10px] leading-4 text-slate-400">
                  Excel uses 6 worksheets. CSV uses a ZIP containing 6 CSV files.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {!focusMode && (
        <div className="space-y-2 p-2.5 sm:p-3 border-b border-slate-100 dark:border-slate-800 lg:shrink-0">
          <div>
            <div className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">Fact</div>
            <div className="grid grid-cols-3 gap-1.5">
              {FACT_COLLECTIONS.map(renderCollectionCard)}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowDimensions((value) => !value)}
              className="min-h-11 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white"
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
                {DIM_COLLECTIONS.map(renderCollectionCard)}
              </div>
            )}
          </div>
        </div>
      )}

      {error && <div className="tools-feedback-error">{error}</div>}

      <div className="bg-white dark:bg-slate-950 overflow-hidden lg:flex-1 lg:min-h-0">
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-3">
          <div className="font-semibold text-sm">{collectionLabel(active)}</div>
          <div className="text-[10px] font-medium text-slate-500">
            {rows.length} document{rows.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto overscroll-contain max-h-[62dvh] sm:max-h-[68dvh] lg:max-h-none lg:h-[calc(100%-41px)] [scrollbar-gutter:stable]">
          {rows.length === 0 ? (
            <div className="min-h-40 flex items-center justify-center text-sm font-medium text-slate-400">
              No documents
            </div>
          ) : (
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-white dark:bg-slate-950">
                <tr>
                  {columns.map((column) => {
                    const keyType = KEY_COLUMNS[active][column];
                    const isSorted = sort?.column === column;
                    return (
                      <th
                        key={column}
                        className="border-b border-r border-slate-200 dark:border-slate-800 p-0 text-[10px] uppercase tracking-wide font-semibold text-slate-500 whitespace-nowrap"
                      >
                        {keyType ? (
                          <button
                            type="button"
                            onClick={() => cycleSort(column)}
                            className="w-full min-h-11 sm:min-h-0 px-2.5 py-2 inline-flex items-center gap-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                            title={`Sort by ${column} (${keyType})`}
                          >
                            <KeyRound className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>{column}</span>
                            <span className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 text-[11px] text-slate-500 dark:text-slate-300">
                              {keyType}
                            </span>
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
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/70">
                    {columns.map((column) => (
                      <td
                        key={column}
                        className="max-w-[320px] border-b border-r border-slate-100 dark:border-slate-800 px-2.5 py-2.5 sm:py-2 text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap overflow-hidden text-ellipsis"
                      >
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
