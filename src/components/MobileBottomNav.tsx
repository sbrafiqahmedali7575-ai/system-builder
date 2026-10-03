import React from 'react';
import { BarChart3, BookOpen, Bot, CalendarDays, Focus, Home } from 'lucide-react';

type MobileSection = 'today' | 'plan' | 'analytics' | 'books';

interface Props {
  onAnalytics: () => void;
  onFocus: () => void;
  onAiChat?: () => void;
  onBooks: () => void;
  onPlan: () => void;
  onTop: () => void;
  activeSection?: MobileSection;
  focusActive?: boolean;
  hideFocus?: boolean;
}

export const MobileBottomNav: React.FC<Props> = ({
  onAnalytics,
  onFocus,
  onAiChat,
  onBooks,
  onPlan,
  onTop,
  activeSection = 'today',
  focusActive = false,
  hideFocus = false,
}) => {
  const actionClass = (active: boolean) =>
    `mobile-nav-action min-w-0 w-full ${active ? 'text-blue-600 dark:text-blue-400' : ''}`;

  return (
    <nav className="today-mobile-nav md:hidden fixed bottom-0 inset-x-0 z-[140] border-t border-slate-200/70 dark:border-slate-800/80 bg-white/88 dark:bg-slate-950/88 backdrop-blur-2xl px-1.5 pb-[max(.65rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-12px_30px_rgba(15,23,42,0.08)]" aria-label="Mobile navigation">
      <div className="w-full min-w-0 max-w-lg mx-auto grid grid-cols-5 items-end gap-0.5 overflow-hidden">
        <button onClick={onTop} className={actionClass(activeSection === 'today' && !focusActive)} aria-current={activeSection === 'today' && !focusActive ? 'page' : undefined}><Home/><span>Today</span></button>
        <button onClick={onPlan} className={actionClass(activeSection === 'plan' && !focusActive)} aria-current={activeSection === 'plan' && !focusActive ? 'page' : undefined}><CalendarDays/><span>Plan</span></button>
        <button
          onClick={onAnalytics}
          className="mx-auto -mt-4 w-12 h-12 min-w-12 min-h-12 aspect-square shrink-0 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-500 to-violet-500 text-white shadow-[0_10px_24px_rgba(79,70,229,0.35)] ring-4 ring-white dark:ring-slate-950 inline-flex items-center justify-center transition-transform active:scale-95"
          aria-label="Open Data Analytics"
          aria-current={activeSection === 'analytics' ? 'page' : undefined}
          title="Data Analytics"
        >
          <BarChart3 className="w-6 h-6"/>
        </button>
        {!hideFocus ? (
          <button onClick={onFocus} className={actionClass(focusActive)} aria-pressed={focusActive}>
            <Focus/><span>Focus</span>
          </button>
        ) : onAiChat ? (
          <button
            onClick={onAiChat}
            className={actionClass(false)}
            aria-label="Open AI Data Analyst chat"
            title="AI Chat"
          >
            <Bot/><span>AI</span>
          </button>
        ) : (
          <div aria-hidden="true" />
        )}
        <button onClick={onBooks} className={actionClass(activeSection === 'books' && !focusActive)} aria-current={activeSection === 'books' && !focusActive ? 'page' : undefined}><BookOpen/><span>Books</span></button>
      </div>
    </nav>
  );
};
