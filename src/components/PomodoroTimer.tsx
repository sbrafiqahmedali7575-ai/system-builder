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
  Timer,
  ChevronDown,
  Volume2,
  VolumeX,
} from 'lucide-react';


const TIMER_ALERT_SETTINGS_KEY = 'system-builder:timer-alert-settings:v1';
const LEGACY_TIMER_VOLUME_KEY = 'system-builder:timer-alert-volume';
const LEGACY_TIMER_MUTED_KEY = 'system-builder:timer-alert-muted';

interface TimerAlertSettings {
  version: 1;
  volume: number;
  muted: boolean;
}

const normalizeAlertVolume = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 70;
};

const readTimerAlertSettings = (): TimerAlertSettings => {
  const fallback: TimerAlertSettings = { version: 1, volume: 70, muted: false };
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(TIMER_ALERT_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<TimerAlertSettings>;
      return {
        version: 1,
        volume: normalizeAlertVolume(parsed.volume),
        muted: parsed.muted === true,
      };
    }
    return {
      version: 1,
      volume: normalizeAlertVolume(window.localStorage.getItem(LEGACY_TIMER_VOLUME_KEY)),
      muted: window.localStorage.getItem(LEGACY_TIMER_MUTED_KEY) === 'true',
    };
  } catch {
    return fallback;
  }
};

const writeTimerAlertSettings = (settings: TimerAlertSettings): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TIMER_ALERT_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Unable to persist timer alert settings:', error);
  }
};

interface PomodoroTimerProps {
  className?: string;
  currentTaskTitle?: string;
  todayTasks?: Array<{ id: string; title: string; isCompleted?: boolean }>;
  onCurrentTaskChange?: (taskId: string) => void;
  initialElapsedSeconds?: number;
  onElapsedCommit?: (elapsedSeconds: number) => void | Promise<void>;
  onCompleteCurrentTask?: (elapsedSeconds: number) => void | Promise<void>;
  integrated?: boolean;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  className = '',
  currentTaskTitle = 'No active task selected',
  todayTasks = [],
  onCurrentTaskChange,
  initialElapsedSeconds = 0,
  onElapsedCommit,
  onCompleteCurrentTask,
  integrated = false,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsedSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isTaskLocked, setIsTaskLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [timerError, setTimerError] = useState<string | null>(null);
  const initialAlertSettingsRef = useRef<TimerAlertSettings | null>(null);
  if (!initialAlertSettingsRef.current) initialAlertSettingsRef.current = readTimerAlertSettings();
  const [alertVolume, setAlertVolume] = useState<number>(initialAlertSettingsRef.current.volume);
  const [alertsMuted, setAlertsMuted] = useState<boolean>(initialAlertSettingsRef.current.muted);

  const startedAtRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef(initialElapsedSeconds * 1000);
  const lastAlertMilestoneRef = useRef(Math.floor(initialElapsedSeconds / 900));

