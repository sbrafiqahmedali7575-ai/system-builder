import React, { useState } from 'react';
import { ArrowLeft, CalendarDays, Coffee, Grid2X2, Repeat2 } from 'lucide-react';
import { DashboardTheme } from '../types';

type MoreTab = 'eisenhower' | 'habits' | 'calendar';

interface MoreWorkspaceProps {
  theme: DashboardTheme;
  onBack: () => void;
}

const TABS: Array<{
  id: MoreTab;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'eisenhower',
    label: 'Eisenhower Matrix',
    description: 'Prioritize work by urgency and importance.',
    icon: Grid2X2,
  },
  {
    id: 'habits',
    label: 'Habit Tracker',
    description: 'Track recurring habits and consistency.',
    icon: Repeat2,
  },
  {
    id: 'calendar',
    label: 'Calender',
    description: 'View and organize dates, tasks, and planned activity.',
    icon: CalendarDays,
  },
];

export const MoreWorkspace: React.FC<MoreWorkspaceProps> = ({
  theme: _theme,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<MoreTab>('eisenhower');
  const active = TABS.find((tab) => tab.id === activeTab) || TABS[0];
  const ActiveIcon = active.icon;

  return (
    <div className="min-h-screen bg-[#f4ecd8] text-[#3f3426] transition-colors duration-200">
      <header className="sticky top-0 z-[60] border-b border-[#ded0b4] bg-[#f4ecd8]/95 backdrop-blur-xl">
        <div className="max-w-[1500px] mx-auto px-3 sm:px-5 lg:px-7 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="h-9 w-9 rounded-xl border border-black/10 flex items-center justify-center shrink-0 hover:bg-black/5 transition-colors"
              aria-label="Back to dashboard"
              title="Back to dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">•••</span>
                <h1 className="text-lg sm:text-xl font-black tracking-tight truncate">
                  More
                </h1>
              </div>
              <p className="text-[11px] sm:text-xs font-semibold text-[#766653]">
                Planning & consistency tools
              </p>
            </div>
          </div>

          <div
            className="flex items-center rounded-xl border border-[#ded0b4] p-1"
            title="Sepia workspace theme"
            aria-label="Sepia workspace theme"
          >
            <span className="h-8 w-8 rounded-lg flex items-center justify-center bg-amber-700 text-white">
              <Coffee className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        <div className="max-w-[1500px] mx-auto px-3 sm:px-5 lg:px-7 pb-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-max">
            {TABS.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-xl text-xs font-black border transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'border-black/10 hover:bg-black/5'
                }`}
              >
                {index + 1}. {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-[1500px] mx-auto px-3 sm:px-5 lg:px-7 py-5 lg:py-7">
        <main className="min-w-0">
          <article className="rounded-[24px] border border-[#ded0b4] bg-[#fbf4e3] shadow-[0_20px_55px_rgba(15,23,42,0.08)] overflow-hidden">
            <div className="px-5 sm:px-8 lg:px-12 py-8 sm:py-10 border-b border-black/10">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">
                  <ActiveIcon className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] font-black text-blue-600">
                    System Builder Tool
                  </div>
                  <h2 className="mt-1 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.04]">
                    {active.label}
                  </h2>
                  <p className="mt-3 text-sm sm:text-base leading-7 font-semibold text-[#766653]">
                    {active.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 sm:px-8 lg:px-12 py-10 sm:py-14">
              <section className="max-w-[820px] mx-auto">
                <div className="rounded-2xl border border-[#dfd1b6] bg-[#fff8e8] p-6 sm:p-8 text-center">
                  <div className="text-sm font-black text-[#3f3426]">
                    Ready for implementation
                  </div>
                  <p className="mt-2 text-sm leading-7 font-semibold text-[#766653]">
                    The page structure and navigation are ready. Functionality for this tab will be added in the next step.
                  </p>
                </div>
              </section>
            </div>
          </article>
        </main>
      </div>
    </div>
  );
};
