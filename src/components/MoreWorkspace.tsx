import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Grid2X2,
  ListChecks,
  Repeat2,
  Database,
  Focus,
  Wrench,
  X,
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
  focusMode?: boolean;
  onFocusChange?: (focused: boolean) => void;
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
  focusMode = false,
  onFocusChange,
}) => {
  const [activeTab, setActiveTab] = useState<MoreTab>(initialTab);
  const setFocusMode = (focused: boolean) => onFocusChange?.(focused);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div
      data-tools-density="compact"
      className="min-h-[calc(100vh-3.5rem)] bg-[#f6f8ff] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 flex flex-col"
    >
      {!focusMode && (
        <div className="hidden md:block mx-auto w-full max-w-[1500px] px-4 pt-4 lg:px-6">
          <section className="overflow-hidden rounded-[26px] border border-white/80 bg-gradient-to-br from-white via-blue-50/70 to-indigo-50/70 p-5 shadow-[0_20px_60px_rgba(37,99,235,0.10)] dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/20 dark:to-indigo-950/20">
            <div className="flex items-center justify-between gap-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-2xl bg-blue-600 p-2.5 text-white shadow-lg shadow-blue-500/20">
                  <Wrench className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-black tracking-[-0.03em]">Tools</h1>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Plan, organize, and manage tasks, habits, priorities, and your underlying data.
                  </p>
                </div>
              </div>

              <div className="grid min-w-[500px] grid-cols-4 rounded-2xl bg-slate-100/90 p-1 shadow-inner dark:bg-slate-800/90">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => !tab.disabled && setActiveTab(tab.id)}
                      disabled={tab.disabled}
                      aria-pressed={isActive}
                      className={`flex h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] font-bold transition ${
                        isActive
                          ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      )}

      <header className={`${focusMode ? 'hidden' : 'sticky'} md:hidden top-0 z-[60] border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950`}>
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

          <button
            type="button"
            onClick={() => setFocusMode(true)}
            className="hidden md:inline-flex w-8 h-8 rounded-full items-center justify-center shrink-0 bg-slate-900/10 dark:bg-slate-100/10 text-slate-500/40 dark:text-slate-400/40 opacity-40 hover:opacity-100 hover:bg-slate-900/90 dark:hover:bg-slate-100 hover:text-white dark:hover:text-slate-900 hover:shadow-md hover:scale-105 transition-all duration-200"
            title="Focus on current tool"
            aria-label="Focus on current tool"
          >
            <Focus className="w-4 h-4" />
          </button>

       </div>
      </header>

      {focusMode && (
        <button
          type="button"
          onClick={() => setFocusMode(false)}
          className="hidden md:inline-flex fixed top-3 right-3 z-[80] w-8 h-8 rounded-full bg-slate-900/20 dark:bg-slate-100/15 text-slate-500/30 dark:text-slate-400/30 items-center justify-center opacity-30 hover:opacity-100 hover:bg-slate-900/90 dark:hover:bg-slate-100 hover:text-white dark:hover:text-slate-900 hover:shadow-md hover:scale-105 transition-all duration-200"
          aria-label="Exit Tools Focus Mode"
          title="Exit Focus Mode"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <main className={`mx-auto w-full ${focusMode ? 'max-w-none px-0 py-0' : 'max-w-[1500px] px-0 py-0 md:px-4 md:py-4 lg:px-6'} flex-1 min-h-0`}>
        <section className={`${focusMode ? '' : 'md:overflow-hidden md:rounded-2xl md:border md:border-slate-200/80 md:bg-white/90 md:shadow-sm dark:md:border-slate-800 dark:md:bg-slate-900/80'}`}>
          {activeTab === 'eisenhower' && (
            <div
              id="tools-panel-eisenhower"
              role="tabpanel"
              className="h-full"
              aria-labelledby="tools-tab-eisenhower"
            >
            <EisenhowerMatrix
              focusMode={focusMode}
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
              focusMode={focusMode}
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
              focusMode={focusMode}
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
              <DataWorkspace focusMode={focusMode} />
            </div>
          )}

        </section>
      </main>
    </div>
  );
};
