import React, { useState, useEffect } from 'react';
import { Check, Edit3, Lock, Save, Trash2, X } from 'lucide-react';
import { DailyRecord, DashboardTheme } from '../types';
import { standardizeDate, isTodayDate } from '../utils/dateUtils';

interface EditRecordModalProps {
  isOpen: boolean;
  record: DailyRecord | null;
  onClose: () => void;
  onUpdateRecord: (record: DailyRecord) => void;
  onDeleteRecord?: (id: string) => void;
  theme: DashboardTheme;
  existingRecords?: DailyRecord[];
}

export const EditRecordModal: React.FC<EditRecordModalProps> = ({
  isOpen,
  record,
  onClose,
  onUpdateRecord,
  onDeleteRecord,
  theme,
  existingRecords = [],
}) => {
  const [day, setDay] = useState<number>(1);
  const [date, setDate] = useState<string>('');
  const [isCompleted, setIsCompleted] = useState<boolean>(true);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (record) {
      setDay(record.day);
      setDate(standardizeDate(record.date) || record.date);
      setIsCompleted(record.isCompleted);
      setIsSaved(false);
      setErrorMsg('');
    }
  }, [record, isOpen]);

  if (!isOpen || !record) return null;
  const isDark = theme === 'dark';
  const isToday = isTodayDate(record.date);

  const normalizedInputDate = standardizeDate(date.trim());
  const isDuplicateDay = existingRecords.some(
    (r) => r.id !== record.id && r.day === Number(day)
  );
  const isDuplicateDate = existingRecords.some(
    (r) =>
      r.id !== record.id &&
      (standardizeDate(r.date) === normalizedInputDate ||
        r.date.trim().toLowerCase() === date.trim().toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isToday) {
      setErrorMsg("Previous dates are unchangeable. Only today's commitment can be modified.");
      return;
    }
    if (isDuplicateDay) {
      setErrorMsg(`Day ${day} is already assigned to another record.`);
      return;
    }
    if (isDuplicateDate) {
      setErrorMsg(`A commitment for date ${normalizedInputDate} already exists.`);
      return;
    }

    const formattedDate = normalizedInputDate || record.date;
    const updated: DailyRecord = {
      ...record,
      day: Number(day),
      date: formattedDate,
      isCompleted,
      result: isCompleted ? 'TRUE' : 'FALSE',
      change: 0,
    };

    onUpdateRecord(updated);
    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 350);
  };

  const handleDelete = () => {
    if (!isToday) {
      alert("Previous dates are locked and cannot be deleted.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete the record for Day ${record.day}?`)) {
      if (onDeleteRecord) {
        onDeleteRecord(record.id);
      }
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2">
      <div
        className={`w-full max-w-lg p-3 sm:p-3.5 rounded-3xl border shadow-2xl space-y-2.5 animate-in fade-in zoom-in-95 duration-150 ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <div className="flex items-center space-x-1.5">
            <div className={`p-1 rounded-xl border ${
              !isToday
                ? isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
                : isDark ? 'bg-blue-950/50 border-blue-900/50 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}>
              {!isToday ? <Lock className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                {isToday ? `Update Commitment (Day ${record.day})` : `Record Details (Day ${record.day}) — Locked`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isToday ? "Modify today's commitment details" : 'Previous dates are unchangeable and archived'}
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

        {/* Locked Past Date Notice */}
        {!isToday && (
          <div className="p-1.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-1">
            <Lock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Only today&apos;s date can be changed. All previous dates are permanently unchangeable.</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                Day Number
              </label>
              <input
                type="number"
                value={day}
                disabled={!isToday}
                onChange={(e) => setDay(Number(e.target.value))}
                required
                className={`w-full px-1.5 py-1 rounded-xl border font-mono font-bold focus:outline-none ${
                  !isToday
                    ? 'opacity-60 cursor-not-allowed border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-500'
                    : isDark
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
                disabled={!isToday}
                onChange={(e) => setDate(e.target.value)}
                placeholder="e.g. 10-Sep-2026"
                required
                className={`w-full px-1.5 py-1 rounded-xl border font-mono focus:outline-none ${
                  !isToday
                    ? 'opacity-60 cursor-not-allowed border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-500'
                    : isDark
                    ? 'border-slate-700 bg-slate-800 text-slate-100 focus:border-blue-500'
                    : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500/20'
                }`}
              />
            </div>
          </div>

          <div>
            <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              Status
            </label>
            <div className="flex items-center space-x-1.5 pt-0.5">
              <button
                type="button"
                disabled={!isToday}
                onClick={() => {
                  if (isToday) setIsCompleted(!isCompleted);
                }}
                className={`w-6 h-6 rounded-lg border flex items-center justify-center transition ${
                  !isToday
                    ? 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer'
                } ${
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

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            {isToday && onDeleteRecord ? (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center space-x-1 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={onClose}
                className="px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
              >
                {isToday ? 'Cancel' : 'Close'}
              </button>

              {isToday && (
                <button
                  type="submit"
                  disabled={isDuplicateDay || isDuplicateDate}
                  className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{isSaved ? 'Saved!' : 'Save Changes'}</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
