import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
  Search,
  X,
} from 'lucide-react';
import { DailyRecord, DashboardTheme } from '../types';
import { standardizeDate, parseDateToTimestamp, isTodayDate } from '../utils/dateUtils';
import { SmoothCheckmark } from './ReportView';
import confetti from 'canvas-confetti';

interface DataTableVisualProps {
  records: DailyRecord[];
  theme: DashboardTheme;
  onToggleRecordStatus: (id: string) => void;
  onEditRecord?: (record: DailyRecord) => void;
  onUpdateRecord?: (record: DailyRecord) => void;
}

type SortField = 'day' | 'date' | 'isCompleted';
type SortOrder = 'asc' | 'desc';

export const DataTableVisual: React.FC<DataTableVisualProps> = ({
  records,
  theme,
  onToggleRecordStatus,
}) => {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('day');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [quickFilter] = useState<'ALL' | 'DONE' | 'PENDING'>('ALL');

  const isDark = theme === 'dark';

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleToggle = (record: DailyRecord) => {
    if (!isTodayDate(record.date)) {
      return;
    }
    if (!record.isCompleted) {
      try {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.75 },
          colors: ['#2563eb', '#2563eb', '#f59e0b'],
        });
      } catch (e) {
        // ignore
      }
    }
    onToggleRecordStatus(record.id);
  };

  const uniqueRecords = useMemo(() => {
    const seenDays = new Set<number>();
    const seenDates = new Set<string>();
    const deduped: DailyRecord[] = [];

    const sorted = [...records].sort((a, b) => a.day - b.day);

    for (const r of sorted) {
      const normalizedDate = standardizeDate(r.date);
      if (seenDates.has(normalizedDate)) continue;

      let safeDay = r.day;
      if (seenDays.has(safeDay) || safeDay <= 0) {
        safeDay = 1;
        while (seenDays.has(safeDay)) safeDay++;
      }
      seenDays.add(safeDay);
      seenDates.add(normalizedDate);
      deduped.push(safeDay === r.day ? r : { ...r, day: safeDay });
    }
    return deduped;
  }, [records]);

  const filteredAndSortedRecords = useMemo(() => {
    return uniqueRecords
      .filter((r) => {
        // Quick filter
        if (quickFilter === 'DONE' && !r.isCompleted) return false;
        if (quickFilter === 'PENDING' && r.isCompleted) return false;

        // Search query
        if (!search) return true;
        const q = search.toLowerCase();
        const stdDate = standardizeDate(r.date).toLowerCase();
        return (
          r.day.toString().includes(q) ||
          r.date.toLowerCase().includes(q) ||
          stdDate.includes(q)
        );
      })
      .sort((a, b) => {
        if (sortField === 'date') {
          const timeA = parseDateToTimestamp(a.date);
          const timeB = parseDateToTimestamp(b.date);
          return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        }

        if (sortField === 'day') {
          return sortOrder === 'asc' ? a.day - b.day : b.day - a.day;
        }

        if (sortField === 'isCompleted') {
          const valA = a.isCompleted ? 1 : 0;
          const valB = b.isCompleted ? 1 : 0;
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }

        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = (valB || '').toLowerCase();
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [uniqueRecords, search, sortField, sortOrder, quickFilter]);

  return (
    <div
      id="powerbi-table-visual-container"
      className={`rounded-2xl border transition-all duration-200 p-2.5 sm:p-3 flex flex-col justify-between ${
        isDark
          ? 'bg-slate-900/60 border-slate-800 text-slate-200'
          : 'bg-white border-slate-200/80 text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
      }`}
    >
      {/* Table Search Bar */}
      <div className="flex justify-end pb-1.5 mb-1">
        <div className="relative">
          <Search className={`w-3.5 h-3.5 absolute left-3 top-0.5/2 -translate-y-1/2 ${
            isDark ? 'text-slate-400' : 'text-slate-400'
          }`} />
          <input
            id="table-search-input"
            type="text"
            placeholder="Search commitments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`pl-4 pr-3.5 py-1 text-xs rounded-xl border focus:outline-none w-36 sm:w-48 ${
              isDark
                ? 'border-slate-700 bg-slate-800 text-slate-200 focus:border-blue-500'
                : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500/20'
            }`}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-0.5/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Desktop Table View (sm and up) */}
      <div className={`hidden sm:block overflow-x-auto max-h-96 rounded-lg border ${
        isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-white shadow-xs'
      }`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead className={`sticky top-0 z-10 font-bold border-b ${
            isDark
              ? 'bg-slate-900 text-slate-300 border-slate-800'
              : 'bg-slate-50 text-slate-800 border-slate-200 shadow-xs'
          }`}>
            <tr>
              <th
                onClick={() => handleSort('day')}
                className={`py-1.5 px-2 cursor-pointer transition select-none ${
                  isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-100'
                }`}
                title="Click to sort by Day number"
              >
                <div className="flex items-center space-x-1">
                  <span className="tracking-wide uppercase text-xs font-bold">Day</span>
                  {sortField === 'day' ? (
                    sortOrder === 'asc' ? (
                      <ChevronUp className="w-3.5 h-3.5 text-teal-600 dark:text-amber-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-teal-600 dark:text-amber-400" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-30" />
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('date')}
                className={`py-1.5 px-2 cursor-pointer transition select-none ${
                  isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-100'
                }`}
                title="Click to sort by Date"
              >
                <div className="flex items-center space-x-1">
                  <span className="tracking-wide uppercase text-xs font-bold">Date</span>
                  {sortField === 'date' ? (
                    sortOrder === 'asc' ? (
                      <ChevronUp className="w-3.5 h-3.5 text-teal-600 dark:text-amber-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-teal-600 dark:text-amber-400" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-30" />
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('isCompleted')}
                className={`py-1.5 px-2 text-center cursor-pointer transition select-none ${
                  isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-100'
                }`}
                title="Click to sort by Status"
              >
                <div className="flex items-center justify-center space-x-1">
                  <span className="tracking-wide uppercase text-xs font-bold">Status</span>
                  {sortField === 'isCompleted' ? (
                    sortOrder === 'asc' ? (
                      <ChevronUp className="w-3.5 h-3.5 text-teal-600 dark:text-amber-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-teal-600 dark:text-amber-400" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-30" />
                  )}
                </div>
              </th>
            </tr>
          </thead>

          <tbody className={`divide-y font-mono text-xs ${
            isDark ? 'divide-slate-800/80' : 'divide-slate-200'
          }`}>
            {filteredAndSortedRecords.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-5 text-center text-slate-400 font-sans text-sm">
                  No matching commitment records found.
                </td>
              </tr>
            ) : (
              <AnimatePresence mode="popLayout" initial={false}>
                {filteredAndSortedRecords.map((r) => {
                  const isToday = isTodayDate(r.date);
                  return (
                    <motion.tr
                      key={r.id}
                      layout="position"
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.05 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        backgroundColor: r.isCompleted
                          ? isDark
                            ? 'rgba(15, 23, 42, 0.55)'
                            : 'rgba(240, 253, 250, 0.7)'
                          : isDark
                          ? 'rgba(2, 6, 23, 0.2)'
                          : 'rgba(255, 255, 255, 1)',
                      }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className={`transition-colors ${
                        isDark
                          ? 'hover:bg-slate-800/50'
                          : 'hover:bg-teal-50/50'
                      }`}
                    >
                      {/* DAY */}
                      <td className={`py-1.5 px-2 font-bold ${
                        isDark ? 'text-slate-200' : 'text-slate-900'
                      }`}>
                        <div className="flex items-center space-x-1">
                          <span>Day {r.day}</span>
                          {isToday && (
                            <span className="text-[10px] font-mono font-bold px-1 py-0.5 rounded bg-amber-400 text-slate-950 uppercase tracking-wider">
                              Today
                            </span>
                          )}
                        </div>
                      </td>

                      {/* DATE */}
                      <td className={`py-1.5 px-2 font-sans font-medium whitespace-nowrap ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        {standardizeDate(r.date)}
                      </td>

                      {/* Checkbox & Status with Framer Motion: Only today is changeable */}
                      <td className="py-1.5 px-2 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          {isToday ? (
                            <motion.button
                              id={`toggle-check-${r.id}`}
                              onClick={() => handleToggle(r)}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.85 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                              className={`w-6 h-6 rounded-md border flex items-center justify-center cursor-pointer ${
                                r.isCompleted
                                  ? isDark
                                    ? 'bg-amber-400 border-amber-400 text-slate-950 shadow-xs'
                                    : 'bg-teal-600 border-teal-600 text-white shadow-xs'
                                  : isDark
                                  ? 'border-slate-600 bg-slate-900 hover:border-amber-400 text-transparent'
                                  : 'border-slate-300 bg-white hover:border-teal-500 text-transparent'
                              }`}
                              title={r.isCompleted ? 'Mark Not Completed' : 'Mark Completed'}
                            >
                              <AnimatePresence mode="wait">
                                {r.isCompleted ? (
                                  <SmoothCheckmark
                                    key="smooth-check-table"
                                    className={
                                      isDark
                                        ? 'w-3.5 h-3.5 text-slate-950 stroke-[3]'
                                        : 'w-3.5 h-3.5 text-white stroke-[3]'
                                    }
                                  />
                                ) : null}
                              </AnimatePresence>
                            </motion.button>
                          ) : (
                            <div
                              className={`w-6 h-6 rounded-md border flex items-center justify-center cursor-not-allowed select-none ${
                                r.isCompleted
                                  ? isDark
                                    ? 'bg-blue-950/60 border-blue-500/40 text-blue-400'
                                    : 'bg-blue-100 border-blue-300 text-blue-800'
                                  : isDark
                                  ? 'border-slate-700 bg-slate-850 text-slate-500'
                                  : 'border-slate-200 bg-slate-100 text-slate-400'
                              }`}
                              title="Previous dates are unchangeable. Only today's commitment can be modified."
                            >
                              {r.isCompleted ? (
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              ) : (
                                <Lock className="w-3 h-3 opacity-60" />
                              )}
                            </div>
                          )}

                          <AnimatePresence mode="wait">
                            <motion.span
                              key={r.isCompleted ? 'completed' : 'not-completed'}
                              initial={{ scale: 0.85, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.85, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className={`text-xs font-bold px-1 py-0.5 rounded ${
                                r.isCompleted
                                  ? isDark ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : isDark ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {r.isCompleted ? 'Completed' : 'Not Completed'}
                            </motion.span>
                          </AnimatePresence>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (optimized for touch screens < 640px) */}
      <div className="block sm:hidden space-y-1.5">
        {filteredAndSortedRecords.length === 0 ? (
          <div className="p-3 text-center text-slate-400 text-sm">
            No matching commitment records found.
          </div>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            {filteredAndSortedRecords.map((r) => {
              const isToday = isTodayDate(r.date);
              return (
                <motion.div
                  key={r.id}
                  layout="position"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.08 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    borderColor: r.isCompleted
                      ? isDark
                        ? 'rgba(16, 185, 129, 0.4)'
                        : 'rgba(167, 243, 208, 1)'
                      : isDark
                      ? 'rgba(51, 65, 85, 0.6)'
                      : 'rgba(226, 232, 240, 1)',
                    backgroundColor: r.isCompleted
                      ? isDark
                        ? 'rgba(15, 23, 42, 0.85)'
                        : 'rgba(240, 253, 250, 0.9)'
                      : isDark
                      ? 'rgba(15, 23, 42, 0.4)'
                      : 'rgba(255, 255, 255, 1)',
                  }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="p-2 rounded-xl border transition-shadow"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center space-x-1">
                      <span className="font-mono font-bold text-xs px-1 py-0.5 rounded bg-slate-800/10 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        Day {r.day}
                      </span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {standardizeDate(r.date)}
                      </span>
                      {isToday && (
                        <span className="text-[10px] font-mono font-bold px-1 py-0.5 rounded bg-amber-400 text-slate-950 uppercase tracking-wider">
                          Today
                        </span>
                      )}
                    </div>

                    {isToday ? (
                      <motion.button
                        onClick={() => handleToggle(r)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.88 }}
                        transition={{ type: 'spring', stiffness: 450, damping: 22 }}
                        className={`flex items-center space-x-1 px-1.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                          r.isCompleted
                            ? 'bg-blue-600 text-white shadow-xs'
                            : isDark
                            ? 'bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-500'
                            : 'bg-slate-100 border border-slate-300 text-slate-700 hover:border-slate-400'
                        }`}
                        title={r.isCompleted ? 'Mark Not Completed' : 'Mark Completed'}
                      >
                        <AnimatePresence mode="wait">
                          {r.isCompleted ? (
                            <SmoothCheckmark
                              key="checked-mobile"
                              className="w-3.5 h-3.5 text-white stroke-[3]"
                            />
                          ) : (
                            <motion.div
                              key="unchecked-mobile"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 0.6 }}
                              exit={{ opacity: 0 }}
                              className="w-3 h-3 rounded-full border border-current"
                            />
                          )}
                        </AnimatePresence>
                        <span>{r.isCompleted ? 'Completed' : 'Mark Completed'}</span>
                      </motion.button>
                    ) : (
                      <div
                        className={`flex items-center space-x-1 px-1.5 py-0.5 rounded-md text-xs font-semibold select-none cursor-not-allowed border ${
                          r.isCompleted
                            ? isDark
                              ? 'bg-blue-950/40 text-blue-400 border-blue-500/30'
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                            : isDark
                            ? 'bg-slate-850 text-slate-400 border-slate-700'
                            : 'bg-slate-100 text-slate-600 border border-slate-300'
                        }`}
                        title="Previous dates are unchangeable. Only today's commitment can be modified."
                      >
                        <Lock className="w-3 h-3 opacity-60" />
                        <span>{r.isCompleted ? 'Completed' : 'Not Completed'}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Footer Info & Quick Stats */}
      <div className={`mt-1.5 pt-1.5 border-t flex flex-wrap items-center justify-between gap-1 text-[11px] font-semibold ${
        isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'
      }`}>
        <span className="hidden sm:inline">
          Click any checkbox or card to instantly toggle daily completion
        </span>
        <span className="font-mono ml-auto">
          Showing {filteredAndSortedRecords.length} of {records.length} Days
        </span>
      </div>
    </div>
  );
};
