import { db, collection, getDocs } from './db';

/**
 * Escapes a single CSV value according to RFC 4180:
 * - Encloses strings with commas, double-quotes, or newlines in double quotes
 * - Escapes double quotes with two double quotes ("")
 */
export function escapeCsvField(val: any): string {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatCsvRow(fields: any[]): string {
  return fields.map(escapeCsvField).join(',');
}

export interface BackupData {
  days: any[];
  tasks: any[];
  timestamp: string;
}

/**
 * Fetch all project data from Firestore collections
 */
export async function fetchAllProjectData(): Promise<BackupData> {
  const [daysSnap, tasksSnap] = await Promise.all([
    getDocs(collection(db, 'days')).catch(() => ({ docs: [] } as any)),
    getDocs(collection(db, 'tasks')).catch(() => ({ docs: [] } as any)),
  ]);

  const days: any[] = [];
  daysSnap.forEach((d: any) => {
    days.push({ id: d.id, ...d.data() });
  });
  days.sort((a, b) => String(a.dateKey || a.id).localeCompare(String(b.dateKey || b.id)));

  const tasks: any[] = [];
  tasksSnap.forEach((d: any) => {
    tasks.push({ id: d.id, ...d.data() });
  });
  tasks.sort((a, b) => String(a.scheduledDate || '').localeCompare(String(b.scheduledDate || '')));

  return {
    days,
    tasks,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generates days.csv from the canonical Days collection.
 */
export function generateDaysCsv(days: any[]): string {
  const headers = [
    'dateKey',
    'tasksCompleted',
    'taskTotal',
    'taskCompletionRate',
    'habitsCompleted',
    'habitTotal',
    'habitCompletionRate',
    'IsdayCompleted',
  ];

  const rows = days.map((d) => [
    d.dateKey ?? d.id ?? '',
    d.tasksCompleted ?? 0,
    d.taskTotal ?? 0,
    d.taskCompletionRate ?? 0,
    d.habitsCompleted ?? 0,
    d.habitTotal ?? 0,
    d.habitCompletionRate ?? 0,
    d.IsdayCompleted === true ? 'TRUE' : 'FALSE',
  ]);

  return [formatCsvRow(headers), ...rows.map(formatCsvRow)].join('\r\n');
}

/**
 * Bundle only days.csv into export map (other tables removed per user request)
 */
export function generateAllCsvFiles(data: BackupData): Record<string, string> {
  return {
    'days.csv': generateDaysCsv(data.days),
  };
}
