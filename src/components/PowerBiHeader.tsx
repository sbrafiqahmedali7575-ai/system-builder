import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Database, Focus, Wrench } from 'lucide-react';
import { DashboardTheme } from '../types';
import { LongTermBadge } from '../utils/badgeSystem';

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
  onOpenLibrary?: () => void;
  onOpenTools?: () => void;
  onOpenQuickAdd?: () => void;
  onOpenSearch?: () => void;
  onToggleFocus?: () => void;
  focusMode?: boolean;
  theme?: DashboardTheme;
  onThemeChange?: (theme: DashboardTheme) => void;
  totalRecordsCount?: number;
  currentBadge?: LongTermBadge | null;
  isSyncing?: boolean;
  activeTab?: NavTab;
  onTabChange?: (tab: NavTab) => void;
}

export const PowerBiHeader: React.FC<PowerBiHeaderProps> = ({
  onOpenLibrary,
  onOpenTools,
  onOpenQuickAdd,
  onOpenSearch,
  onToggleFocus,
  focusMode = false,
  totalRecordsCount = 0,
  isSyncing = false,
}) => {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const isToolsPage =
    typeof window !== 'undefined' && window.location.pathname === '/tools';

  const showNextQuote = () => {
    setQuoteIndex((current) => (current + 1) % HEADER_QUOTES.length);
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
      className="system-header hidden md:block w-full bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 select-none sticky top-0 z-40 transition-colors"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 lg:px-5 h-14 w-full">
        {/* Brand Zone */}
        <div className="flex items-center space-x-1.5 min-w-0">
          <a
            href="/"
            className="flex items-center space-x-1.5 text-left rounded-lg p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Open System Builder dashboard"
            title="System Builder"
          >
            <motion.div
              whileHover={{ y: -2, rotate: -2, scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="system-mark w-8 h-8 rounded-lg text-white flex items-center justify-center font-semibold relative overflow-hidden"
            >
              <Database className="relative z-10 w-5 h-5 stroke-[2.4]" aria-hidden="true" />
            </motion.div>
            <div className="hidden sm:block">
              <div className="flex items-center space-x-1">
                <span className="text-sm sm:text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
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
          </a>

        </div>

        {/* Dynamic Quotes */}
        <div className="min-w-0 hidden lg:flex justify-center px-3">
          <motion.button
            type="button"
            onClick={showNextQuote}
            whileTap={{ scale: 0.98 }}
            className="group w-full max-w-xl min-w-0 rounded-lg px-2 sm:px-3 py-1 text-center cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-900/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
                className="text-[11px] lg:text-xs font-semibold text-slate-500 dark:text-slate-400 leading-snug line-clamp-1 tracking-normal"
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
          {onToggleFocus && (
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={onToggleFocus}
              aria-pressed={focusMode}
              className={`flex items-center space-x-1 px-1.5 py-1 text-xs font-semibold rounded-xl border transition-colors shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 ${focusMode ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'}`}
              title={focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
              aria-label={focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
            >
              <Focus className="w-3.5 h-3.5" />
              <span>{focusMode ? 'Exit Focus' : 'Focus'}</span>
            </motion.button>
          )}

          {onOpenLibrary && (
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={onOpenLibrary}
              className="flex items-center space-x-1 px-1.5 py-1 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Open Cal Newport reading library"
              aria-label="Open Cal Newport reading library"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Books</span>
            </motion.button>
          )}

          {onOpenTools && (
            <motion.button
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onOpenTools}
              aria-current={isToolsPage ? 'page' : undefined}
              className={`group flex items-center space-x-1.5 px-2 py-1 text-xs font-bold rounded-xl border transition-all shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                isToolsPage
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm ring-1 ring-blue-300 dark:ring-blue-700'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 dark:hover:text-blue-300 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm'
              }`}
              title={isToolsPage ? 'Tools — current page' : 'Open System Builder tools'}
              aria-label={isToolsPage ? 'Tools, current page' : 'Open System Builder tools'}
            >
              <Wrench
                className={`w-3.5 h-3.5 transition-transform group-hover:rotate-[-10deg] ${
                  isToolsPage ? 'text-white' : 'text-blue-600 dark:text-blue-400'
                }`}
              />
              <span>Tools</span>
              {isToolsPage && (
                <span className="w-1.5 h-1.5 rounded-full bg-white/90" aria-hidden="true" />
              )}
            </motion.button>
          )}
        </div>

        {/* Mobile Header Right Controls */}
        <div className="flex md:hidden items-center space-x-1">
          {onOpenLibrary && (
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={onOpenLibrary}
              className="hidden sm:inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 transition cursor-pointer"
              title="Open Cal Newport books"
              aria-label="Open Cal Newport books"
            >
              <BookOpen className="w-4 h-4" />
            </motion.button>
          )}

          {onOpenTools && (
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onOpenTools}
              aria-current={isToolsPage ? 'page' : undefined}
              className={`group relative p-1.5 rounded-xl border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                isToolsPage
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm ring-1 ring-blue-300'
                  : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-700 dark:hover:text-blue-300'
              }`}
              title={isToolsPage ? 'Tools — current page' : 'Open System Builder tools'}
              aria-label={isToolsPage ? 'Tools, current page' : 'Open System Builder tools'}
            >
              <Wrench className="w-4 h-4 transition-transform group-hover:rotate-[-10deg]" />
              {isToolsPage && (
                <span
                  className="absolute -right-0.5 -top-0.5 w-2 h-2 rounded-full bg-white border border-blue-600"
                  aria-hidden="true"
                />
              )}
            </motion.button>
          )}
        </div>
      </div>
    </motion.header>
  );
};
