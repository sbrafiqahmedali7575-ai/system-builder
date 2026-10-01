import assert from 'node:assert/strict';
import {
  getInteractionFeedbackDiagnostics,
  playInteractionFeedback,
  runHapticDiagnostic,
  type FeedbackKind,
} from '../src/utils/interactionFeedback';

const calls: Array<number | number[]> = [];

Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    vibrate(pattern: number | number[]) {
      calls.push(pattern);
      return true;
    },
    userActivation: {
      hasBeenActive: true,
      isActive: true,
    },
  },
});

const kinds: FeedbackKind[] = [
  'tap',
  'navigate',
  'toggleOn',
  'toggleOff',
  'success',
  'complete',
  'delete',
  'warning',
  'error',
];

for (const kind of kinds) {
  const before = calls.length;
  playInteractionFeedback(kind);
  assert.equal(calls.length, before + 1, `${kind} must request one vibration pattern`);
  const diagnostics = getInteractionFeedbackDiagnostics();
  assert.equal(diagnostics.supported, true, `${kind}: Vibration API should be detected`);
  assert.equal(diagnostics.lastAccepted, true, `${kind}: vibration request should be accepted`);
  assert.equal(diagnostics.lastKind, kind, `${kind}: diagnostics should retain the semantic kind`);
}

const minimumPulse = (pattern: number | number[]) =>
  (Array.isArray(pattern) ? pattern.filter((_, index) => index % 2 === 0) : [pattern])
    .reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY);

for (const pattern of calls) {
  assert.ok(
    minimumPulse(pattern) >= 20,
    `All tactile pulses should be >=20ms for practical Android detectability; received ${JSON.stringify(pattern)}`
  );
}

const beforeHardware = calls.length;
const result = runHapticDiagnostic();
assert.equal(calls.length, beforeHardware + 1, 'Hardware diagnostic should vibrate once');
assert.deepEqual(calls.at(-1), [80, 60, 120]);
assert.equal(result.lastAccepted, true);
assert.equal(result.lastKind, 'complete');

console.log('interactionFeedback tests passed');
