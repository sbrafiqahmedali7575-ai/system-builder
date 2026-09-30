import React, { useEffect } from 'react';
import { CalendarDays, Focus, Plus, Search, Wrench, X } from 'lucide-react';
interface Props{onClose:()=>void;onAdd:()=>void;onSearch:()=>void;onFocus:()=>void;onCalendar:()=>void;onTools:()=>void;}
export const CommandPalette:React.FC<Props>=({onClose,onAdd,onSearch,onFocus,onCalendar,onTools})=>{
 useEffect(()=>{const h=(e:KeyboardEvent)=>e.key==='Escape'&&onClose();const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';window.addEventListener('keydown',h);return()=>{document.body.style.overflow=previousOverflow;window.removeEventListener('keydown',h)}},[onClose]);
 const act=(fn:()=>void)=>()=>{onClose();fn()};
 return <div className="fixed inset-0 z-[210] bg-slate-950/45 px-2 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-[max(.75rem,env(safe-area-inset-top))] sm:p-3 flex items-start justify-center overflow-y-auto overscroll-contain" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
  <div className="mt-[max(.5rem,env(safe-area-inset-top))] sm:mt-[8dvh] w-full max-w-lg max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
   <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center"><strong className="flex-1 text-sm">What do you want to do?</strong><button onClick={onClose} className="h-11 w-11 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close"><X className="w-4 h-4"/></button></div>
   <div className="p-2 grid gap-1">
    <button onClick={act(onAdd)} className="command-item"><Plus/>Add task <kbd>N</kbd></button>
    <button onClick={act(onSearch)} className="command-item"><Search/>Search tasks <kbd>/</kbd></button>
    <button onClick={act(onFocus)} className="command-item"><Focus/>Toggle Focus <kbd>F</kbd></button>
    <button onClick={act(onCalendar)} className="command-item"><CalendarDays/>Open calendar</button>
    <button onClick={act(onTools)} className="command-item"><Wrench/>Open tools</button>
   </div>
  </div>
 </div>
};
