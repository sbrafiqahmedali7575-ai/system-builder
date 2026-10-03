import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, BookOpen, Focus, Home, Wrench } from 'lucide-react';
import { SystemBuilderLogo } from './SystemBuilderLogo';

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
  onOpenHome?: () => void;
  onOpenLibrary?: () => void;
  onOpenTools?: () => void;
  onOpenAnalytics?: () => void;
  onToggleFocus?: () => void;
  focusMode?: boolean;
  isSyncing?: boolean;
}


export const PowerBiHeader: React.FC<PowerBiHeaderProps> = ({
  onOpenHome,
  onOpenLibrary,
  onOpenTools,
  onOpenAnalytics,
  onToggleFocus,
  focusMode = false,
  isSyncing = false,
}) => {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const isHomePage =
    typeof window !== 'undefined' && window.location.pathname === '/';
  const isBooksPage =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/books');
  const isToolsPage =
    typeof window !== 'undefined' && window.location.pathname === '/tools';
  const isAnalyticsPage =
    typeof window !== 'undefined' && window.location.pathname === '/analytics';

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
      <div className="flex items-center gap-2 px-3 lg:px-5 h-14 w-full">
        {/* Brand Zone */}
        <div className="flex items-center min-w-0">
          <a
            href="/"
            className="group flex items-center gap-2.5 text-left rounded-xl px-1.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/70"
            aria-label="Open System Builder dashboard"
            title="System Builder"
          >
            <SystemBuilderLogo className="size-9 text-sm" animated />
            <div className="hidden sm:block min-w-0">
              <div className="flex items-center space-x-1">
                <span className="text-[15px] font-bold leading-tight tracking-[-0.015em] text-slate-950 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                  System Builder
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                {isSyncing && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                <span className="tracking-[0.01em]">
                  {isSyncing ? 'Syncing...' : 'Developed by Rafiq Ahmed'}
                </span>
              </div>
            </div>
          </a>

        </div>

        {/* Dynamic Quotes */}
        <div className="min-w-0 hidden lg:flex flex-1 justify-center px-3">
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

        {/* Right Desktop Controls — icon-only, ordered by primary workspace flow */}
        <div className="hidden md:flex items-center gap-1.5 ml-auto shrink-0">
          {onOpenHome && (
            <motion.button
              whileHover={{ y: -2, scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={onOpenHome}
              aria-current={isHomePage ? 'page' : undefined}
              className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                isHomePage
                  ? 'bg-slate-900 border-slate-900 text-white shadow-sm dark:bg-white dark:border-white dark:text-slate-950'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300'
              }`}
              title="Home"
              aria-label={isHomePage ? 'Home, current page' : 'Open Home'}
            >
              <Home className="h-4 w-4" />
            </motion.button>
          )}

          {onOpenAnalytics && (
            <motion.button
              whileHover={{ y: -2, scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={onOpenAnalytics}
              aria-current={isAnalyticsPage ? 'page' : undefined}
              className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                isAnalyticsPage
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-700'
              }`}
              title="Data Analytics"
              aria-label={isAnalyticsPage ? 'Data Analytics, current page' : 'Open Data Analytics'}
            >
              <BarChart3 className="h-4 w-4" />
            </motion.button>
          )}

          {onOpenTools && (
            <motion.button
              whileHover={{ y: -2, scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={onOpenTools}
              aria-current={isToolsPage ? 'page' : undefined}
              className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                isToolsPage
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-300 dark:hover:border-blue-700'
              }`}
              title="Tools"
              aria-label={isToolsPage ? 'Tools, current page' : 'Open Tools'}
            >
              <Wrench className="h-4 w-4" />
            </motion.button>
          )}

          {onOpenLibrary && (
            <motion.button
              whileHover={{ y: -2, scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={onOpenLibrary}
              aria-current={isBooksPage ? 'page' : undefined}
              className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
                isBooksPage
                  ? 'bg-violet-600 border-violet-600 text-white shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40 hover:border-violet-300 dark:hover:border-violet-700'
              }`}
              title="Books"
              aria-label={isBooksPage ? 'Books, current page' : 'Open Books'}
            >
              <BookOpen className="h-4 w-4" />
            </motion.button>
          )}

          {onToggleFocus && (
            <motion.button
              whileHover={{ y: -2, scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={onToggleFocus}
              aria-pressed={focusMode}
              className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                focusMode
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-700'
              }`}
              title={focusMode ? 'Exit Focus Mode' : 'Focus Mode'}
              aria-label={focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
            >
              <Focus className="h-4 w-4" />
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

          {onOpenAnalytics && (
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onOpenAnalytics}
              aria-current={isAnalyticsPage ? 'page' : undefined}
              className={`group relative p-1.5 rounded-xl border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                isAnalyticsPage
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm ring-1 ring-indigo-300'
                  : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-700 dark:hover:text-indigo-300'
              }`}
              title={isAnalyticsPage ? 'Data Analytics — current page' : 'Open Data Analytics'}
              aria-label={isAnalyticsPage ? 'Data Analytics, current page' : 'Open Data Analytics'}
            >
              <BarChart3 className="w-4 h-4" />
              {isAnalyticsPage && <span className="absolute -right-0.5 -top-0.5 w-2 h-2 rounded-full bg-white border border-indigo-600" aria-hidden="true" />}
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
