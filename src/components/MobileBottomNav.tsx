import React from 'react';
import { BookOpen, CalendarDays, Focus, Home, Plus } from 'lucide-react';
interface Props { onAdd:()=>void; onFocus:()=>void; onBooks:()=>void; onPlan:()=>void; onTop:()=>void; }
export const MobileBottomNav:React.FC<Props>=({onAdd,onFocus,onBooks,onPlan,onTop})=>(
 <nav className="md:hidden fixed bottom-0 inset-x-0 z-[140] border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-1" aria-label="Mobile navigation">
  <div className="max-w-lg mx-auto grid grid-cols-5 items-end">
   <button onClick={onTop} className="mobile-nav-action"><Home/><span>Today</span></button>
   <button onClick={onPlan} className="mobile-nav-action"><CalendarDays/><span>Plan</span></button>
   <button onClick={onAdd} className="mx-auto -mt-4 w-11 h-11 rounded-full bg-[#4772fa] text-white shadow-md inline-flex items-center justify-center" aria-label="Add task"><Plus className="w-6 h-6"/></button>
   <button onClick={onFocus} className="mobile-nav-action"><Focus/><span>Focus</span></button>
   <button onClick={onBooks} className="mobile-nav-action"><BookOpen/><span>Books</span></button>
  </div>
 </nav>
);
