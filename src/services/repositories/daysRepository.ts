import type { DailyRecord } from '../../types';
import {
  subscribeToRecords,
  addRecordToCloud,
  updateRecordInCloud,
  deleteRecordFromCloud,
  bulkAddRecordsToCloud,
  resetRecordsInCloud,
  rebuildDaySummary,
  initializeDayHabitStatus,
} from '../firebaseService';

export const daysRepository = {
  subscribe: subscribeToRecords,
  add: addRecordToCloud,
  update: updateRecordInCloud,
  remove: deleteRecordFromCloud,
  bulkAdd: bulkAddRecordsToCloud,
  reset: resetRecordsInCloud,
  rebuildSummary: rebuildDaySummary,
  initializeHabitStatus: initializeDayHabitStatus,
} as const;

export type DaysRepository = {
  subscribe: typeof subscribeToRecords;
  add: (record: DailyRecord) => Promise<void>;
  update: (record: DailyRecord) => Promise<void>;
  remove: (dateKey: string) => Promise<void>;
  bulkAdd: (records: DailyRecord[]) => Promise<void>;
  reset: (records: DailyRecord[]) => Promise<void>;
  rebuildSummary: (dateKey: string) => Promise<void>;
  initializeHabitStatus: (dateKey: string) => Promise<void>;
};