  const playHighAlertBeeps = useCallback((count: 1 | 3) => {
    if (alertsMuted || alertVolume <= 0) return;
    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const audioContext = new AudioContextCtor();
      const startAt = audioContext.currentTime + 0.02;

      for (let index = 0; index < count; index += 1) {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const beepStart = startAt + index * 0.24;
        const beepEnd = beepStart + 0.14;

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(1320, beepStart);
        gain.gain.setValueAtTime(0.0001, beepStart);
        gain.gain.exponentialRampToValueAtTime(0.42 * (alertVolume / 100), beepStart + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, beepEnd);

        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(beepStart);
        oscillator.stop(beepEnd);
      }

      window.setTimeout(() => void audioContext.close(), count === 3 ? 1100 : 500);
    } catch (error) {
      console.warn('Unable to play focus timer alert:', error);
    }
  }, [alertVolume, alertsMuted]);

  useEffect(() => {
    writeTimerAlertSettings({ version: 1, volume: alertVolume, muted: alertsMuted });
  }, [alertVolume, alertsMuted]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncSettings = (event: StorageEvent) => {
      if (event.key !== TIMER_ALERT_SETTINGS_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as Partial<TimerAlertSettings>;
        setAlertVolume(normalizeAlertVolume(parsed.volume));
        setAlertsMuted(parsed.muted === true);
      } catch {
        // Ignore malformed external storage updates and retain current settings.
      }
    };
    window.addEventListener('storage', syncSettings);
    return () => window.removeEventListener('storage', syncSettings);
  }, []);

  useEffect(() => {
    if (isRunning) return;
    accumulatedMsRef.current = initialElapsedSeconds * 1000;
    setElapsedSeconds(initialElapsedSeconds);
  }, [initialElapsedSeconds, isRunning]);

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

  useEffect(() => {
    if (!isRunning) return;
    const currentMilestone = Math.floor(elapsedSeconds / 900);
    if (currentMilestone <= lastAlertMilestoneRef.current) return;

    // If a throttled/backgrounded tab crosses more than one boundary, alert only
    // for the latest reached 15-minute milestone instead of playing a backlog.
    lastAlertMilestoneRef.current = currentMilestone;
    playHighAlertBeeps(currentMilestone % 2 === 0 ? 3 : 1);
  }, [elapsedSeconds, isRunning, playHighAlertBeeps]);

  const formattedTime = useMemo(() => {
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [elapsedSeconds]);

  const hasCurrentTask = currentTaskTitle !== 'No active task selected' && currentTaskTitle !== 'No active task for today';

  const commitElapsed = async (seconds: number) => {
    if (!onElapsedCommit) return;
    try {
      setIsSaving(true);
      setTimerError(null);
      await onElapsedCommit(seconds);
    } catch (error) {
      console.error('Unable to save focus elapsed time:', error);
      setTimerError('Unable to save focus time. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTimer = () => {
    if (isRunning) {
      if (startedAtRef.current) accumulatedMsRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
      setElapsedSeconds(Math.floor(accumulatedMsRef.current / 1000));
      setIsRunning(false);
      void commitElapsed(Math.floor(accumulatedMsRef.current / 1000));
      return;
    }
    if (!hasCurrentTask || isSaving) return;
    lastAlertMilestoneRef.current = Math.floor(elapsedSeconds / 900);
    startedAtRef.current = Date.now();
    setTimerError(null);
    setIsTaskLocked(true);
    setIsRunning(true);
  };

  const resetTimer = useCallback(() => {
    startedAtRef.current = null;
    accumulatedMsRef.current = 0;
    lastAlertMilestoneRef.current = 0;
    setElapsedSeconds(0);
    setIsRunning(false);
    setIsTaskLocked(false);
    void commitElapsed(0);
  }, [onElapsedCommit]);

  const timerVisual = (
    <div
      className={`flex items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 dark:border-slate-800 dark:bg-slate-900/70 ${integrated ? 'min-h-[92px] w-full' : 'min-h-[58px] min-w-[112px]'}`}
      aria-label={`Focus timer elapsed time ${formattedTime}`}
    >
      <div className="flex flex-col items-center justify-center">
        {integrated && (
          <span className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Actual Task Time
          </span>
        )}
        <span className={`font-mono font-bold tabular-nums leading-none tracking-[0.04em] text-slate-900 dark:text-slate-100 ${integrated ? 'text-4xl sm:text-[42px]' : 'text-xl'}`}>
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
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAlertsMuted((muted) => !muted)}
                className="inline-flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label={alertsMuted ? 'Unmute timer alerts' : 'Mute timer alerts'}
                aria-pressed={alertsMuted}
                title={alertsMuted ? 'Unmute timer alerts' : 'Mute timer alerts'}
              >
                {alertsMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
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
              <button
                type="button"
                onClick={async () => {
                  if (!onCompleteCurrentTask || currentTaskTitle === 'No active task selected' || currentTaskTitle === 'No active task for today') return;
                  let finalMs = accumulatedMsRef.current;
                  if (isRunning && startedAtRef.current) finalMs += Date.now() - startedAtRef.current;
                  const finalSeconds = Math.floor(finalMs / 1000);
                  accumulatedMsRef.current = finalMs;
                  startedAtRef.current = null;
                  setElapsedSeconds(finalSeconds);
                  setIsRunning(false);
                  try {
                    setIsSaving(true);
                    setTimerError(null);
                    await onCompleteCurrentTask(finalSeconds);
                    setIsTaskLocked(false);
                  } catch (error) {
                    console.error('Unable to complete focused task:', error);
                    setTimerError('Unable to complete task. Your elapsed time is still available.');
                    setIsTaskLocked(true);
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={!onCompleteCurrentTask || !hasCurrentTask || isSaving}
                className="mt-0.5 shrink-0 text-blue-500 disabled:cursor-default"
                title="Mark current task completed and save actual time"
                aria-label="Mark current task completed and save actual time"
              >
                <Circle className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] leading-snug font-semibold text-slate-800 dark:text-slate-100 break-words line-clamp-2" title={currentTaskTitle}>
                {currentTaskTitle}
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-center">
            {timerVisual}
          </div>

          <div className="mt-1 text-center text-[11px] font-medium text-slate-400">Elapsed task time</div>
          {timerError && <div role="alert" className="mt-1 text-center text-[11px] font-medium text-red-600 dark:text-red-400">{timerError}</div>}

          <div className="mt-2 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={resetTimer}
              disabled={isSaving}
              title="Reset elapsed time to zero"
              aria-label="Reset elapsed focus time to zero."
              className="w-9 h-9 inline-flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={toggleTimer}
              disabled={isSaving || (!isRunning && !hasCurrentTask)}
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

          <details className="mt-2 rounded-xl border border-slate-200/80 bg-slate-50/70 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900/60">
            <summary className="cursor-pointer select-none text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Test Alerts
            </summary>
            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAlertsMuted((muted) => !muted)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                aria-label={alertsMuted ? 'Unmute timer alerts' : 'Mute timer alerts'}
                aria-pressed={alertsMuted}
                title={alertsMuted ? 'Unmute alerts' : 'Mute alerts'}
              >
                {alertsMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <label className="flex min-w-0 flex-1 items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span className="shrink-0">Volume</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={alertVolume}
                  onChange={(event) => setAlertVolume(Number(event.target.value))}
                  className="min-w-0 flex-1"
                  aria-label="Timer alert volume"
                />
                <span className="w-8 text-right tabular-nums">{alertVolume}%</span>
              </label>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => playHighAlertBeeps(1)}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition active:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:active:bg-slate-800"
                aria-label="Preview one high-alert beep"
              >
                1 Beep
              </button>
              <button
                type="button"
                onClick={() => playHighAlertBeeps(3)}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition active:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:active:bg-slate-800"
                aria-label="Preview three high-alert beeps"
              >
                3 Beeps
              </button>
            </div>
          </details>

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
              title={isRunning ? 'Pause focus timer' : 'Start focus timer'}
              aria-label={isRunning ? 'Pause focus timer' : 'Start focus timer'}
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
              onClick={resetTimer}
              title="Reset elapsed time to zero"
              aria-label="Reset elapsed focus time to zero."
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
