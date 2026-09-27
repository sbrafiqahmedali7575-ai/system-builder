import React from 'react';
import { Check } from 'lucide-react';
import type { HabitItem, TaskItem } from '../../types';

type TaskChipProps = {
  kind: 'task';
  task: TaskItem;
  disabled?: boolean;
  onClick: () => void;
};

type HabitChipProps = {
  kind: 'habit';
  habit: HabitItem;
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export type CalendarEventChipProps = TaskChipProps | HabitChipProps;

function taskChipClass(task: TaskItem): string {
  if (task.isCompleted) {
    return 'bg-slate-100 text-slate-500 line-through';
  }

  switch (task.matrixQuadrant) {
    case 'urgent-important':
      return 'bg-rose-100 text-rose-800 hover:bg-rose-200/80';
    case 'important':
      return 'bg-blue-100 text-blue-800 hover:bg-blue-200/80';
    case 'urgent':
      return 'bg-amber-100 text-amber-800 hover:bg-amber-200/80';
    case 'neither':
      return 'bg-slate-100 text-slate-700 hover:bg-slate-200/80';
    default:
      return 'bg-sky-100 text-sky-800 hover:bg-sky-200/80';
  }
}

export const CalendarEventChip: React.FC<CalendarEventChipProps> = (props) => {
  if (props.kind === 'task') {
    const { task, disabled = false, onClick } = props;

    return (
      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        aria-label={`${task.taskOfTheDay}. ${
          disabled
            ? 'Future task locked'
            : task.isCompleted
            ? 'Completed'
            : 'To do'
        }.`}
        className={`pointer-events-auto w-full min-w-0 h-[20px] px-1.5 rounded-[3px] flex items-center gap-1 text-left text-[9px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-55 disabled:cursor-default ${taskChipClass(
          task
        )}`}
      >
        <span
          className={`w-3 h-3 rounded-[3px] border shrink-0 inline-flex items-center justify-center ${
            task.isCompleted
              ? 'border-slate-400 bg-slate-400 text-white'
              : 'border-current bg-white/40'
          }`}
          aria-hidden="true"
        >
          {task.isCompleted && <Check className="w-2.5 h-2.5" />}
        </span>

        <span className="truncate flex-1">{task.taskOfTheDay}</span>

        {task.timeEstimate && (
          <span className="shrink-0 text-[8px] opacity-65 font-medium">
            {task.timeEstimate}
          </span>
        )}
      </button>
    );
  }

  const { habit, checked, disabled = false, onClick } = props;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={`${habit.name}. ${
        disabled
          ? 'Future check-in locked'
          : checked
          ? 'Completed'
          : 'Not completed'
      }.`}
      className={`pointer-events-auto w-full min-w-0 h-[20px] px-1.5 rounded-[3px] flex items-center gap-1 text-left text-[9px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        checked
          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200/80'
          : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
      } disabled:opacity-55 disabled:cursor-default`}
    >
      <span
        className={`w-3 h-3 rounded-[3px] border shrink-0 inline-flex items-center justify-center ${
          checked
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-teal-400 bg-white/60'
        }`}
        aria-hidden="true"
      >
        {checked && <Check className="w-2.5 h-2.5" />}
      </span>

      <span className="truncate flex-1">
        {habit.emoji} {habit.name}
      </span>
    </button>
  );
};
