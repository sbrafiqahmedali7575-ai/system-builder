import React, { useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Sun,
  Grid2X2,
  Repeat2,
  Wrench,
} from 'lucide-react';
import { DashboardTheme, HabitItem, TaskItem, ToolsDensity } from '../types';
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

const TOOLS_DENSITY_KEY = 'SYSTEM_BUILDER_TOOLS_DENSITY_V1';

const TOOL_TAB_BASE =
  'w-full min-w-0 rounded-lg border font-black inline-flex items-center justify-center transition-all duration-150 select-none whitespace-nowrap overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200';

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
  const [density, setDensity] = useState<ToolsDensity>(() => {
    if (typeof window === 'undefined') return 'compact';
    return localStorage.getItem(TOOLS_DENSITY_KEY) === 'comfortable'
      ? 'comfortable'
      : 'compact';
  });

  const compact = density === 'compact';

  const toggleDensity = () => {
    const next: ToolsDensity = compact ? 'comfortable' : 'compact';
    setDensity(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOOLS_DENSITY_KEY, next);
    }
  };

  return (
    <div
      data-tools-density={density}
      className="min-h-screen lg:h-screen bg-slate-50 text-slate-900 transition-colors duration-200 flex flex-col"
    >
      <header className="sticky top-0 z-[60] border-b border-slate-200 bg-white/95 backdrop-blur-xl shadow-sm">
        <div
          className={`max-w-[1500px] mx-auto px-1.5 sm:px-4 lg:px-5 flex items-center gap-1 sm:gap-2 ${
            compact ? 'py-1.5 sm:py-2' : 'py-2 sm:py-2.5'
          }`}
        >
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
            aria-current="page"
            className="hidden sm:inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-600 px-2 text-white shadow-sm"
            title="Tools — current page"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs font-black">Tools</span>
          </div>

          <div
            role="tablist"
            aria-label="System Builder tools"
            className="grid grid-cols-3 gap-0.5 sm:gap-1.5 min-w-0 flex-1 overflow-hidden"
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
                    compact
                      ? 'h-8 px-1 sm:px-2.5 text-[10px] sm:text-xs gap-0.5 sm:gap-1.5'
                      : 'h-10 px-1.5 sm:px-3 text-[11px] sm:text-sm gap-1 sm:gap-2'
                  } ${isActive ? TOOL_TAB_ACTIVE : TOOL_TAB_INACTIVE}`}
                >
                  <Icon
                    className={`${
                      compact
                        ? 'w-3 h-3 sm:w-3.5 sm:h-3.5'
                        : 'w-3.5 h-3.5 sm:w-4 sm:h-4'
                    } shrink-0 ${
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

          <button
            type="button"
            onClick={toggleDensity}
            className={`shrink-0 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition inline-flex items-center justify-center ${
              compact ? 'h-8 w-8 sm:w-auto sm:px-2' : 'h-10 w-10 sm:w-auto sm:px-2.5'
            }`}
            title={compact ? 'Switch to comfortable density' : 'Switch to compact density'}
            aria-label={compact ? 'Switch to comfortable density' : 'Switch to compact density'}
            aria-pressed={!compact}
          >
            <span className="flex flex-col gap-[2px]" aria-hidden="true">
              <span className={`${compact ? 'w-3' : 'w-4'} h-[1.5px] rounded-full bg-current`} />
              <span className={`${compact ? 'w-3' : 'w-4'} h-[1.5px] rounded-full bg-current`} />
              {!compact && (
                <span className="w-4 h-[1.5px] rounded-full bg-current" />
              )}
            </span>
            <span className="hidden md:inline ml-1.5 text-[10px] font-black">
              {compact ? 'Compact' : 'Comfortable'}
            </span>
          </button>

          <div
            className={`hidden sm:flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 items-center justify-center ${
              compact ? 'h-8 w-8' : 'h-10 w-10'
            }`}
            title={isSyncing ? 'Syncing data…' : 'Light workspace theme'}
            aria-label={isSyncing ? 'Syncing data' : 'Light workspace theme'}
          >
            <Sun className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${
              isSyncing ? 'text-amber-500 animate-pulse' : 'text-blue-600'
            }`} />
          </div>
        </div>
      </header>

      <main
        className={`max-w-[1600px] w-full mx-auto px-2 sm:px-3 lg:px-4 flex-1 min-h-0 lg:overflow-hidden ${
          compact ? 'py-2' : 'py-3'
        }`}
      >
        <section
          className={`rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-full lg:overflow-hidden ${
            compact ? 'p-2.5 sm:p-3 lg:p-3' : 'p-3 sm:p-4 lg:p-5'
          }`}
        >
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
              density={density}
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
              density={density}
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
              density={density}
            />
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
