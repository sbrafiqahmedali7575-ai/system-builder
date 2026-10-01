import React, { useEffect, useState } from 'react';
import {
  FeedbackDiagnostics,
  FeedbackKind,
  getInteractionFeedbackDiagnostics,
  playInteractionFeedback,
  runHapticDiagnostic,
} from '../utils/interactionFeedback';

const PATTERNS: Array<{ kind: FeedbackKind; label: string }> = [
  { kind: 'tap', label: 'Tap' },
  { kind: 'navigate', label: 'Navigate' },
  { kind: 'toggleOn', label: 'Toggle On' },
  { kind: 'toggleOff', label: 'Toggle Off' },
  { kind: 'success', label: 'Success' },
  { kind: 'complete', label: 'Complete' },
  { kind: 'delete', label: 'Delete' },
  { kind: 'warning', label: 'Warning' },
  { kind: 'error', label: 'Error' },
];

export const FeedbackDiagnosticsPanel: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [diagnostics, setDiagnostics] = useState<FeedbackDiagnostics>(
    getInteractionFeedbackDiagnostics()
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setVisible(params.get('feedback-test') === '1');

    const update = (event?: Event) => {
      const detail = (event as CustomEvent<FeedbackDiagnostics> | undefined)?.detail;
      setDiagnostics(detail || getInteractionFeedbackDiagnostics());
    };

    window.addEventListener('system-builder:feedback-diagnostics', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.removeEventListener('system-builder:feedback-diagnostics', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  if (!visible) return null;

  const test = (kind: FeedbackKind) => {
    playInteractionFeedback(kind);
    window.setTimeout(() => setDiagnostics(getInteractionFeedbackDiagnostics()), 30);
  };

  const hardwareTest = () => {
    setDiagnostics(runHapticDiagnostic());
    window.setTimeout(() => setDiagnostics(getInteractionFeedbackDiagnostics()), 30);
  };

  return (
    <aside className="fixed inset-x-2 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[1000] mx-auto max-w-md rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/95">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-950 dark:text-white">Feedback Diagnostics</h2>
          <p className="mt-0.5 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
            Android vibration + sound test. Remove ?feedback-test=1 to hide.
          </p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${diagnostics.supported ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
          {diagnostics.supported ? 'Vibrate API detected' : 'Vibrate API unavailable'}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900">Visible: <b>{String(diagnostics.visible)}</b></div>
        <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900">Activated: <b>{String(diagnostics.hasBeenActive)}</b></div>
        <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900">Haptics enabled: <b>{String(diagnostics.enabled)}</b></div>
        <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900">Last accepted: <b>{String(diagnostics.lastAccepted)}</b></div>
      </div>

      <button
        type="button"
        onClick={hardwareTest}
        className="mt-2 min-h-11 w-full rounded-xl bg-slate-950 px-3 text-xs font-black text-white dark:bg-white dark:text-slate-950"
      >
        Run Strong Hardware Test
      </button>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {PATTERNS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            onClick={() => test(kind)}
            className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold text-slate-700 active:scale-[.97] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-2 rounded-lg bg-blue-50 px-2.5 py-2 text-[10px] leading-4 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
        Last: <b>{diagnostics.lastKind || 'none'}</b> · pattern {JSON.stringify(diagnostics.lastPattern)}
      </div>
    </aside>
  );
};
