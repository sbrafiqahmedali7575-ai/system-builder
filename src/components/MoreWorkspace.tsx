import React, { useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Sun,
  Grid2X2,
  Repeat2,
  Wrench,
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
  'h-9 px-3 rounded-xl border text-xs font-black inline-flex items-center gap-1.5 transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200';

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
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200">
      <header className="sticky top-0 z-[60] border-b border-slate-200 bg-white/95 backdrop-blur-xl shadow-sm">
        <div className="max-w-[1500px] mx-auto px-3 sm:px-5 lg:px-7 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center shrink-0 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              aria-label="Back to dashboard"
              title="Back to dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <div
                aria-current="page"
                className="inline-flex items-center gap-2 rounded-xl border border-blue-600 bg-blue-600 px-3 py-1.5 text-white shadow-sm ring-1 ring-blue-300/70"
                title="Tools — current page"
              >
                <Wrench className="w-4 h-4" />
                <h1 className="text-sm sm:text-base font-black tracking-tight">
                  Tools
                </h1>
                <span className="w-1.5 h-1.5 rounded-full bg-white/90" aria-hidden="true" />
              </div>
              <p className="mt-1 text-[11px] sm:text-xs font-semibold text-slate-600">
                Planning & consistency tools
                {isSyncing ? ' • Syncing…' : ''}
              </p>
            </div>
          </div>

          <div
            className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1"
            title="Light workspace theme"
            aria-label="Light workspace theme"
          >
            <span className="h-8 w-8 rounded-lg flex items-center justify-center bg-white text-blue-600 border border-slate-200 shadow-sm">
              <Sun className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        <div className="max-w-[1500px] mx-auto px-3 sm:px-5 lg:px-7 pb-2 overflow-x-auto">
          <div
            role="tablist"
            aria-label="System Builder tools"
            className="flex items-center gap-1.5 min-w-max"
          >
            {TABS.map((tab, index) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isDisabled = Boolean(tab.disabled);

              return (
                <button
                  key={tab.id}
                  id={`tools-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tools-panel-${tab.id}`}
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
                      isActive ? 'text-white' : 'text-blue-600'
                    }`}
                    aria-hidden="true"
                  />
                  <span>{index + 1}. {tab.label}</span>
                  {isActive && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-white/90"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-3 sm:px-5 lg:px-7 py-5 lg:py-7">
        <section className="rounded-[24px] border border-slate-200 bg-white shadow-[0_20px_55px_rgba(15,23,42,0.07)] p-4 sm:p-6 lg:p-7">
          {activeTab === 'eisenhower' && (
            <div
              id="tools-panel-eisenhower"
              role="tabpanel"
              aria-labelledby="tools-tab-eisenhower"
            >
            <EisenhowerMatrix
              tasks={tasks}
              onAddTask={onAddTask}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              onToggleTaskStatus={onToggleTaskStatus}
              isSyncing={isSyncing}
            />
            </div>
          )}

          {activeTab === 'habits' && (
            <div
              id="tools-panel-habits"
              role="tabpanel"
              aria-labelledby="tools-tab-habits"
            >
            <HabitTracker
              habits={habits}
              onAddHabit={onAddHabit}
              onUpdateHabit={onUpdateHabit}
              onDeleteHabit={onDeleteHabit}
            />
            </div>
          )}

          {activeTab === 'calendar' && (
            <div
              id="tools-panel-calendar"
              role="tabpanel"
              aria-labelledby="tools-tab-calendar"
            >
            <CalendarWorkspace
              tasks={tasks}
              habits={habits}
              onAddTask={onAddTask}
              onUpdateTask={onUpdateTask}
              onToggleTaskStatus={onToggleTaskStatus}
              onUpdateHabit={onUpdateHabit}
            />
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
