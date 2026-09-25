import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { DashboardTheme } from '../types';
import { LongTermBadge } from '../utils/badgeSystem';
import { BadgeIcon } from './BadgeIcon';

export type NavTab = 'ALL' | 'TRENDS' | 'ANALYTICS' | 'TASKS';

const HEADER_QUOTES = [
  'Build rare and valuable skills before chasing passion.',
  'Career capital creates better options, autonomy, and opportunity.',
  'Deliberate practice is where real professional growth happens.',
  'Earn control by becoming valuable enough to deserve it.',
  'A meaningful mission becomes clearer after mastering your craft.',
  'Focus on craftsmanship: make your work difficult to ignore.',
  'Ask what value you can create, not what work owes you.',
] as const;

interface PowerBiHeaderProps {
  onOpenAddModal?: () => void;
  onOpenNotificationModal?: () => void;
  theme?: DashboardTheme;
  onThemeChange?: (theme: DashboardTheme) => void;
  totalRecordsCount?: number;
  currentBadge?: LongTermBadge | null;
  isSyncing?: boolean;
  activeTab?: NavTab;
  onTabChange?: (tab: NavTab) => void;
}

export const PowerBiHeader: React.FC<PowerBiHeaderProps> = ({
  onOpenNotificationModal,
  totalRecordsCount = 0,
  currentBadge = null,
  isSyncing = false,
}) => {
  const [quoteIndex, setQuoteIndex] = useState(0);

  const showNextQuote = () => {
    setQuoteIndex((current) => (current + 1) % HEADER_QUOTES.length);
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
      className="system-header w-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 shadow-xs select-none sticky top-0 z-40 transition-colors"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2 sm:px-3 lg:px-4 h-16 max-w-7xl mx-auto">
        {/* Brand Zone */}
        <div className="flex items-center space-x-1.5 min-w-0">
          <div className="flex items-center space-x-1.5 text-left rounded-lg p-0.5">
            <motion.div
              whileHover={{ y: -2, rotate: -2, scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="system-mark ui-motion-icon w-9 h-9 rounded-xl text-white flex items-center justify-center font-black shadow-md relative overflow-hidden"
            >
              {currentBadge ? (
                <BadgeIcon badge={currentBadge} className="relative z-10 w-5 h-5" />
              ) : (
                <span className="relative z-10 text-base leading-none">S</span>
              )}
            </motion.div>
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

        {/* Dynamic Quotes */}
        <div className="min-w-0 flex justify-center px-1 sm:px-3">
          <motion.button
            type="button"
            onClick={showNextQuote}
            whileTap={{ scale: 0.98 }}
            className="group w-full max-w-2xl min-w-0 rounded-xl px-2 sm:px-4 py-1.5 text-center cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-900/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title="Click for next quote"
            aria-label="Quotes. Click for next quote."
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={quoteIndex}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.18 }}
                className="text-[15px] sm:text-[18px] lg:text-[21px] font-bold text-slate-900 dark:text-slate-100 leading-[1.15] line-clamp-2 tracking-[0.015em] drop-shadow-[0_1px_1px_rgba(15,23,42,0.10)] dark:drop-shadow-[0_1px_1px_rgba(255,255,255,0.06)]"
                style={{
                  fontFamily:
                    '"Segoe Script", "Snell Roundhand", "Apple Chancery", "Lucida Handwriting", "Bradley Hand", cursive',
                }}
              >
                <span className="text-blue-500/80 dark:text-blue-300/80">“</span>
                {HEADER_QUOTES[quoteIndex]}
                <span className="text-blue-500/80 dark:text-blue-300/80">”</span>
              </motion.div>
            </AnimatePresence>
          </motion.button>
        </div>

        {/* Right Desktop Controls */}
        <div className="hidden md:flex items-center space-x-1.5">
          {/* Email Notification Settings Button */}
          {onOpenNotificationModal && (
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={onOpenNotificationModal}
              className="flex items-center space-x-1 px-1.5 py-1 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Configure 09:00 PM IST Daily Email Alerts"
            >
              <Bell className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>9 PM Alerts</span>
            </motion.button>
          )}
        </div>

        {/* Mobile Header Right Controls */}
        <div className="flex md:hidden items-center space-x-1">
          {onOpenNotificationModal && (
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={onOpenNotificationModal}
              className="p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              title="Configure 09:00 PM IST Daily Email Alerts"
              aria-label="Email Alerts"
            >
              <Bell className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </div>
    </motion.header>
  );
};
