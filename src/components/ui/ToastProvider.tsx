import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
type Toast={id:number;message:string};
const C=createContext<{notify:(message:string)=>void}>({notify:()=>{}});
export const useToast=()=>useContext(C);
export const ToastProvider:React.FC<React.PropsWithChildren>=({children})=>{
 const [items,setItems]=useState<Toast[]>([]);
 const notify=useCallback((message:string)=>{const id=Date.now();setItems(v=>[...v,{id,message}]);window.setTimeout(()=>setItems(v=>v.filter(x=>x.id!==id)),2800)},[]);
 const value=useMemo(()=>({notify}),[notify]);
 return <C.Provider value={value}>{children}<div className="fixed bottom-20 md:bottom-4 right-3 z-[220] space-y-2" aria-live="polite">{items.map(t=><div key={t.id} className="min-w-56 max-w-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl px-3 py-2 flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100"><CheckCircle2 className="w-4 h-4 text-emerald-500"/><span className="flex-1">{t.message}</span><button onClick={()=>setItems(v=>v.filter(x=>x.id!==t.id))} aria-label="Dismiss notification"><X className="w-4 h-4"/></button></div>)}</div></C.Provider>
};
