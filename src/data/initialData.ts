import { DailyRecord, TaskItem } from '../types';

export function getTodayDateKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`; // e.g. "2026-08-26"
}

export function getTodayDateFormatted(): string {
  const d = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`; // e.g. "10-Sep-2026"
}

export const INITIAL_RECORDS: DailyRecord[] = [
  {
    id: 'rec-1',
    day: 1,
    date: getTodayDateFormatted(),
    isCompleted: false,
    result: 'FALSE',
    change: 0,
    notes: '',
  },
];

export const SKILL_OPTIONS = [
  'Excel',
  'Power BI',
  'SQL',
  'Python',
  'DAX',
  'Power Query',
  'Data Modeling',
];

export const INITIAL_TASKS: TaskItem[] = [
  {
    id: 'task-1',
    taskKey: getTodayDateKey(), // Default to today's date: 2026-08-26
    taskOfTheDay: 'Master DAX CALCULATE with KEEPFILTERS and USERELATIONSHIP',
    isCompleted: false,
    priority: 'High',
    timeEstimate: '45m',
    category: 'Power BI DAX',
    notes: 'Implement inactive relationship traversal for secondary order dates in sales model.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-2',
    taskKey: '2026-08-25',
    taskOfTheDay: 'Design Executive Slicer Ribbon with Synchronized Visual Interactions',
    isCompleted: true,
    priority: 'Medium',
    timeEstimate: '30m',
    category: 'Power BI UI/UX',
    notes: 'Configured drill-through filters, bookmarks, and cross-highlighting states.',
    updatedAt: new Date().toISOString(),
    completedAt: '2026-08-25T16:30:00.000Z',
  },
  {
    id: 'task-3',
    taskKey: '2026-08-24',
    taskOfTheDay: 'Optimize Star Schema Performance and Reduce Cardinality in Power Query',
    isCompleted: true,
    priority: 'High',
    timeEstimate: '1h',
    category: 'Data Modeling',
    notes: 'Split high-cardinality datetime columns into discrete Date and Time dimension keys.',
    updatedAt: new Date().toISOString(),
    completedAt: '2026-08-24T14:15:00.000Z',
  },
  {
    id: 'task-4',
    taskKey: '2026-08-23',
    taskOfTheDay: 'Build Dynamic KPI Gauges with Conditional Formatting Thresholds',
    isCompleted: true,
    priority: 'Normal',
    timeEstimate: '25m',
    category: 'Visual Analytics',
    notes: 'Created dynamic measure-driven color hex variables #10B981 and #EF4444.',
    updatedAt: new Date().toISOString(),
    completedAt: '2026-08-23T11:00:00.000Z',
  },
];
