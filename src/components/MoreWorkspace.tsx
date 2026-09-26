import React, { useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Sun,
  Grid2X2,
  Repeat2,
} from 'lucide-react';
import { DashboardTheme, HabitItem, TaskItem } from '../types';
import { CalendarWorkspace } from './CalendarWorkspace';
import { EisenhowerMatrix } from './EisenhowerMatrix';
import { HabitTracker } from './HabitTracker';

type MoreTab = 'eisenhower' | 'habits' | 'calendar';

interface MoreWorkspaceProps {
  theme: DashboardTheme;
  onBack: () => void;
  tasks: TaskItem[];
  habits: HabitItem[];
  onAddTask: (task: Omit<TaskItem, 'id'>) => Promise<void>;
  onUpdateTask: (task: TaskItem) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onToggleTaskStatus: (taskId: string) => Promise<void>;
  onAddHabit: (habit: Omit<HabitItem, 'id'>) => Promise<void>;
  onUpdateHabit: (habit: HabitItem) => Promise<void>;
  onDeleteHabit: (habitId: string) => Promise<void>;
  isSyncing?: boolean;
}

const TABS: Array<{
  id: MoreTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}> = [
  { id: 'eisenhower', label: 'Eisenhower Matrix', icon: Grid2X2 },
  { id: 'habits', label: 'Habit Tracker', icon: Repeat2 },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
];

const TOOL_TAB_BASE =
  'h-8 min-w-0 rounded-lg border px-1.5 sm:px-2.5 text-[10px] sm:text-xs font-black inline-flex items-center justify-center gap-1 sm:gap-1.5 transition-all duration-150 select-none whitespace-nowrap overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200';

const TOOL_TAB_ACTIVE =
  'bg-blue-600 text-white border-blue-600 shadow-sm hover:bg-blue-700 hover:border-blue-700 active:bg-blue-800';

const TOOL_TAB_INACTIVE =
  'bg-white text-slate-700 border-slate-200 shadow-xs hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 hover:shadow-sm active:bg-blue-100';

export const MoreWorkspace: React.FC<MoreWorkspaceProps> = ({
  theme: _theme,
  onBack,
  tasks,
  habits,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onToggleTaskStatus,
  onAddHabit,
  onUpdateHabit,
  onDeleteHabit,
  isSyncing = false,
}) => {
  const [activeTab, setActiveTab] = useState<MoreTab>('eisenhower');

  return (
    <div
      data-tools-density="compact"
      className="min-h-screen lg:h-screen bg-slate-50 text-slate-900 transition-colors duration-200 flex flex-col"
    >
      <header className="sticky top-0 z-[60] border-b border-slate-200 bg-white/95 backdrop-blur-xl shadow-sm">
        <div className="max-w-[1500px] mx-auto px-1.5 sm:px-4 lg:px-5 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={onBack}
            className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 flex items-center justify-center shrink-0 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          <div
            role="tablist"
            aria-label="System Builder tools"
            className="flex items-center justify-start gap-1 sm:gap-1.5 min-w-0 flex-1 overflow-hidden"
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
                  : 'Calendar';

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
                    className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${
                      isActive ? 'text-white' : 'text-blue-600'
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


          <div
            className="hidden sm:flex h-8 w-8 shrink-0 rounded-lg border border-slate-200 bg-slate-50 items-center justify-center"
            title={isSyncing ? 'Syncing data…' : 'Light workspace theme'}
            aria-label={isSyncing ? 'Syncing data' : 'Light workspace theme'}
          >
            <Sun className={`w-3.5 h-3.5 ${
              isSyncing ? 'text-amber-500 animate-pulse' : 'text-blue-600'
            }`} />
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] w-full mx-auto px-2 sm:px-3 lg:px-4 py-2 flex-1 min-h-0 lg:overflow-hidden">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-2.5 sm:p-3 lg:p-3 lg:h-full lg:overflow-hidden">
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
              onDeleteHabit={onDeleteHabit}
              density="compact"
            />
            </div>
          )}

          {activeTab === 'calendar' && (
            <div
              id="tools-panel-calendar"
              role="tabpanel"
              className="h-full"
              aria-labelledby="tools-tab-calendar"
            >
            <CalendarWorkspace
              tasks={tasks}
              habits={habits}
              onAddTask={onAddTask}
              onUpdateTask={onUpdateTask}
              onToggleTaskStatus={onToggleTaskStatus}
              onUpdateHabit={onUpdateHabit}
              density="compact"
            />
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
