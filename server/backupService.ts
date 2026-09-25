import { db, collection, getDocs, doc, getDoc } from './db';

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
  records: any[];
  tasks: any[];
  deliveryLogs: any[];
  settings: any;
  timestamp: string;
}

/**
 * Fetch all project data from Firestore collections
 */
export async function fetchAllProjectData(): Promise<BackupData> {
  const [recordsSnap, tasksSnap, logsSnap, settingsSnap] = await Promise.all([
    getDocs(collection(db, 'records')).catch(() => ({ docs: [] } as any)),
    getDocs(collection(db, 'tasks')).catch(() => ({ docs: [] } as any)),
    getDocs(collection(db, 'delivery_logs')).catch(() => ({ docs: [] } as any)),
    getDoc(doc(db, 'notification_settings', 'daily-settings')).catch(() => null),
  ]);

  const records: any[] = [];
  recordsSnap.forEach((d: any) => {
    records.push({ id: d.id, ...d.data() });
  });
  records.sort((a, b) => (Number(a.day) || 0) - (Number(b.day) || 0));

  const tasks: any[] = [];
  tasksSnap.forEach((d: any) => {
    tasks.push({ id: d.id, ...d.data() });
  });
  tasks.sort((a, b) => String(a.taskKey || '').localeCompare(String(b.taskKey || '')));

  const deliveryLogs: any[] = [];
  logsSnap.forEach((d: any) => {
    deliveryLogs.push({ id: d.id, ...d.data() });
  });
  deliveryLogs.sort((a, b) => String(b.sentAt || '').localeCompare(String(a.sentAt || '')));

  const settings = settingsSnap && settingsSnap.exists()
    ? { id: settingsSnap.id, ...settingsSnap.data() }
    : {
        id: 'daily-settings',
        enabled: true,
        recipientEmail: 'sbrafiqahmedali7575@gmail.com',
        recipientName: 'Rafiq Ahmed',
        scheduledTime: '21:00',
        timezone: 'Asia/Kolkata',
      };

  return {
    records,
    tasks,
    deliveryLogs,
    settings,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generates records.csv string keeping only the 5 exact columns:
 * id,day,date,isCompleted,notes
 */
export function generateRecordsCsv(records: any[]): string {
  const headers = [
    'id',
    'day',
    'date',
    'isCompleted',
    'notes',
  ];

  const rows = records.map((r) => {
    const isComp = r.isCompleted === true;
    return [
      r.id ?? '',
      r.day ?? '',
      r.date ?? '',
      isComp ? 'TRUE' : 'FALSE',
      r.notes ?? '',
    ];
  });

  return [formatCsvRow(headers), ...rows.map(formatCsvRow)].join('\r\n');
}

/**
 * Bundle only records.csv into export map (other tables removed per user request)
 */
export function generateAllCsvFiles(data: BackupData): Record<string, string> {
  return {
    'records.csv': generateRecordsCsv(data.records),
  };
}
