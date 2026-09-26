import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Circle,
  Leaf,
  Pause,
  Play,
  RotateCcw,
  Timer,
  X,
} from 'lucide-react';

const DEFAULT_MINUTES = 30;
const SHORT_BREAK_MINUTES = 5;
const LONG_BREAK_MINUTES = 15;
const MAX_CUSTOM_MINUTES = 180;
const ALARM_SECONDS = 60;

type TimerMode = 'focus' | 'short' | 'long' | 'custom';

interface PomodoroTimerProps {
  className?: string;
  currentTaskTitle?: string;
  integrated?: boolean;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  className = '',
  currentTaskTitle = 'No active task selected',
  integrated = false,
}) => {
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_MINUTES * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(String(DEFAULT_MINUTES));
  const [mode, setMode] = useState<TimerMode>('focus');

  const endAtRef = useRef<number | null>(null);
  const resetClickTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const alarmStopTimerRef = useRef<number | null>(null);
  const alarmStartedRef = useRef(false);

  const stopAlarm = useCallback(() => {
    if (alarmStopTimerRef.current) {
      window.clearTimeout(alarmStopTimerRef.current);
      alarmStopTimerRef.current = null;
    }

    oscillatorsRef.current.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch (_) {}
    });
    oscillatorsRef.current = [];

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close().catch(() => undefined);
    }

    alarmStartedRef.current = false;
  }, []);

  const startAlarm = useCallback(() => {
    if (alarmStartedRef.current || typeof window === 'undefined') return;

    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

    if (!AudioContextConstructor) return;

    stopAlarm();
    alarmStartedRef.current = true;

    const audioContext = new AudioContextConstructor();
    audioContextRef.current = audioContext;

    const scheduleBeeps = () => {
      const baseTime = audioContext.currentTime + 0.05;
      const nodes: OscillatorNode[] = [];

      for (let second = 0; second < ALARM_SECONDS; second += 1) {
        const startTime = baseTime + second;
        const endTime = startTime + 0.28;
        const progress =
          ALARM_SECONDS <= 1 ? 1 : second / (ALARM_SECONDS - 1);
        const volume = 0.03 + progress * 0.77;

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, startTime);

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(
          Math.max(0.001, volume),
          startTime + 0.04
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start(startTime);
        oscillator.stop(endTime + 0.02);
        nodes.push(oscillator);
      }

      oscillatorsRef.current = nodes;
      alarmStopTimerRef.current = window.setTimeout(() => {
        stopAlarm();
      }, (ALARM_SECONDS + 1) * 1000);
    };

    if (audioContext.state === 'suspended') {
      void audioContext.resume().then(scheduleBeeps).catch(() => {
        stopAlarm();
      });
    } else {
      scheduleBeeps();
    }
  }, [stopAlarm]);

  useEffect(() => {
    if (!isRunning) return;

    const tick = () => {
      if (!endAtRef.current) return;

      const nextRemaining = Math.max(
        0,
        Math.ceil((endAtRef.current - Date.now()) / 1000)
      );

      setRemainingSeconds(nextRemaining);

      if (nextRemaining <= 0) {
        endAtRef.current = null;
        setIsRunning(false);
        startAlarm();
      }
    };

    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [isRunning, startAlarm]);

  useEffect(() => {
    return () => {
      if (resetClickTimerRef.current) {
        window.clearTimeout(resetClickTimerRef.current);
      }
      stopAlarm();
    };
  }, [stopAlarm]);

  const elapsedPercent = useMemo(() => {
    if (durationSeconds <= 0) return 0;
    return Math.min(
      100,
      Math.max(
        0,
        ((durationSeconds - remainingSeconds) / durationSeconds) * 100
      )
    );
  }, [durationSeconds, remainingSeconds]);

  const formattedTime = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
      2,
      '0'
    )}`;
  }, [remainingSeconds]);

  const modeLabel =
    mode === 'focus'
      ? 'Focus Session'
      : mode === 'short'
      ? 'Short Break'
      : mode === 'long'
      ? 'Long Break'
      : 'Custom Session';

  const toggleTimer = () => {
    stopAlarm();

    if (isRunning) {
      if (endAtRef.current) {
        setRemainingSeconds(
          Math.max(
            0,
            Math.ceil((endAtRef.current - Date.now()) / 1000)
          )
        );
      }
      endAtRef.current = null;
      setIsRunning(false);
      return;
    }

    let secondsToRun = remainingSeconds;
    if (secondsToRun <= 0) {
      secondsToRun = durationSeconds;
      setRemainingSeconds(durationSeconds);
    }

    endAtRef.current = Date.now() + secondsToRun * 1000;
    setIsRunning(true);
  };

  const resetTimer = useCallback(() => {
    stopAlarm();
    endAtRef.current = null;
    setIsRunning(false);
    setRemainingSeconds(durationSeconds);
  }, [durationSeconds, stopAlarm]);

  const setPreset = (nextMode: TimerMode, minutes: number) => {
    stopAlarm();
    endAtRef.current = null;
    setIsRunning(false);
    setMode(nextMode);
    setDurationSeconds(minutes * 60);
    setRemainingSeconds(minutes * 60);
    setCustomMinutes(String(minutes));
  };

  const openCustom = () => {
    stopAlarm();
    endAtRef.current = null;
    setIsRunning(false);
    setMode('custom');
    setCustomMinutes(
      String(Math.max(1, Math.round(durationSeconds / 60)))
    );
    setIsCustomOpen(true);
  };

  const handleResetClick = () => {
    if (resetClickTimerRef.current) {
      window.clearTimeout(resetClickTimerRef.current);
    }

    resetClickTimerRef.current = window.setTimeout(() => {
      resetTimer();
      resetClickTimerRef.current = null;
    }, 260);
  };

  const handleResetDoubleClick = () => {
    if (resetClickTimerRef.current) {
      window.clearTimeout(resetClickTimerRef.current);
      resetClickTimerRef.current = null;
    }
    openCustom();
  };

  const applyCustomTime = (event: FormEvent) => {
    event.preventDefault();
    const parsed = Math.round(Number(customMinutes));
    if (!Number.isFinite(parsed)) return;

    const minutes = Math.min(
      MAX_CUSTOM_MINUTES,
      Math.max(1, parsed)
    );
    const nextDuration = minutes * 60;

    stopAlarm();
    endAtRef.current = null;
    setIsRunning(false);
    setMode('custom');
    setDurationSeconds(nextDuration);
    setRemainingSeconds(nextDuration);
    setCustomMinutes(String(minutes));
    setIsCustomOpen(false);
  };

  const size = integrated ? 116 : 58;
  const strokeWidth = integrated ? 7 : 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - elapsedPercent / 100);

  const timerVisual = (
    <div
      className={
        integrated
          ? 'relative w-[116px] h-[116px] flex items-center justify-center'
          : 'relative w-[58px] h-[58px] flex items-center justify-center'
      }
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={
            integrated
              ? 'text-emerald-100 dark:text-emerald-950/60'
              : 'text-slate-200 dark:text-slate-700'
          }
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={
            integrated
              ? 'text-emerald-500 transition-[stroke-dashoffset] duration-300 ease-linear'
              : 'text-blue-600 transition-[stroke-dashoffset] duration-300 ease-linear'
          }
        />
      </svg>

      <span
        className="absolute inset-0 flex flex-col items-center justify-center text-slate-900 dark:text-slate-100"
        aria-label={`Pomodoro timer ${formattedTime} remaining`}
      >
        {integrated ? (
          <>
            <span className="text-[9px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              {mode === 'focus' ? 'Focus' : 'Break'}
            </span>
            <span className="mt-0.5 text-2xl leading-none font-black font-mono tabular-nums">
              {formattedTime}
            </span>
            <Leaf
              className="mt-1 w-3.5 h-3.5 text-emerald-500"
              aria-hidden="true"
            />
          </>
        ) : (
          <>
            <Timer
              className={`w-3.5 h-3.5 ${
                isRunning
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
              aria-hidden="true"
            />
            <span className="mt-0.5 text-[10px] leading-none font-black font-mono tabular-nums">
              {formattedTime}
            </span>
          </>
        )}
      </span>
    </div>
  );

  return (
    <>
      {integrated ? (
        <div
          className={`w-full rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-white/90 dark:bg-slate-950/60 p-2.5 flex flex-col ${className}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide font-black text-slate-500 dark:text-slate-400">
              <Timer className="w-3.5 h-3.5 text-emerald-500" />
              Focus Timer
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-black ${
                isRunning
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              {isRunning ? 'Running' : 'Ready'}
            </span>
          </div>

          <div className="mt-2 rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/80 dark:bg-emerald-950/20 px-2.5 py-2">
            <div className="text-[8px] uppercase tracking-wide font-black text-emerald-700/70 dark:text-emerald-400/70">
              Current Task
            </div>
            <div className="mt-1 flex items-start gap-1.5 min-w-0">
              <Circle className="mt-0.5 w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span
                className="text-[11px] leading-snug font-black text-slate-800 dark:text-slate-100 break-words line-clamp-2"
                title={currentTaskTitle}
              >
                {currentTaskTitle}
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-center">
            {timerVisual}
          </div>

          <div className="mt-1 text-center text-[9px] font-bold text-slate-400">
            {modeLabel}
          </div>

          <div className="mt-2 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleResetClick}
              onDoubleClick={handleResetDoubleClick}
              title="Reset timer • Double-click to set custom minutes"
              aria-label="Reset Pomodoro timer. Double-click to set custom minutes."
              className="w-9 h-9 inline-flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={toggleTimer}
              title={isRunning ? 'Pause focus timer' : 'Start focus timer'}
              aria-label={isRunning ? 'Pause focus timer' : 'Start focus timer'}
              className="w-12 h-12 inline-flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white transition-colors shadow-md shadow-emerald-500/20"
            >
              {isRunning ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current translate-x-[1px]" />
              )}
            </button>

            <div className="w-9 h-9 rounded-full border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-500">
              <Leaf className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-2 grid grid-cols-4 gap-1">
            {[
              {
                id: 'focus' as TimerMode,
                label: 'Focus',
                minutes: DEFAULT_MINUTES,
              },
              {
                id: 'short' as TimerMode,
                label: 'Short',
                minutes: SHORT_BREAK_MINUTES,
              },
              {
                id: 'long' as TimerMode,
                label: 'Long',
                minutes: LONG_BREAK_MINUTES,
              },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setPreset(preset.id, preset.minutes)}
                className={`min-w-0 rounded-lg border px-1 py-1.5 text-center transition-colors ${
                  mode === preset.id
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                }`}
              >
                <div className="truncate text-[8px] font-black">
                  {preset.label}
                </div>
                <div
                  className={`mt-0.5 text-[7px] font-bold ${
                    mode === preset.id
                      ? 'text-emerald-50'
                      : 'text-slate-400'
                  }`}
                >
                  {preset.minutes}m
                </div>
              </button>
            ))}

            <button
              type="button"
              onClick={openCustom}
              className={`min-w-0 rounded-lg border px-1 py-1.5 text-center transition-colors ${
                mode === 'custom'
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
              }`}
            >
              <div className="truncate text-[8px] font-black">Custom</div>
              <div
                className={`mt-0.5 text-[7px] font-bold ${
                  mode === 'custom' ? 'text-emerald-50' : 'text-slate-400'
                }`}
              >
                {mode === 'custom'
                  ? `${Math.round(durationSeconds / 60)}m`
                  : 'Set'}
              </div>
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
              onDoubleClick={handleResetDoubleClick}
              title="Reset timer • Double-click to set custom minutes"
              aria-label="Reset Pomodoro timer. Double-click to set custom minutes."
              className="w-7 h-7 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {isCustomOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-950/35 backdrop-blur-[2px]"
              role="dialog"
              aria-modal="true"
              aria-label="Set custom Pomodoro time"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setIsCustomOpen(false);
                }
              }}
            >
              <div className="w-full max-w-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                      Custom Focus Time
                    </h3>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Set a focus duration from 1 to {MAX_CUSTOM_MINUTES} minutes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCustomOpen(false)}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    aria-label="Close custom timer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={applyCustomTime} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={MAX_CUSTOM_MINUTES}
                      step={1}
                      autoFocus
                      value={customMinutes}
                      onChange={(event) =>
                        setCustomMinutes(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          setIsCustomOpen(false);
                        }
                      }}
                      className="min-w-0 flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-sm font-black text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                      aria-label="Custom focus minutes"
                    />
                    <span className="text-xs font-bold text-slate-400">
                      minutes
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCustomOpen(false)}
                      className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white text-xs font-black"
                    >
                      Set Timer
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
};
