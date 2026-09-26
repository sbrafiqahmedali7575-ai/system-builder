import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, X } from 'lucide-react';

const DEFAULT_MINUTES = 30;
const MAX_CUSTOM_MINUTES = 180;
const ALARM_SECONDS = 60;

interface PomodoroTimerProps {
  className?: string;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ className = '' }) => {
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_MINUTES * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(String(DEFAULT_MINUTES));

  const endAtRef = useRef<number | null>(null);
  const resetClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const alarmStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

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
        const progress = ALARM_SECONDS <= 1 ? 1 : second / (ALARM_SECONDS - 1);
        const volume = 0.035 + progress * 0.465;

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, startTime);

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), startTime + 0.04);
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
      Math.max(0, ((durationSeconds - remainingSeconds) / durationSeconds) * 100)
    );
  }, [durationSeconds, remainingSeconds]);

  const formattedTime = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [remainingSeconds]);

  const toggleTimer = () => {
    stopAlarm();

    if (isRunning) {
      if (endAtRef.current) {
        setRemainingSeconds(
          Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))
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
    stopAlarm();
    endAtRef.current = null;
    setIsRunning(false);
    setCustomMinutes(String(Math.max(1, Math.round(durationSeconds / 60))));
    setIsCustomOpen(true);
  };

  const applyCustomTime = (event: FormEvent) => {
    event.preventDefault();
    const parsed = Math.round(Number(customMinutes));
    if (!Number.isFinite(parsed)) return;

    const minutes = Math.min(MAX_CUSTOM_MINUTES, Math.max(1, parsed));
    const nextDuration = minutes * 60;

    stopAlarm();
    endAtRef.current = null;
    setIsRunning(false);
    setDurationSeconds(nextDuration);
    setRemainingSeconds(nextDuration);
    setCustomMinutes(String(minutes));
    setIsCustomOpen(false);
  };

  const size = 58;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - elapsedPercent / 100);

  return (
    <div className={`relative flex items-center gap-1.5 shrink-0 ${className}`}>
      <div className="relative w-[58px] h-[58px] flex items-center justify-center">
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
            className="text-slate-200 dark:text-slate-700"
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
            className="text-blue-600 transition-[stroke-dashoffset] duration-300 ease-linear"
          />
        </svg>

        <span
          className="absolute inset-0 flex items-center justify-center text-[11px] font-black font-mono tabular-nums text-slate-900 dark:text-slate-100"
          aria-label={`Pomodoro timer ${formattedTime} remaining`}
        >
          {formattedTime}
        </span>
      </div>

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

      {isCustomOpen && (
        <div className="absolute z-[90] top-[64px] left-0 w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2.5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">
              Custom Pomodoro
            </span>
            <button
              type="button"
              onClick={() => setIsCustomOpen(false)}
              className="w-5 h-5 inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close custom timer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={applyCustomTime} className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={MAX_CUSTOM_MINUTES}
              step={1}
              autoFocus
              value={customMinutes}
              onChange={(event) => setCustomMinutes(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setIsCustomOpen(false);
              }}
              className="min-w-0 flex-1 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
              aria-label="Custom Pomodoro minutes"
            />
            <span className="text-[10px] font-bold text-slate-400">min</span>
            <button
              type="submit"
              className="h-8 px-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black"
            >
              Set
            </button>
          </form>
          <p className="mt-1.5 text-[9px] leading-4 text-slate-400">
            1–{MAX_CUSTOM_MINUTES} minutes. Reset uses this value until the page is reloaded.
          </p>
        </div>
      )}
    </div>
  );
};
