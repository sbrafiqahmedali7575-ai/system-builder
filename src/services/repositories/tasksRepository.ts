import type { TaskItem } from '../../types';
import {
  subscribeToTasks,
  seedInitialTasks,
  addTaskToCloud,
  updateTaskInCloud,
  deleteTaskFromCloud,
  resetTasksInCloud,
} from '../firebaseService';

export const tasksRepository = {
  subscribe: subscribeToTasks,
  seed: seedInitialTasks,
  add: addTaskToCloud,
  update: updateTaskInCloud,
  remove: deleteTaskFromCloud,
  reset: resetTasksInCloud,
} as const;

export type TasksRepository = {
  subscribe: typeof subscribeToTasks;
  seed: (tasks: TaskItem[]) => Promise<void>;
  add: (task: TaskItem) => Promise<void>;
  update: (task: TaskItem) => Promise<void>;
  remove: (taskId: string) => Promise<void>;
  reset: (tasks: TaskItem[]) => Promise<void>;
};
