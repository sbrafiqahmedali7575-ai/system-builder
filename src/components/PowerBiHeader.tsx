import React from 'react';
import { Bell } from 'lucide-react';
import { DashboardTheme } from '../types';

export type NavTab = 'ALL' | 'TRENDS' | 'ANALYTICS' | 'TASKS';

interface PowerBiHeaderProps {
  onOpenAddModal?: () => void;
  onOpenNotificationModal?: () => void;
  theme?: DashboardTheme;
  onThemeChange?: (theme: DashboardTheme) => void;
  totalRecordsCount?: number;
  isSyncing?: boolean;
  activeTab?: NavTab;
  onTabChange?: (tab: NavTab) => void;
}

export const PowerBiHeader: React.FC<PowerBiHeaderProps> = ({
  onOpenNotificationModal,
  totalRecordsCount = 0,
  isSyncing = false,
}) => {
  return (
    <header className="ninja-header w-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 shadow-xs select-none sticky top-0 z-40 transition-colors">
      <div className="flex items-center justify-between px-2 sm:px-3 lg:px-4 h-16 max-w-7xl mx-auto">
        {/* Brand Zone */}
        <div className="flex items-center space-x-1.5">
          <div className="flex items-center space-x-1.5 text-left rounded-lg p-0.5">
            <div className="ninja-mark w-9 h-9 rounded-xl text-white flex items-center justify-center font-black shadow-md relative overflow-hidden">
              <span className="relative z-10 text-lg leading-none">忍</span>
            </div>
            <div>
              <div className="flex items-center space-x-1">
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                  System Builder
                </span>
              </div>
              <div className="flex items-center space-x-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSyncing ? 'bg-amber-400 animate-pulse' : 'bg-blue-500'
                  }`}
                />
                <span className="font-mono text-[10px]">
                  {isSyncing ? 'Syncing...' : `${totalRecordsCount} days logged`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Desktop Controls */}
        <div className="hidden md:flex items-center space-x-1.5">
          {/* Email Notification Settings Button */}
          {onOpenNotificationModal && (
            <button
              onClick={onOpenNotificationModal}
              className="flex items-center space-x-1 px-1.5 py-1 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Configure 09:00 PM IST Daily Email Alerts"
            >
              <Bell className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>9 PM Alerts</span>
            </button>
          )}
        </div>

        {/* Mobile Header Right Controls */}
        <div className="flex md:hidden items-center space-x-1">
          {onOpenNotificationModal && (
            <button
              onClick={onOpenNotificationModal}
              className="p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              title="Configure 09:00 PM IST Daily Email Alerts"
              aria-label="Email Alerts"
            >
              <Bell className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
