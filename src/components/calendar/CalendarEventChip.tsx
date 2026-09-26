import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Flag,
  Layers3,
  NotebookText,
  Palette,
  Repeat2,
} from 'lucide-react';
import type { HabitItem, MatrixQuadrant, TaskItem } from '../../types';
import { getHabitScheduleLabel } from '../../utils/habitUtils';

type TaskChipProps = {
  kind: 'task';
  task: TaskItem;
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

interface PopoverPosition {
  left: number;
  top: number;
  placement: 'above' | 'below';
}

const POPOVER_WIDTH = 288;
const VIEWPORT_MARGIN = 12;
const POPOVER_GAP = 8;

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

function quadrantLabel(quadrant?: MatrixQuadrant): string {
  switch (quadrant) {
    case 'urgent-important':
      return 'I · Urgent & Important';
    case 'important':
      return 'II · Not Urgent & Important';
    case 'urgent':
      return 'III · Urgent & Unimportant';
    case 'neither':
      return 'IV · Not Urgent & Unimportant';
    default:
      return 'Unassigned';
  }
}

function formatTimestamp(value?: string): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const DetailRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}> = ({ icon, label, value }) => (
  <div className="grid grid-cols-[16px_72px_minmax(0,1fr)] gap-1.5 items-start">
    <span className="mt-[1px] text-slate-400">{icon}</span>
    <span className="text-[9px] font-bold text-slate-400">{label}</span>
    <span className="text-[9px] font-semibold text-slate-700 break-words">
      {value}
    </span>
  </div>
);

