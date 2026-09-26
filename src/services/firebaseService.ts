import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { DailyRecord, HabitItem, TaskItem } from '../types';
import { INITIAL_RECORDS, INITIAL_TASKS } from '../data/initialData';
import { standardizeDate } from '../utils/dateUtils';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Target specific Firestore Database ID if configured
export const db =
  firebaseConfig.firestoreDatabaseId &&
  firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

const RECORDS_COLLECTION = 'records';
const TASKS_COLLECTION = 'tasks';
const HABITS_COLLECTION = 'habits';

/**
 * Subscribe to real-time updates from Firestore.
 * Automatically initializes initial sample data if the collection is empty.
 */
export function subscribeToRecords(
  onUpdate: (records: DailyRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const recordsCol = collection(db, RECORDS_COLLECTION);

  return onSnapshot(
    recordsCol,
    async (snapshot) => {
      if (snapshot.empty) {
        // Seed default template data if remote database is empty
        try {
          await seedInitialData(INITIAL_RECORDS);
        } catch (e) {
          console.error('Error seeding initial records to Firestore:', e);
          onUpdate(INITIAL_RECORDS);
        }
        return;
      }

      const fetchedRecords: DailyRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const rawDate = String(data.date ?? '');
        fetchedRecords.push({
          id: docSnap.id,
          day: Number(data.day ?? 0),
          date: standardizeDate(rawDate) || rawDate,
          isCompleted: Boolean(data.isCompleted),
          result: data.isCompleted ? 'TRUE' : 'FALSE',
          change: Number(data.change ?? 0),
          skill: String(data.skill ?? 'Power BI'),
          summary: String(data.summary ?? ''),
          notes: data.notes ? String(data.notes) : '',
          responseSubmittedAt: data.responseSubmittedAt ? String(data.responseSubmittedAt) : undefined,
          responseSource: data.responseSource
            ? (String(data.responseSource) as DailyRecord['responseSource'])
            : undefined,
          updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
        });
      });

      // Sort sequentially by Day number
      fetchedRecords.sort((a, b) => a.day - b.day);

      // Deduplicate to guarantee strictly unique day values across all records in the Tasks table
      const seenDays = new Set<number>();
      const dedupedRecords: DailyRecord[] = [];
      for (const rec of fetchedRecords) {
        let safeDay = rec.day;
        if (seenDays.has(safeDay) || safeDay <= 0) {
          safeDay = 1;
          while (seenDays.has(safeDay)) {
            safeDay++;
          }
        }
        seenDays.add(safeDay);
        dedupedRecords.push(safeDay === rec.day ? rec : { ...rec, day: safeDay });
      }

      onUpdate(dedupedRecords);
    },
    (err) => {
      console.error('Firestore real-time subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Seed initial records into Firestore using batch operations
 */
export async function seedInitialData(records: DailyRecord[]): Promise<void> {
  const batch = writeBatch(db);
  for (const r of records) {
    const docRef = doc(db, RECORDS_COLLECTION, r.id);
    batch.set(docRef, {
      id: r.id,
      day: r.day,
      date: r.date,
      isCompleted: r.isCompleted,
      result: r.result,
      change: r.change,
      skill: r.skill || '',
      summary: r.summary || '',
      notes: r.notes || '',
      updatedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
}

/**
 * Add a single record to Firestore with strict duplicate validation
 */
export async function addRecordToCloud(record: DailyRecord): Promise<void> {
  const recordsSnap = await getDocs(collection(db, RECORDS_COLLECTION));
  const existingRecords = recordsSnap.docs.map((d) => d.data());

  const formattedDate = standardizeDate(record.date) || record.date;

  // Prevent duplicate day in Tasks table
  const duplicateDay = existingRecords.find(
    (r) => r.id !== record.id && Number(r.day) === Number(record.day)
  );
  if (duplicateDay) {
    throw new Error(`Duplicate value rejected: Day ${record.day} already exists in Tasks table.`);
  }

  // Prevent duplicate date in Tasks table
  const duplicateDate = existingRecords.find(
    (r) =>
      r.id !== record.id &&
      (standardizeDate(r.date) === formattedDate ||
        String(r.date || '').toLowerCase() === formattedDate.toLowerCase())
  );
  if (duplicateDate) {
    throw new Error(`Duplicate value rejected: A task for date ${formattedDate} already exists in Tasks table.`);
  }

  const docRef = doc(db, RECORDS_COLLECTION, record.id);
  await setDoc(docRef, {
    id: record.id,
    day: record.day,
    date: formattedDate,
    isCompleted: record.isCompleted,
    result: record.result,
    change: record.change,
    skill: record.skill || '',
    summary: record.summary || '',
    notes: record.notes || '',
    ...(record.responseSubmittedAt ? { responseSubmittedAt: record.responseSubmittedAt } : {}),
    ...(record.responseSource ? { responseSource: record.responseSource } : {}),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Update an existing record in Firestore with duplicate prevention
 */
export async function updateRecordInCloud(record: DailyRecord): Promise<void> {
  const recordsSnap = await getDocs(collection(db, RECORDS_COLLECTION));
  const existingRecords = recordsSnap.docs.map((d) => d.data());

  const formattedDate = standardizeDate(record.date) || record.date;

  // Prevent assigning an existing day number of another task
  const duplicateDay = existingRecords.find(
    (r) => r.id !== record.id && Number(r.day) === Number(record.day)
  );
  if (duplicateDay) {
    throw new Error(`Duplicate value rejected: Day ${record.day} is already assigned to another task.`);
  }

  // Prevent assigning an existing date of another task
  const duplicateDate = existingRecords.find(
    (r) =>
      r.id !== record.id &&
      (standardizeDate(r.date) === formattedDate ||
        String(r.date || '').toLowerCase() === formattedDate.toLowerCase())
  );
  if (duplicateDate) {
    throw new Error(`Duplicate value rejected: A task for date ${formattedDate} already exists in Tasks table.`);
  }

  const docRef = doc(db, RECORDS_COLLECTION, record.id);
  await setDoc(
    docRef,
    {
      id: record.id,
      day: record.day,
      date: formattedDate,
      isCompleted: record.isCompleted,
      result: record.result,
      change: record.change,
      skill: record.skill || '',
      summary: record.summary || '',
      notes: record.notes || '',
      ...(record.responseSubmittedAt ? { responseSubmittedAt: record.responseSubmittedAt } : {}),
      ...(record.responseSource ? { responseSource: record.responseSource } : {}),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * Delete a record from Firestore
 */
export async function deleteRecordFromCloud(recordId: string): Promise<void> {
  const docRef = doc(db, RECORDS_COLLECTION, recordId);
  await deleteDoc(docRef);
}

/**
 * Bulk add or import records to Firestore
 */
export async function bulkAddRecordsToCloud(records: DailyRecord[]): Promise<void> {
  const batch = writeBatch(db);
  for (const r of records) {
    const docRef = doc(db, RECORDS_COLLECTION, r.id);
    batch.set(
      docRef,
      {
        id: r.id,
        day: r.day,
        date: r.date,
        isCompleted: r.isCompleted,
        result: r.result,
        change: r.change,
        skill: r.skill || '',
        summary: r.summary || '',
        notes: r.notes || '',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }
  await batch.commit();
}

/**
 * Reset all records in Firestore to the initial template dataset
 */
export async function resetRecordsInCloud(initialRecords: DailyRecord[]): Promise<void> {
  const snapshot = await getDocs(collection(db, RECORDS_COLLECTION));
  const batch = writeBatch(db);
  snapshot.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });
  for (const r of initialRecords) {
    const docRef = doc(db, RECORDS_COLLECTION, r.id);
    batch.set(docRef, {
      id: r.id,
      day: r.day,
      date: r.date,
      isCompleted: r.isCompleted,
      result: r.result,
      change: r.change,
      skill: r.skill || '',
      summary: r.summary || '',
      notes: r.notes || '',
      updatedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
}

/**
 * Subscribe to real-time updates for tasks collection
 */
export function subscribeToTasks(
  onUpdate: (tasks: TaskItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const tasksCol = collection(db, TASKS_COLLECTION);

  return onSnapshot(
    tasksCol,
    async (snapshot) => {
      if (snapshot.empty) {
        onUpdate([]);
        return;
      }

      const fetchedTasks: TaskItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedTasks.push({
          id: docSnap.id,
          taskKey: String(data.taskKey ?? ''),
          taskOfTheDay: String(data.taskOfTheDay ?? ''),
          isCompleted: Boolean(data.isCompleted),
          priority: data.priority ? (data.priority as 'High' | 'Medium' | 'Normal') : 'Normal',
          timeEstimate: data.timeEstimate ? String(data.timeEstimate) : '',
          category: data.category ? String(data.category) : '',
          notes: data.notes ? String(data.notes) : '',
          updatedAt: data.updatedAt ? String(data.updatedAt) : '',
          completedAt: data.completedAt ? String(data.completedAt) : undefined,
          matrixQuadrant: data.matrixQuadrant
            ? (String(data.matrixQuadrant) as TaskItem['matrixQuadrant'])
            : undefined,
        });
      });

      // Sort by taskKey descending so newest/today is first
      fetchedTasks.sort((a, b) => (b.taskKey || '').localeCompare(a.taskKey || ''));
      onUpdate(fetchedTasks);
    },
    (err) => {
      console.error('Firestore tasks real-time subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Seed initial tasks
 */
export async function seedInitialTasks(tasks: TaskItem[]): Promise<void> {
  const batch = writeBatch(db);
  for (const t of tasks) {
    const docRef = doc(db, TASKS_COLLECTION, t.id);
    batch.set(docRef, {
      id: t.id,
      taskKey: t.taskKey,
      taskOfTheDay: t.taskOfTheDay,
      isCompleted: t.isCompleted,
      priority: t.priority || 'Normal',
      timeEstimate: t.timeEstimate || '',
      category: t.category || 'General',
      notes: t.notes || '',
      updatedAt: new Date().toISOString(),
      completedAt: t.completedAt || null,
      matrixQuadrant: t.matrixQuadrant || null,
    });
  }
  await batch.commit();
}

/**
 * Add a new task with duplicate prevention on the same date
 */
export async function addTaskToCloud(task: TaskItem): Promise<void> {
  const tasksSnap = await getDocs(collection(db, TASKS_COLLECTION));
  const existingTasks = tasksSnap.docs.map((d) => d.data());

  const normKey = standardizeDate(task.taskKey) || task.taskKey;

  // Prevent duplicate task ID
  const duplicateId = existingTasks.find((t) => t.id === task.id);
  if (duplicateId) {
    throw new Error(`Duplicate task rejected: A task with ID ${task.id} already exists.`);
  }

  // Prevent duplicate task with identical title on the same date
  const duplicateName = existingTasks.find(
    (t) =>
      t.id !== task.id &&
      (standardizeDate(t.taskKey) === normKey || t.taskKey === task.taskKey) &&
      t.taskOfTheDay &&
      task.taskOfTheDay &&
      String(t.taskOfTheDay).trim().toLowerCase() === String(task.taskOfTheDay).trim().toLowerCase()
  );
  if (duplicateName) {
    throw new Error(`Duplicate task rejected: A task named "${task.taskOfTheDay}" already exists for this date.`);
  }

  const docRef = doc(db, TASKS_COLLECTION, task.id);
  await setDoc(docRef, {
    id: task.id,
    taskKey: task.taskKey,
    taskOfTheDay: task.taskOfTheDay.trim(),
    isCompleted: task.isCompleted,
    priority: task.priority || 'Normal',
    timeEstimate: task.timeEstimate || '',
    category: task.category || 'General',
    notes: task.notes || '',
    updatedAt: new Date().toISOString(),
    completedAt: task.completedAt || null,
    matrixQuadrant: task.matrixQuadrant || null,
  });
}

/**
 * Update an existing task with duplicate prevention
 */
export async function updateTaskInCloud(task: TaskItem): Promise<void> {
  const tasksSnap = await getDocs(collection(db, TASKS_COLLECTION));
  const existingTasks = tasksSnap.docs.map((d) => d.data());

  const normKey = standardizeDate(task.taskKey) || task.taskKey;

  // Prevent duplicate task with identical title on the same date (excluding self)
  const duplicateName = existingTasks.find(
    (t) =>
      t.id !== task.id &&
      (standardizeDate(t.taskKey) === normKey || t.taskKey === task.taskKey) &&
      t.taskOfTheDay &&
      task.taskOfTheDay &&
      String(t.taskOfTheDay).trim().toLowerCase() === String(task.taskOfTheDay).trim().toLowerCase()
  );
  if (duplicateName) {
    throw new Error(`Another task named "${task.taskOfTheDay}" already exists for this date.`);
  }

  const docRef = doc(db, TASKS_COLLECTION, task.id);
  await setDoc(
    docRef,
    {
      id: task.id,
      taskKey: task.taskKey,
      taskOfTheDay: task.taskOfTheDay.trim(),
      isCompleted: task.isCompleted,
      priority: task.priority || 'Normal',
      timeEstimate: task.timeEstimate || '',
      category: task.category || 'General',
      notes: task.notes || '',
      updatedAt: new Date().toISOString(),
      completedAt: task.completedAt || null,
      matrixQuadrant: task.matrixQuadrant || null,
    },
    { merge: true }
  );
}

/**
 * Delete a task
 */
export async function deleteTaskFromCloud(taskId: string): Promise<void> {
  const docRef = doc(db, TASKS_COLLECTION, taskId);
  await deleteDoc(docRef);
}

/**
 * Reset tasks to initial set
 */
export async function resetTasksInCloud(initialTasks: TaskItem[]): Promise<void> {
  const snapshot = await getDocs(collection(db, TASKS_COLLECTION));
  const batch = writeBatch(db);
  snapshot.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });
  for (const t of initialTasks) {
    const docRef = doc(db, TASKS_COLLECTION, t.id);
    batch.set(docRef, {
      id: t.id,
      taskKey: t.taskKey,
      taskOfTheDay: t.taskOfTheDay,
      isCompleted: t.isCompleted,
      priority: t.priority || 'Normal',
      timeEstimate: t.timeEstimate || '',
      category: t.category || 'General',
      notes: t.notes || '',
      updatedAt: new Date().toISOString(),
      completedAt: t.completedAt || null,
      matrixQuadrant: t.matrixQuadrant || null,
    });
  }
  await batch.commit();
}

/**
 * Subscribe to real-time habit updates.
 */
export function subscribeToHabits(
  onUpdate: (habits: HabitItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, HABITS_COLLECTION),
    (snapshot) => {
      const habits: HabitItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        habits.push({
          id: docSnap.id,
          name: String(data.name ?? ''),
          emoji: String(data.emoji ?? '✓'),
          frequency: data.frequency === 'weekdays' ? 'weekdays' : 'daily',
          color: (['blue', 'emerald', 'amber', 'rose', 'violet'].includes(String(data.color))
            ? String(data.color)
            : 'blue') as HabitItem['color'],
          checkIns: Array.isArray(data.checkIns)
            ? data.checkIns.map((value: unknown) => String(value))
            : [],
          createdAt: String(data.createdAt ?? new Date().toISOString()),
          updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
        });
      });
      habits.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      onUpdate(habits);
    },
    (err) => {
      console.error('Firestore habits real-time subscription error:', err);
      if (onError) onError(err);
    }
  );
}

export async function addHabitToCloud(habit: HabitItem): Promise<void> {
  await setDoc(doc(db, HABITS_COLLECTION, habit.id), {
    ...habit,
    checkIns: habit.checkIns || [],
    updatedAt: new Date().toISOString(),
  });
}

export async function updateHabitInCloud(habit: HabitItem): Promise<void> {
  await setDoc(
    doc(db, HABITS_COLLECTION, habit.id),
    {
      ...habit,
      checkIns: habit.checkIns || [],
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function deleteHabitFromCloud(habitId: string): Promise<void> {
  await deleteDoc(doc(db, HABITS_COLLECTION, habitId));
}

/**
 * Synchronize all records and tasks in Firestore (Task of the Day = Summary)
 */
export async function syncAllDataInCloud(
  records: DailyRecord[],
  tasks: TaskItem[]
): Promise<void> {
  const batch = writeBatch(db);

  for (const r of records) {
    const docRef = doc(db, RECORDS_COLLECTION, r.id);
    batch.set(
      docRef,
      {
        id: r.id,
        day: r.day,
        date: r.date,
        isCompleted: r.isCompleted,
        result: r.result,
        change: r.change,
        skill: r.skill,
        summary: r.summary,
        notes: r.notes || '',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  for (const t of tasks) {
    const docRef = doc(db, TASKS_COLLECTION, t.id);
    batch.set(
      docRef,
      {
        id: t.id,
        taskKey: t.taskKey,
        taskOfTheDay: t.taskOfTheDay,
        isCompleted: t.isCompleted,
        priority: t.priority || 'Normal',
        timeEstimate: t.timeEstimate || '',
        category: t.category || 'General',
        notes: t.notes || '',
        updatedAt: new Date().toISOString(),
        completedAt: t.completedAt || null,
        matrixQuadrant: t.matrixQuadrant || null,
      },
      { merge: true }
    );
  }

  await batch.commit();
}

