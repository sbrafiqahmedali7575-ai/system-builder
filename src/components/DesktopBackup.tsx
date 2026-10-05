import React,{useEffect,useState} from 'react';
import {CloudUpload,X,Loader2,Download} from 'lucide-react';
export function DesktopBackup(){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[state,setState]=useState<any>(null);
  useEffect(()=>{const show=()=>setOpen(true);window.addEventListener('system-builder:backup',show);const read=()=>{void window.systemBuilderDesktop.read().then(setState);};read();const off=window.systemBuilderDesktop.onChange(read);return()=>{off();window.removeEventListener('system-builder:backup',show);};},[]);
  const savePreferences=async()=>{
    const current=await window.systemBuilderDesktop.read();const userId=Object.keys(current.collections.users)[0];
    if(!userId)throw new Error('No user profile available for preference backup.');
    const desktopPreferences:Record<string,string>={};
    for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i)!;if(key.startsWith('SYSTEM_BUILDER_CAL_NEWPORT_')||key==='SYSTEM_BUILDER_BOOKS_AUTHOR'||key.startsWith('system-builder:timer-'))desktopPreferences[key]=localStorage.getItem(key)!;}
    await window.systemBuilderDesktop.commit([{type:'set',path:'users/'+userId,data:{desktopPreferences},merge:true}]);
  };
  const backup=async()=>{setBusy(true);setMessage('');try{await savePreferences();const result=await window.systemBuilderDesktop.backup();setMessage(`Backup complete. ${result.records} records uploaded to Firestore.`);}catch(error){setMessage(error instanceof Error?error.message:'Backup failed. Your local data is safe.');}finally{setBusy(false);}};
  if(!open)return null;
  return <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setOpen(false);}}>
    <section role="dialog" aria-modal="true" aria-label="Backup" className="w-full max-w-md rounded-3xl bg-white p-6 text-slate-900 shadow-xl dark:bg-slate-900 dark:text-white">
      <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-bold"><CloudUpload className="h-5 w-5 text-blue-600"/>Backup</h2><button aria-label="Close backup" disabled={busy} onClick={()=>setOpen(false)}><X className="h-5 w-5"/></button></div>
      <p className="mt-4 text-sm text-slate-500">Your desktop data is primary. Every backup sends all six tables, including records from months or years ago. Matching Firestore records are replaced with the desktop copy, including removed fields and deleted records. No expiry or date cutoff. Internet is needed for backup.</p>
      <p className="mt-3 text-xs text-slate-500">Initial data: {state?.capturedAt ? new Date(state.capturedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}) + ' IST desktop snapshot.' : 'Bundled desktop snapshot.'}</p>
      <p className="mt-4 text-sm">Last backup: {state?.lastBackup?new Date(state.lastBackup).toLocaleString():'Not yet'}</p>
      <p className="mt-1 text-xs text-slate-500">{state?.revision===state?.backupRevision?'All current table changes backed up':'Local table changes awaiting backup'}</p>
      <button disabled={busy} onClick={backup} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 p-3 font-semibold text-white disabled:opacity-60">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<CloudUpload className="h-4 w-4"/>}{busy?'Backing up.':'Back up to Firestore'}</button>
      <button disabled={busy} onClick={async()=>{try{await savePreferences();if(await window.systemBuilderDesktop.exportLocal())setMessage('Local backup saved.');}catch(e){setMessage(String(e));}}} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 p-3 text-sm"><Download className="h-4 w-4"/>Save a local backup file</button>
      {message&&<p role="status" className="mt-4 break-words text-sm">{message}</p>}
    </section>
  </div>;
}

