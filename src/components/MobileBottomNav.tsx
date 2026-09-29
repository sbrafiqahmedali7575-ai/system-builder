import React from 'react';
import { BookOpen, CalendarDays, Focus, Home, Plus } from 'lucide-react';

type MobileSection = 'today' | 'plan' | 'books';

interface Props {
  onAdd: () => void;
  onFocus: () => void;
  onBooks: () => void;
  onPlan: () => void;
  onTop: () => void;
  activeSection?: MobileSection;
  focusActive?: boolean;
  hideFocus?: boolean;
}

export const MobileBottomNav: React.FC<Props> = ({
  onAdd,
  onFocus,
  onBooks,
  onPlan,
  onTop,
  activeSection = 'today',
  focusActive = false,
  hideFocus = false,
}) => {
  const actionClass = (active: boolean) =>
    `mobile-nav-action ${active ? 'text-blue-600 dark:text-blue-400' : ''}`;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-[140] border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md px-1.5 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-1" aria-label="Mobile navigation">
      <div className="max-w-lg mx-auto grid grid-cols-5 items-end gap-0.5">
        <button onClick={onTop} className={actionClass(activeSection === 'today' && !focusActive)} aria-current={activeSection === 'today' && !focusActive ? 'page' : undefined}><Home/><span>Today</span></button>
        <button onClick={onPlan} className={actionClass(activeSection === 'plan' && !focusActive)} aria-current={activeSection === 'plan' && !focusActive ? 'page' : undefined}><CalendarDays/><span>Plan</span></button>
        <button onClick={onAdd} className="mx-auto -mt-3 w-11 h-11 min-w-11 min-h-11 aspect-square shrink-0 rounded-full bg-[#4772fa] text-white shadow-md inline-flex items-center justify-center" aria-label="Add task"><Plus className="w-6 h-6"/></button>
        {!hideFocus ? <button onClick={onFocus} className={actionClass(focusActive)} aria-pressed={focusActive}><Focus/><span>Focus</span></button> : <div aria-hidden="true" />}
        <button onClick={onBooks} className={actionClass(activeSection === 'books' && !focusActive)} aria-current={activeSection === 'books' && !focusActive ? 'page' : undefined}><BookOpen/><span>Books</span></button>
      </div>
    </nav>
  );
};
