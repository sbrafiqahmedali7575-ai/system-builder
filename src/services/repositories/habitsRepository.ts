import type { HabitItem } from '../../types';
import {
  subscribeToHabits,
  addHabitToCloud,
  updateHabitInCloud,
  deleteHabitFromCloud,
  setTodayHabitCheckIn,
  ensureHabitLogsForDate,
} from '../firebaseService';

export const habitsRepository = {
  subscribe: subscribeToHabits,
  add: addHabitToCloud,
  update: updateHabitInCloud,
  remove: deleteHabitFromCloud,
  setTodayCheckIn: setTodayHabitCheckIn,
  ensureLogsForDate: ensureHabitLogsForDate,
} as const;

export type HabitsRepository = {
  subscribe: typeof subscribeToHabits;
  add: (habit: HabitItem) => Promise<void>;
  update: (habit: HabitItem) => Promise<void>;
  remove: (habitId: string) => Promise<void>;
  setTodayCheckIn: (habit: HabitItem, completed: boolean) => Promise<void>;
  ensureLogsForDate: (dateKey: string) => Promise<void>;
};
