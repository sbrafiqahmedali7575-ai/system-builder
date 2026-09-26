import React, { useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
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
  'relative h-10 min-w-0 px-2 sm:px-3 text-[11px] sm:text-xs font-black inline-flex items-center justify-center gap-1.5 transition-colors select-none whitespace-nowrap overflow-hidden border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40';

const TOOL_TAB_ACTIVE =
  'border-blue-600 text-blue-700 bg-blue-50/50';

const TOOL_TAB_INACTIVE =
  'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300';

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
      className="min-h-screen lg:h-screen bg-white text-slate-900 transition-colors duration-200 flex flex-col"
    >
      <header className="sticky top-0 z-[60] border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-2 sm:px-4 lg:px-5 flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="h-9 w-9 rounded-lg text-slate-500 flex items-center justify-center shrink-0 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          <div
            role="tablist"
            aria-label="System Builder tools"
            className="flex items-center justify-start gap-1 min-w-0 flex-1 overflow-hidden"
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

      <main className="max-w-[1600px] w-full mx-auto px-2 sm:px-4 lg:px-5 py-3 flex-1 min-h-0 lg:overflow-hidden">
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
