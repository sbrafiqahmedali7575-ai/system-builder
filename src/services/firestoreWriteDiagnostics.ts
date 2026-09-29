export type FirestoreWriteDiagnostic = {
  at: string;
  source: string;
  collection: string;
  operation: 'create' | 'update' | 'delete' | 'batch' | 'transaction' | 'derived';
  writes: number;
};

const MAX_EVENTS = 200;
const events: FirestoreWriteDiagnostic[] = [];
const enabled =
  typeof window !== 'undefined' &&
  (import.meta.env.DEV || window.localStorage.getItem('SYSTEM_BUILDER_FIRESTORE_DIAGNOSTICS') === '1');

export function recordFirestoreWrite(
  source: string,
  collection: string,
  operation: FirestoreWriteDiagnostic['operation'],
  writes = 1
): void {
  if (!enabled) return;
  const event = { at: new Date().toISOString(), source, collection, operation, writes };
  events.push(event);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  window.dispatchEvent(new CustomEvent('system-builder:firestore-write', { detail: event }));
}

export function getFirestoreWriteDiagnostics(): {
  events: FirestoreWriteDiagnostic[];
  totalWrites: number;
  bySource: Record<string, number>;
} {
  const bySource: Record<string, number> = {};
  let totalWrites = 0;
  for (const event of events) {
    totalWrites += event.writes;
    bySource[event.source] = (bySource[event.source] || 0) + event.writes;
  }
  return { events: [...events], totalWrites, bySource };
}

export function clearFirestoreWriteDiagnostics(): void {
  events.length = 0;
}

// Safe console helper for development. No document data, IDs, titles, notes,
// email addresses, or user content are captured.
if (enabled && typeof window !== 'undefined') {
  (window as Window & { systemBuilderFirestoreWrites?: unknown }).systemBuilderFirestoreWrites = {
    get: getFirestoreWriteDiagnostics,
    clear: clearFirestoreWriteDiagnostics,
  };
}
