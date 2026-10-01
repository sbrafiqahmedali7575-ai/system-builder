export type FeedbackKind =
  | 'tap'
  | 'navigate'
  | 'toggleOn'
  | 'toggleOff'
  | 'success'
  | 'complete'
  | 'delete'
  | 'warning'
  | 'error';

const SETTINGS_KEY = 'system-builder:interaction-feedback:v1';

interface FeedbackSettings {
  sound: boolean;
  haptics: boolean;
  volume: number;
}

const DEFAULT_SETTINGS: FeedbackSettings = {
  sound: true,
  haptics: true,
  volume: 0.22,
};

let audioContext: AudioContext | null = null;
let installed = false;
let lastGenericAt = 0;

export interface FeedbackDiagnostics {
  supported: boolean;
  visible: boolean;
  hasBeenActive: boolean | null;
  isActive: boolean | null;
  enabled: boolean;
  lastPattern: number | number[] | null;
  lastAccepted: boolean | null;
  lastKind: FeedbackKind | null;
  lastAt: number | null;
}

const diagnostics: FeedbackDiagnostics = {
  supported: typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
  visible: typeof document === 'undefined' ? true : document.visibilityState === 'visible',
  hasBeenActive:
    typeof navigator !== 'undefined' && navigator.userActivation
      ? navigator.userActivation.hasBeenActive
      : null,
  isActive:
    typeof navigator !== 'undefined' && navigator.userActivation
      ? navigator.userActivation.isActive
      : null,
  enabled: true,
  lastPattern: null,
  lastAccepted: null,
  lastKind: null,
  lastAt: null,
};

function emitDiagnostics() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('system-builder:feedback-diagnostics', {
      detail: { ...diagnostics },
    })
  );
}

function readSettings(): FeedbackSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<FeedbackSettings>;
    return {
      sound: parsed.sound !== false,
      haptics: parsed.haptics !== false,
      volume:
        typeof parsed.volume === 'number'
          ? Math.min(1, Math.max(0, parsed.volume))
          : DEFAULT_SETTINGS.volume,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!audioContext) audioContext = new AudioContextCtor();
  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(() => undefined);
  }
  return audioContext;
}

function vibrate(pattern: number | number[], kind?: FeedbackKind): boolean {
  const { haptics } = readSettings();
  diagnostics.supported =
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  diagnostics.visible =
    typeof document === 'undefined' || document.visibilityState === 'visible';
  diagnostics.hasBeenActive =
    typeof navigator !== 'undefined' && navigator.userActivation
      ? navigator.userActivation.hasBeenActive
      : null;
  diagnostics.isActive =
    typeof navigator !== 'undefined' && navigator.userActivation
      ? navigator.userActivation.isActive
      : null;
  diagnostics.enabled = haptics;
  diagnostics.lastPattern = pattern;
  diagnostics.lastKind = kind ?? null;
  diagnostics.lastAt = Date.now();

  if (
    !haptics ||
    !diagnostics.supported ||
    !diagnostics.visible ||
    typeof navigator === 'undefined'
  ) {
    diagnostics.lastAccepted = false;
    emitDiagnostics();
    return false;
  }

  try {
    const accepted = navigator.vibrate(pattern);
    diagnostics.lastAccepted = accepted;
    emitDiagnostics();
    return accepted;
  } catch {
    diagnostics.lastAccepted = false;
    emitDiagnostics();
    return false;
  }
}

function tone(
  startFrequency: number,
  endFrequency: number,
  duration: number,
  delay = 0,
  gainScale = 1,
  type: OscillatorType = 'sine'
) {
  const settings = readSettings();
  if (!settings.sound || settings.volume <= 0) return;
  const context = getAudioContext();
  if (!context) return;

  const startAt = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFrequency, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(40, endFrequency),
    startAt + duration
  );

  const peak = Math.min(0.14, settings.volume * 0.24 * gainScale);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

