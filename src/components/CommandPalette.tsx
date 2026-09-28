import React, { useEffect } from 'react';
import { CalendarDays, Focus, Plus, Search, Wrench, X } from 'lucide-react';
interface Props{onClose:()=>void;onAdd:()=>void;onSearch:()=>void;onFocus:()=>void;onTools:()=>void;}
export const CommandPalette:React.FC<Props>=({onClose,onAdd,onSearch,onFocus,onTools})=>{
 useEffect(()=>{const h=(e:KeyboardEvent)=>e.key==='Escape'&&onClose();window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)},[onClose]);
 const act=(fn:()=>void)=>()=>{onClose();fn()};
 return <div className="fixed inset-0 z-[210] bg-slate-950/45 p-3 flex items-start justify-center" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
  <div className="mt-[12vh] w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
   <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center"><strong className="flex-1 text-sm">What do you want to do?</strong><button onClick={onClose} aria-label="Close"><X className="w-4 h-4"/></button></div>
   <div className="p-2 grid gap-1">
    <button onClick={act(onAdd)} className="command-item"><Plus/>Add task <kbd>N</kbd></button>
    <button onClick={act(onSearch)} className="command-item"><Search/>Search tasks <kbd>/</kbd></button>
    <button onClick={act(onFocus)} className="command-item"><Focus/>Toggle Focus <kbd>F</kbd></button>
    <button onClick={act(()=>document.getElementById('task-planner-calendar')?.scrollIntoView({behavior:'smooth'}))} className="command-item"><CalendarDays/>Open calendar</button>
    <button onClick={act(onTools)} className="command-item"><Wrench/>Open tools</button>
   </div>
  </div>
 </div>
};
