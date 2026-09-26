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
}> = [
  { id: 'eisenhower', label: 'Eisenhower Matrix', icon: Grid2X2 },
  { id: 'habits', label: 'Habit Tracker', icon: Repeat2 },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
];

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
          <div className="flex items-center gap-1.5 min-w-max">
            {TABS.map((tab, index) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-black border transition-all inline-flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {index + 1}. {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-3 sm:px-5 lg:px-7 py-5 lg:py-7">
        <section className="rounded-[24px] border border-slate-200 bg-white shadow-[0_20px_55px_rgba(15,23,42,0.07)] p-4 sm:p-6 lg:p-7">
          {activeTab === 'eisenhower' && (
            <EisenhowerMatrix
              tasks={tasks}
              onAddTask={onAddTask}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              onToggleTaskStatus={onToggleTaskStatus}
              isSyncing={isSyncing}
            />
          )}

          {activeTab === 'habits' && (
            <HabitTracker
              habits={habits}
              onAddHabit={onAddHabit}
              onUpdateHabit={onUpdateHabit}
              onDeleteHabit={onDeleteHabit}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarWorkspace
              tasks={tasks}
              habits={habits}
              onAddTask={onAddTask}
              onUpdateTask={onUpdateTask}
              onToggleTaskStatus={onToggleTaskStatus}
              onUpdateHabit={onUpdateHabit}
            />
          )}
        </section>
      </main>
    </div>
  );
};
