import { DailyRecord, HabitItem, TaskItem } from '../types';
import { INITIAL_RECORDS } from '../data/initialData';
import { standardizeDate } from '../utils/dateUtils';

export type Unsubscribe = () => void;

export interface CountdownSettings {
  targetDate: string;
  reason: string;
  updatedAt?: string;
}

const POLL_INTERVAL_MS = 15_000;

function notifyOwnerAuthRequired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('system-builder-owner-auth-required')
    );
  }
}

async function apiRequest<T>(
  url: string,
  init: RequestInit = {}
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      credentials: 'same-origin',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Network request failed: ${error.message}`
        : 'Network request failed.'
    );
  }

  let body: any = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text };
    }
  }

  if (response.status === 401) {
    notifyOwnerAuthRequired();
    throw new Error('Owner authentication required.');
  }

  if (!response.ok) {
    throw new Error(
      body?.error ||
        `Server data request failed with status ${response.status}.`
    );
  }

  return body as T;
}

function subscribeWithPolling<T>(
  load: () => Promise<T>,
  onUpdate: (value: T) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  let active = true;
  let inFlight = false;

  const run = async () => {
    if (!active || inFlight) return;
    inFlight = true;

    try {
      const value = await load();
      if (active) onUpdate(value);
    } catch (error) {
      if (active && onError) {
        onError(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    } finally {
      inFlight = false;
    }
  };

  void run();

  const intervalId =
    typeof window !== 'undefined'
      ? window.setInterval(run, POLL_INTERVAL_MS)
      : undefined;

  const handleRefresh = () => void run();

  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleRefresh);
    window.addEventListener('online', handleRefresh);
  }

  return () => {
    active = false;

    if (typeof window !== 'undefined') {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('online', handleRefresh);
    }
  };
}

async function loadRecords(): Promise<DailyRecord[]> {
  const response = await apiRequest<{ records?: DailyRecord[] }>(
    '/api/data/records'
  );

  const fetched = Array.isArray(response.records)
    ? response.records.map((record) => {
        const rawDate = String(record.date || '');
        return {
          ...record,
          date: standardizeDate(rawDate) || rawDate,
          result: record.isCompleted ? 'TRUE' : 'FALSE',
          day: Number(record.day || 0),
          change: Number(record.change || 0),
        } as DailyRecord;
      })
    : [];

  fetched.sort((a, b) => a.day - b.day);

  const seenDays = new Set<number>();
  return fetched.map((record) => {
    let safeDay = record.day;
    if (safeDay <= 0 || seenDays.has(safeDay)) {
      safeDay = 1;
      while (seenDays.has(safeDay)) safeDay += 1;
    }
    seenDays.add(safeDay);
    return safeDay === record.day ? record : { ...record, day: safeDay };
  });
}

export function subscribeToRecords(
  onUpdate: (records: DailyRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  let seeded = false;

  return subscribeWithPolling(
    async () => {
      const records = await loadRecords();

      if (records.length === 0 && !seeded) {
        seeded = true;
        await seedInitialData(INITIAL_RECORDS);
        return loadRecords();
      }

      return records;
    },
    onUpdate,
    onError
  );
}

export async function seedInitialData(
  records: DailyRecord[]
): Promise<void> {
  for (const record of records) {
    await updateRecordInCloud(record);
  }
}

export async function addRecordToCloud(
  record: DailyRecord
): Promise<void> {
  await apiRequest(
    `/api/data/records/${encodeURIComponent(record.id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(record),
    }
  );
}

