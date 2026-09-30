import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Circle,
  Pause,
  Play,
  RotateCcw,
  Timer
  ChevronDown,
} from 'lucide-react';

interface PomodoroTimerProps {
  className?: string;
  currentTaskTitle?: string;
  todayTasks?: Array<{ id: string; title: string; isCompleted?: boolean }>;
  onCurrentTaskChange?: (taskId: string) => void;
  integrated?: boolean;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  className = '',
  currentTaskTitle = 'No active task selected',
  todayTasks = [],
  onCurrentTaskChange,
  integrated = false,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isTaskLocked, setIsTaskLocked] = useState(false);

  const startedAtRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef(0);

  useEffect(() => {
    if (!isRunning) return;
    const tick = () => {
      const activeMs = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
      setElapsedSeconds(Math.floor((accumulatedMsRef.current + activeMs) / 1000));
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  const formattedTime = useMemo(() => {
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [elapsedSeconds]);

  const toggleTimer = () => {
    if (isRunning) {
      if (startedAtRef.current) accumulatedMsRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
      setElapsedSeconds(Math.floor(accumulatedMsRef.current / 1000));
      setIsRunning(false);
      return;
    }
    startedAtRef.current = Date.now();
    setIsTaskLocked(true);
    setIsRunning(true);
  };

  const resetTimer = useCallback(() => {
    startedAtRef.current = null;
    accumulatedMsRef.current = 0;
    setElapsedSeconds(0);
    setIsRunning(false);
    setIsTaskLocked(false);
  }, []);

  const timerVisual = (
    <div
      className={`flex items-center justify-center rounded-xl border border-slate-200/80 bg-slate-950 px-4 shadow-inner dark:border-slate-700 ${integrated ? 'min-h-[92px] w-full' : 'min-h-[58px] min-w-[112px]'}`}
      aria-label={`Focus timer elapsed time ${formattedTime}`}
    >
      <div className="flex flex-col items-center justify-center">
        {integrated && (
          <span className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Actual Task Time
          </span>
        )}
        <span className={`font-mono font-bold tabular-nums leading-none tracking-[0.04em] text-white ${integrated ? 'text-4xl sm:text-[42px]' : 'text-xl'}`}>
          {formattedTime}
        </span>
        <span className={`mt-1.5 text-[10px] font-semibold uppercase tracking-wider ${isRunning ? 'text-blue-400' : 'text-slate-500'}`}>
          {isRunning ? 'Tracking time' : elapsedSeconds > 0 ? 'Paused' : 'Ready'}
        </span>
      </div>
    </div>
  );

  return (
    <>
      {integrated ? (
        <div
          className={`w-full rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/50 p-2.5 flex flex-col ${className}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
              <Timer className="w-3.5 h-3.5 text-blue-500" />
              Focus Timer
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                isRunning
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isRunning ? 'bg-blue-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              {isRunning ? 'Running' : 'Ready'}
            </span>
          </div>

          <div className="hidden sm:block mt-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-blue-600 dark:text-blue-400">
                Current Task
              </div>
              {todayTasks.length > 0 && (
                <label className="relative inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-200/70 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400" title={isTaskLocked ? "Task locked until focus session finishes or is reset" : "Select today's task"}>
                  <select
                    className={`absolute inset-0 opacity-0 ${isTaskLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    value={todayTasks.find((task) => task.title === currentTaskTitle)?.id || ''}
                    onChange={(event) => onCurrentTaskChange?.(event.target.value)}
                    disabled={isTaskLocked}
                    aria-label={isTaskLocked ? 'Current focus task is locked until this session finishes or is reset' : "Select current focus task from today's tasks"}
                  >
                    <option value="" disabled>Select task</option>
                    {todayTasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.isCompleted ? '✓ ' : ''}{task.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="size-4" aria-hidden="true" />
                </label>
              )}
            </div>
            <div className="mt-1 flex items-start gap-1.5 min-w-0">
              <Circle className="mt-0.5 w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="text-[11px] leading-snug font-semibold text-slate-800 dark:text-slate-100 break-words line-clamp-2" title={currentTaskTitle}>
                {currentTaskTitle}
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-center">
            {timerVisual}
          </div>

          <div className="mt-1 text-center text-[11px] font-medium text-slate-400">Elapsed task time</div>

          <div className="mt-2 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleResetClick}
              title="Reset elapsed time to zero"
              aria-label="Reset elapsed focus time to zero."
              className="w-9 h-9 inline-flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={toggleTimer}
              title={isRunning ? 'Pause focus timer' : 'Start focus timer'}
              aria-label={isRunning ? 'Pause focus timer' : 'Start focus timer'}
              className="w-12 h-12 inline-flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-colors shadow-md shadow-blue-600/20"
            >
              {isRunning ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current translate-x-[1px]" />
              )}
            </button>

          </div>

        </div>
      ) : (
        <div
          className={`relative flex items-center gap-1.5 shrink-0 ${className}`}
        >
          {timerVisual}

          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={toggleTimer}
              title={isRunning ? 'Pause Pomodoro' : 'Start Pomodoro'}
              aria-label={isRunning ? 'Pause Pomodoro' : 'Start Pomodoro'}
              className="w-7 h-7 inline-flex items-center justify-center rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/70 transition-colors"
            >
              {isRunning ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
            </button>

            <button
              type="button"
              onClick={handleResetClick}
              title="Reset timer • Double-click to set custom minutes"
              aria-label="Reset Pomodoro timer. Double-click to set custom minutes."
              className="w-7 h-7 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

    </>
  );
};