const TaskDetails: React.FC<{ task: TaskItem }> = ({ task }) => {
  const updatedAt = formatTimestamp(task.updatedAt);
  const completedAt = formatTimestamp(task.completedAt);

  return (
    <>
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 w-4 h-4 rounded-md border shrink-0 inline-flex items-center justify-center ${
            task.isCompleted
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-slate-300 bg-white text-slate-400'
          }`}
          aria-hidden="true"
        >
          {task.isCompleted && <Check className="w-3 h-3" />}
        </span>

        <div className="min-w-0">
          <div className="text-[11px] leading-snug font-black text-slate-900 break-words">
            {task.taskOfTheDay}
          </div>
          <div className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-slate-400">
            Task details
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <DetailRow
          icon={<CheckCircle2 className="w-3 h-3" />}
          label="Status"
          value={task.isCompleted ? 'Completed' : 'To do'}
        />

        <DetailRow
          icon={<Flag className="w-3 h-3" />}
          label="Priority"
          value={task.priority || 'Normal'}
        />

        <DetailRow
          icon={<Layers3 className="w-3 h-3" />}
          label="Quadrant"
          value={quadrantLabel(task.matrixQuadrant)}
        />

        {task.timeEstimate && (
          <DetailRow
            icon={<Clock3 className="w-3 h-3" />}
            label="Estimate"
            value={task.timeEstimate}
          />
        )}

        {task.category && (
          <DetailRow
            icon={<Palette className="w-3 h-3" />}
            label="Category"
            value={task.category}
          />
        )}

        {task.notes && (
          <DetailRow
            icon={<NotebookText className="w-3 h-3" />}
            label="Notes"
            value={task.notes}
          />
        )}

        {completedAt && (
          <DetailRow
            icon={<CalendarClock className="w-3 h-3" />}
            label="Completed"
            value={completedAt}
          />
        )}

        {updatedAt && (
          <DetailRow
            icon={<CalendarClock className="w-3 h-3" />}
            label="Updated"
            value={updatedAt}
          />
        )}
      </div>
    </>
  );
};

const HabitDetails: React.FC<{
  habit: HabitItem;
  checked: boolean;
  disabled: boolean;
}> = ({ habit, checked, disabled }) => {
  const updatedAt = formatTimestamp(habit.updatedAt);
  const createdAt = formatTimestamp(habit.createdAt);

  return (
    <>
      <div className="flex items-start gap-2">
        <span className="text-base leading-none" aria-hidden="true">
          {habit.emoji}
        </span>

        <div className="min-w-0">
          <div className="text-[11px] leading-snug font-black text-slate-900 break-words">
            {habit.name}
          </div>
          <div className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-slate-400">
            Habit details
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <DetailRow
          icon={
            checked ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <Circle className="w-3 h-3" />
            )
          }
          label="Status"
          value={
            disabled
              ? 'Future check-in locked'
              : checked
              ? 'Completed'
              : 'Not completed'
          }
        />

        <DetailRow
          icon={<Repeat2 className="w-3 h-3" />}
          label="Schedule"
          value={getHabitScheduleLabel(habit)}
        />

        <DetailRow
          icon={<Palette className="w-3 h-3" />}
          label="Color"
          value={habit.color.charAt(0).toUpperCase() + habit.color.slice(1)}
        />

        <DetailRow
          icon={<CheckCircle2 className="w-3 h-3" />}
          label="Check-ins"
          value={habit.checkIns.length}
        />

        {(habit.skippedDates?.length || habit.extraDates?.length) ? (
          <DetailRow
            icon={<CalendarClock className="w-3 h-3" />}
            label="Changes"
            value={`${habit.skippedDates?.length || 0} skipped • ${
              habit.extraDates?.length || 0
            } extra`}
          />
        ) : null}

        {createdAt && (
          <DetailRow
            icon={<CalendarClock className="w-3 h-3" />}
            label="Created"
            value={createdAt}
          />
        )}

        {updatedAt && (
          <DetailRow
            icon={<CalendarClock className="w-3 h-3" />}
            label="Updated"
            value={updatedAt}
          />
        )}
      </div>
    </>
  );
};

export const CalendarEventChip: React.FC<CalendarEventChipProps> = (props) => {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(
    null
  );

  const updatePopoverPosition = useCallback(() => {
    if (!anchorRef.current || typeof window === 'undefined') return;

    const rect = anchorRef.current.getBoundingClientRect();
    const left = Math.min(
      Math.max(
        VIEWPORT_MARGIN,
        rect.left + rect.width / 2 - POPOVER_WIDTH / 2
      ),
      Math.max(
        VIEWPORT_MARGIN,
        window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN
      )
    );

    const estimatedPopoverHeight = props.kind === 'task' ? 230 : 220;
    const roomBelow = window.innerHeight - rect.bottom;
    const roomAbove = rect.top;
    const placement =
      roomBelow < estimatedPopoverHeight + POPOVER_GAP &&
      roomAbove > roomBelow
        ? 'above'
        : 'below';

    setPopoverPosition({
      left,
      top:
        placement === 'above'
          ? rect.top - POPOVER_GAP
          : rect.bottom + POPOVER_GAP,
      placement,
    });
  }, [props.kind]);

  const openPopover = useCallback(() => {
    updatePopoverPosition();
    setPopoverOpen(true);
  }, [updatePopoverPosition]);

  const closePopover = useCallback(() => {
    setPopoverOpen(false);
  }, []);

  useEffect(() => {
    if (!popoverOpen) return;

    const handleViewportChange = () => updatePopoverPosition();

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [popoverOpen, updatePopoverPosition]);

  const popover =
    popoverOpen &&
    popoverPosition &&
    typeof document !== 'undefined'
      ? createPortal(
          <div
            role="tooltip"
            className={`pointer-events-none fixed z-[160] w-72 max-w-[calc(100vw-24px)] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/10 ${
              popoverPosition.placement === 'above'
                ? '-translate-y-full'
                : ''
            }`}
            style={{
              left: popoverPosition.left,
              top: popoverPosition.top,
            }}
          >
            {props.kind === 'task' ? (
              <TaskDetails task={props.task} />
            ) : (
              <HabitDetails
                habit={props.habit}
                checked={props.checked}
                disabled={props.disabled || false}
              />
            )}
          </div>,
          document.body
        )
      : null;

  if (props.kind === 'task') {
    const { task, onClick } = props;

    return (
      <>
        <div
          ref={anchorRef}
          className="pointer-events-auto w-full min-w-0"
          onMouseEnter={openPopover}
          onMouseLeave={closePopover}
          onFocusCapture={openPopover}
          onBlurCapture={closePopover}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClick();
            }}
            aria-label={`${task.taskOfTheDay}. ${
              task.isCompleted ? 'Completed' : 'To do'
            }.`}
            className={`w-full min-w-0 h-[20px] px-1.5 rounded-[3px] flex items-center gap-1 text-left text-[9px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${taskChipClass(
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
        </div>

        {popover}
      </>
    );
  }

  const { habit, checked, disabled = false, onClick } = props;

  return (
    <>
      <div
        ref={anchorRef}
        className="pointer-events-auto w-full min-w-0"
        onMouseEnter={openPopover}
        onMouseLeave={closePopover}
        onFocusCapture={openPopover}
        onBlurCapture={closePopover}
      >
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
          className={`w-full min-w-0 h-[20px] px-1.5 rounded-[3px] flex items-center gap-1 text-left text-[9px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
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
      </div>

      {popover}
    </>
  );
};
