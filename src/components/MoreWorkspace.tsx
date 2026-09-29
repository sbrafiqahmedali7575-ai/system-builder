import React, { useState } from 'react';
import {
  ArrowLeft,
  Grid2X2,
  ListChecks,
  Repeat2,
  Database,
} from 'lucide-react';
import { DashboardTheme, HabitItem, TaskItem } from '../types';
import { EisenhowerMatrix } from './EisenhowerMatrix';
import { HabitTracker } from './HabitTracker';
import { TaskTracker } from './TaskTracker';
import { DataWorkspace } from './DataWorkspace';

export type MoreTab = 'eisenhower' | 'habits' | 'tasks' | 'data';

interface MoreWorkspaceProps {
  theme: DashboardTheme;
  initialTab?: MoreTab;
  onBack: () => void;
  tasks: TaskItem[];
  habits: HabitItem[];
  onAddTask: (task: Omit<TaskItem, 'id'>) => Promise<void>;
  onUpdateTask: (task: TaskItem) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onToggleTaskStatus: (taskId: string) => Promise<void>;
  onAddHabit: (habit: Omit<HabitItem, 'id'>) => Promise<void>;
  onUpdateHabit: (habit: HabitItem) => Promise<void>;
  onCheckIn: (habit: HabitItem, isCompleted: boolean) => Promise<void>;
  onDeleteHabit: (habitId: string) => Promise<void>;
  isSyncing?: boolean;
}

const TABS: Array<{
  id: MoreTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}> = [
  { id: 'data', label: 'Data', icon: Database },
  { id: 'tasks', label: 'Task Tracker', icon: ListChecks },
  { id: 'eisenhower', label: 'Eisenhower Matrix', icon: Grid2X2 },
  { id: 'habits', label: 'Habit Tracker', icon: Repeat2 },
];

const TOOL_TAB_BASE =
  'relative h-11 sm:h-10 min-w-0 px-2 sm:px-3 text-[11px] sm:text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors select-none whitespace-nowrap overflow-hidden border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40';

const TOOL_TAB_ACTIVE =
  'border-[#4772fa] text-[#4772fa] dark:text-blue-300 bg-transparent';

const TOOL_TAB_INACTIVE =
  'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700';

export const MoreWorkspace: React.FC<MoreWorkspaceProps> = ({
  theme: _theme,
  initialTab = 'data',
  onBack,
  tasks,
  habits,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onToggleTaskStatus,
  onAddHabit,
  onUpdateHabit,
  onCheckIn,
  onDeleteHabit,
  isSyncing = false,
}) => {
  const [activeTab, setActiveTab] = useState<MoreTab>(initialTab);

  return (
    <div
      data-tools-density="compact"
      className="min-h-screen lg:h-screen bg-[#f7f7f7] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 flex flex-col"
    >
      <header className="sticky top-0 z-[60] border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="w-full px-1.5 sm:px-4 lg:px-5 flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={onBack}
            className="h-11 w-11 sm:h-9 sm:w-9 rounded-lg text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          <div
            role="tablist"
            aria-label="System Builder tools"
            className="flex items-center justify-start gap-0.5 sm:gap-1 min-w-0 flex-1 overflow-x-auto scrollbar-none"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isDisabled = Boolean(tab.disabled);
              const shortLabel =
                tab.id === 'eisenhower'
                  ? 'Matrix'
                  : tab.id === 'habits'
                  ? 'Habits'
                  : tab.id === 'tasks'
                  ? 'Tasks'
                  : 'Data';

              return (
                <button
                  key={tab.id}
                  id={`tools-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tools-panel-${tab.id}`}
                  aria-label={tab.label}
                  tabIndex={isActive ? 0 : -1}
                  disabled={isDisabled}
                  onClick={() => {
                    if (!isDisabled) setActiveTab(tab.id);
                  }}
                  className={`${TOOL_TAB_BASE} ${
                    isActive ? TOOL_TAB_ACTIVE : TOOL_TAB_INACTIVE
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? 'text-blue-600' : 'text-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 truncate">
                    <span className="sm:hidden">{shortLabel}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </span>
                </button>
              );
            })}
          </div>


       </div>
      </header>

      <main className="w-full px-0 sm:px-4 lg:px-5 py-0 sm:py-3 flex-1 min-h-0 lg:overflow-hidden">
        <section className="lg:h-full lg:overflow-hidden">
          {activeTab === 'eisenhower' && (
            <div
              id="tools-panel-eisenhower"
              role="tabpanel"
              className="h-full"
              aria-labelledby="tools-tab-eisenhower"
            >
            <EisenhowerMatrix
              tasks={tasks}
              onAddTask={onAddTask}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              onToggleTaskStatus={onToggleTaskStatus}
              isSyncing={isSyncing}
              density="compact"
            />
            </div>
          )}

          {activeTab === 'habits' && (
            <div
              id="tools-panel-habits"
              role="tabpanel"
              className="h-full"
              aria-labelledby="tools-tab-habits"
            >
            <HabitTracker
              habits={habits}
              onAddHabit={onAddHabit}
              onUpdateHabit={onUpdateHabit}
              onCheckIn={onCheckIn}
              onDeleteHabit={onDeleteHabit}
              density="compact"
            />
            </div>
          )}

          {activeTab === 'tasks' && (
            <div
              id="tools-panel-tasks"
              role="tabpanel"
              className="h-full"
              aria-labelledby="tools-tab-tasks"
            >
            <TaskTracker
              tasks={tasks}
              habits={habits}
              onAddTask={onAddTask}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              onToggleTaskStatus={onToggleTaskStatus}
              onUpdateHabit={onUpdateHabit}
              density="compact"
            />
            </div>
          )}

          {activeTab === 'data' && (
            <div
              id="tools-panel-data"
              role="tabpanel"
              className="h-full"
              aria-labelledby="tools-tab-data"
            >
              <DataWorkspace />
            </div>
          )}

        </section>
      </main>
    </div>
  );
};