export function playInteractionFeedback(kind: FeedbackKind) {
  switch (kind) {
    case 'tap':
      vibrate(22, kind);
      tone(620, 760, 0.045, 0, 0.45);
      break;
    case 'navigate':
      vibrate(26, kind);
      tone(520, 680, 0.06, 0, 0.5);
      break;
    case 'toggleOn':
      vibrate(32, kind);
      tone(660, 900, 0.075, 0, 0.62);
      break;
    case 'toggleOff':
      vibrate(20, kind);
      tone(560, 460, 0.055, 0, 0.42);
      break;
    case 'success':
      vibrate([36, 34, 48], kind);
      tone(660, 760, 0.09, 0, 0.72);
      tone(830, 940, 0.1, 0.07, 0.64);
      break;
    case 'complete':
      vibrate([38, 30, 58], kind);
      tone(587, 700, 0.09, 0, 0.82);
      tone(740, 880, 0.1, 0.065, 0.78);
      tone(988, 1175, 0.13, 0.13, 0.72);
      break;
    case 'delete':
      vibrate(46, kind);
      tone(220, 130, 0.11, 0, 0.62, 'triangle');
      break;
    case 'warning':
      vibrate([42, 38, 42], kind);
      tone(440, 520, 0.09, 0, 0.62, 'triangle');
      tone(440, 520, 0.09, 0.13, 0.62, 'triangle');
      break;
    case 'error':
      vibrate([56, 44, 68], kind);
      tone(330, 210, 0.13, 0, 0.72, 'square');
      tone(260, 170, 0.14, 0.11, 0.56, 'square');
      break;
  }
}

function inferGenericFeedback(target: Element): FeedbackKind | null {
  const explicit = target.closest<HTMLElement>('[data-feedback]')?.dataset.feedback;
  if (explicit === 'none') return null;
  if (
    explicit === 'tap' ||
    explicit === 'navigate' ||
    explicit === 'toggleOn' ||
    explicit === 'toggleOff' ||
    explicit === 'success' ||
    explicit === 'complete' ||
    explicit === 'delete' ||
    explicit === 'warning' ||
    explicit === 'error'
  ) {
    return explicit;
  }

  const control = target.closest<HTMLElement>(
    'button, a[href], [role="button"], input[type="checkbox"], input[type="radio"], select, summary'
  );
  if (!control || control.hasAttribute('disabled') || control.getAttribute('aria-disabled') === 'true') {
    return null;
  }

  if (control.matches('a[href]')) return 'navigate';
  if (control.matches('input[type="checkbox"], input[type="radio"]')) {
    return (control as HTMLInputElement).checked ? 'toggleOn' : 'toggleOff';
  }

  return 'tap';
}

export function installInteractionFeedback() {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  const unlock = () => {
    const context = getAudioContext();
    if (context?.state === 'suspended') void context.resume().catch(() => undefined);
  };

  document.addEventListener('pointerdown', unlock, {
    capture: true,
    passive: true,
    once: true,
  });

  document.addEventListener(
    'click',
    (event) => {
      if (!(event.target instanceof Element)) return;
      const now = performance.now();
      if (now - lastGenericAt < 35) return;
      const kind = inferGenericFeedback(event.target);
      if (!kind) return;
      lastGenericAt = now;
      playInteractionFeedback(kind);
    },
    true
  );
}

export function updateInteractionFeedbackSettings(
  patch: Partial<FeedbackSettings>
) {
  if (typeof window === 'undefined') return;
  const next = { ...readSettings(), ...patch };
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}


export function getInteractionFeedbackDiagnostics(): FeedbackDiagnostics {
  diagnostics.supported =
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  diagnostics.visible =
    typeof document === 'undefined' || document.visibilityState === 'visible';
  diagnostics.hasBeenActive =
    typeof navigator !== 'undefined' && navigator.userActivation
      ? navigator.userActivation.hasBeenActive
      : null;
  diagnostics.isActive =
    typeof navigator !== 'undefined' && navigator.userActivation
      ? navigator.userActivation.isActive
      : null;
  diagnostics.enabled = readSettings().haptics;
  return { ...diagnostics };
}

export function runHapticDiagnostic(): FeedbackDiagnostics {
  vibrate([80, 60, 120], 'complete');
  return getInteractionFeedbackDiagnostics();
}
