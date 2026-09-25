import React, { useState } from 'react';
import { Check, PlusCircle, X } from 'lucide-react';
import { DailyRecord, DashboardTheme } from '../types';
import { standardizeDate, getTodayDateString } from '../utils/dateUtils';

interface AddRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRecord: (record: Omit<DailyRecord, 'id'>) => void;
  theme: DashboardTheme;
  existingRecords?: DailyRecord[];
}

export const AddRecordModal: React.FC<AddRecordModalProps> = ({
  isOpen,
  onClose,
  onAddRecord,
  theme,
  existingRecords = [],
}) => {
  const [day, setDay] = useState<number>(() => {
    if (existingRecords.length === 0) return 1;
    const maxDay = Math.max(...existingRecords.map((r) => r.day), 0);
    return maxDay + 1;
  });
  const [date, setDate] = useState<string>(() => getTodayDateString());
  const [isCompleted, setIsCompleted] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;
  const isDark = theme === 'dark';

  const normalizedInputDate = standardizeDate(date.trim());
  const isDuplicateDay = existingRecords.some((r) => r.day === Number(day));
  const isDuplicateDate = existingRecords.some(
    (r) =>
      standardizeDate(r.date) === normalizedInputDate ||
      r.date.trim().toLowerCase() === date.trim().toLowerCase()
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isDuplicateDay) {
      setErrorMsg(`Day ${day} already exists in records. Each day must be unique.`);
      return;
    }

    if (isDuplicateDate) {
      setErrorMsg(`A commitment for date "${normalizedInputDate}" already exists.`);
      return;
    }

    onAddRecord({
      day: Number(day),
      date: normalizedInputDate,
      isCompleted: isCompleted,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2">
      <div
        className={`w-full max-w-lg p-3 sm:p-3.5 rounded-3xl border shadow-2xl space-y-2.5 ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <div className="flex items-center space-x-1.5">
            <div className="p-1 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Log Daily Commitment
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Record your daily commitment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-0.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                Day Number
              </label>
              <input
                type="number"
                value={day}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setDay(val);
                }}
                required
                className={`w-full px-1.5 py-1 rounded-xl border font-mono font-bold focus:outline-none ${
                  isDark
                    ? 'border-slate-700 bg-slate-800 text-slate-100 focus:border-blue-500'
                    : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500/20'
                }`}
              />
            </div>

            <div>
              <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                Date
              </label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="e.g. 10-Sep-2026"
                required
                className={`w-full px-1.5 py-1 rounded-xl border font-mono focus:outline-none ${
                  isDark
                    ? 'border-slate-700 bg-slate-800 text-slate-100 focus:border-blue-500'
                    : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500/20'
                }`}
              />
            </div>
          </div>

          <div>
            <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              Commitment Status
            </label>
            <div className="flex items-center space-x-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => setIsCompleted(!isCompleted)}
                className={`w-6 h-6 rounded-lg border flex items-center justify-center transition cursor-pointer ${
                  isCompleted
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                    : isDark
                    ? 'border-slate-600 bg-slate-800'
                    : 'border-slate-300 bg-white'
                }`}
              >
                {isCompleted && <Check className="w-4 h-4 stroke-[3]" />}
              </button>
              <span className={`text-xs font-semibold ${
                isCompleted
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}>
                {isCompleted ? 'Completed' : 'Not Completed'}
              </span>
            </div>
          </div>

          {/* Validation Error Message */}
          {(isDuplicateDay || isDuplicateDate || errorMsg) && (
            <div className="p-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs">
              <span className="font-bold">Duplicate prevented: </span>
              <span>
                {isDuplicateDay
                  ? `Day ${day} already exists in records. Duplicate values are not allowed.`
                  : isDuplicateDate
                  ? `A record for date ${normalizedInputDate} already exists.`
                  : errorMsg}
              </span>
            </div>
          )}

          <div className="flex justify-end items-center space-x-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDuplicateDay || isDuplicateDate}
              className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Save Commitment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