export async function updateRecordInCloud(
  record: DailyRecord
): Promise<void> {
  await apiRequest(
    `/api/data/records/${encodeURIComponent(record.id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(record),
    }
  );
}

export async function deleteRecordFromCloud(
  recordId: string
): Promise<void> {
  await apiRequest(
    `/api/data/records/${encodeURIComponent(recordId)}`,
    { method: 'DELETE' }
  );
}

export async function bulkAddRecordsToCloud(
  records: DailyRecord[]
): Promise<void> {
  for (const record of records) {
    await updateRecordInCloud(record);
  }
}

export async function resetRecordsInCloud(
  initialRecords: DailyRecord[]
): Promise<void> {
  const existing = await loadRecords();

  for (const record of existing) {
    await deleteRecordFromCloud(record.id);
  }

  await seedInitialData(initialRecords);
}

async function loadTasks(): Promise<TaskItem[]> {
  const response = await apiRequest<{ tasks?: TaskItem[] }>(
    '/api/data/tasks'
  );

  const tasks = Array.isArray(response.tasks)
    ? response.tasks.map((task) => ({
        ...task,
        priority: task.priority || 'Normal',
        timeEstimate: task.timeEstimate || '',
        category: task.category || '',
        notes: task.notes || '',
        completedAt: task.completedAt || undefined,
        matrixQuadrant: task.matrixQuadrant || undefined,
      }))
    : [];

  tasks.sort((a, b) =>
    String(b.taskKey || '').localeCompare(String(a.taskKey || ''))
  );

  return tasks;
}

export function subscribeToTasks(
  onUpdate: (tasks: TaskItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return subscribeWithPolling(loadTasks, onUpdate, onError);
}

export async function seedInitialTasks(
  tasks: TaskItem[]
): Promise<void> {
  for (const task of tasks) {
    await updateTaskInCloud(task);
  }
}

export async function addTaskToCloud(
  task: TaskItem
): Promise<void> {
  await apiRequest(
    `/api/data/tasks/${encodeURIComponent(task.id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(task),
    }
  );
}

export async function updateTaskInCloud(
  task: TaskItem
): Promise<void> {
  await apiRequest(
    `/api/data/tasks/${encodeURIComponent(task.id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(task),
    }
  );
}

export async function deleteTaskFromCloud(
  taskId: string
): Promise<void> {
  await apiRequest(
    `/api/data/tasks/${encodeURIComponent(taskId)}`,
    { method: 'DELETE' }
  );
}

export async function resetTasksInCloud(
  initialTasks: TaskItem[]
): Promise<void> {
  const existing = await loadTasks();

  for (const task of existing) {
    await deleteTaskFromCloud(task.id);
  }

  await seedInitialTasks(initialTasks);
}

async function loadHabits(): Promise<HabitItem[]> {
  const response = await apiRequest<{ habits?: HabitItem[] }>(
    '/api/data/habits'
  );

  const habits = Array.isArray(response.habits)
    ? response.habits.map((habit) => ({
        ...habit,
        emoji: habit.emoji || '✓',
        frequency: (
          habit.frequency === 'custom'
            ? 'custom'
            : habit.frequency === 'weekdays'
            ? 'weekdays'
            : 'daily'
        ) as HabitItem['frequency'],
        repeatDays: Array.isArray(habit.repeatDays)
          ? habit.repeatDays
          : [],
        skippedDates: Array.isArray(habit.skippedDates)
          ? habit.skippedDates
          : [],
        extraDates: Array.isArray(habit.extraDates)
          ? habit.extraDates
          : [],
        checkIns: Array.isArray(habit.checkIns)
          ? habit.checkIns
          : [],
      }))
    : [];

  habits.sort((a, b) =>
    String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
  );

  return habits;
}

export function subscribeToHabits(
  onUpdate: (habits: HabitItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return subscribeWithPolling(loadHabits, onUpdate, onError);
}

export async function addHabitToCloud(
  habit: HabitItem
): Promise<void> {
  await apiRequest(
    `/api/data/habits/${encodeURIComponent(habit.id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(habit),
    }
  );
}

export async function updateHabitInCloud(
  habit: HabitItem
): Promise<void> {
  await apiRequest(
    `/api/data/habits/${encodeURIComponent(habit.id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(habit),
    }
  );
}

export async function deleteHabitFromCloud(
  habitId: string
): Promise<void> {
  await apiRequest(
    `/api/data/habits/${encodeURIComponent(habitId)}`,
    { method: 'DELETE' }
  );
}

export function subscribeToCountdownSettings(
  onUpdate: (settings: CountdownSettings | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return subscribeWithPolling(
    async () => {
      const response = await apiRequest<{
        settings?: CountdownSettings | null;
      }>('/api/data/countdown');
      return response.settings || null;
    },
    onUpdate,
    onError
  );
}

export async function saveCountdownSettings(
  settings: Pick<CountdownSettings, 'targetDate' | 'reason'>
): Promise<void> {
  await apiRequest('/api/data/countdown', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export async function syncAllDataInCloud(
  records: DailyRecord[],
  tasks: TaskItem[]
): Promise<void> {
  for (const record of records) {
    await updateRecordInCloud(record);
  }

  for (const task of tasks) {
    await updateTaskInCloud(task);
  }
}
