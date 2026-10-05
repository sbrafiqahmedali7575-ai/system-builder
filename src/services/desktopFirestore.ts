// Firestore-shaped local adapter: existing domain calculations remain unchanged.
export type DocumentData = Record<string, any>;
export type DocumentReference<T = DocumentData> = {path:string;kind:'document';id:string};
export type Unsubscribe = () => void;
export type QuerySnapshot<T = DocumentData> = any;
export type WriteBatch = ReturnType<typeof writeBatch>;
declare global { interface Window { systemBuilderDesktop: {
  read:()=>Promise<any>; commit:(ops:any[],revision?:number)=>Promise<any>;
  backup?:()=>Promise<any>; exportLocal?:()=>Promise<boolean>; onChange:(callback:()=>void)=>()=>void;
}; } }
export const getFirestore = (..._args:any[]) => ({});
export const collection = (_db:any,name:string) => ({path:name,kind:'collection'});
export const doc = (_db:any,name:string,id:string):DocumentReference => ({path:`${name}/${id}`,kind:'document',id});
export const deleteField = () => '__system_builder_delete_field__';
function documentSnapshot(ref:DocumentReference,state:any) {
  const [name,id]=ref.path.split('/'); const value=state.collections[name]?.[id];
  return {id,ref,exists:()=>value!==undefined,data:()=>structuredClone(value)};
}
function snapshot(ref:any,state:any):any {
  if(ref.kind==='document')return documentSnapshot(ref,state);
  const docs=Object.keys(state.collections[ref.path]||{}).map(id=>documentSnapshot(doc(null,ref.path,id),state));
  return {docs,size:docs.length,empty:docs.length===0,forEach:(fn:any)=>docs.forEach(fn)};
}
export const getDoc=async(ref:DocumentReference)=>snapshot(ref,await window.systemBuilderDesktop.read());
export const getDocFromServer=getDoc;
export const getDocs=async(ref:any)=>snapshot(ref,await window.systemBuilderDesktop.read());
export function onSnapshot(ref:any,onValue:(value:any)=>void,onError?:(error:Error)=>void):Unsubscribe {
  let stopped=false,request=0,last='';
  const refresh=async()=>{const token=++request;try{const state=await window.systemBuilderDesktop.read();if(stopped||token!==request)return;const value=ref.kind==='document'?state.collections[ref.path.split('/')[0]]?.[ref.id]:state.collections[ref.path];const key=JSON.stringify(value);if(key===last)return;last=key;onValue(snapshot(ref,state));}catch(error){if(!stopped)onError?.(error as Error);}};
  const unsubscribe=window.systemBuilderDesktop.onChange(()=>void refresh());void refresh();
  return()=>{stopped=true;unsubscribe();};
}
export const setDoc=async(ref:DocumentReference,data:any,options?:{merge?:boolean})=>{await window.systemBuilderDesktop.commit([{type:'set',path:ref.path,data,merge:options?.merge}]);};
export const deleteDoc=async(ref:DocumentReference)=>{await window.systemBuilderDesktop.commit([{type:'delete',path:ref.path}]);};
export function writeBatch(_db:any) {
  const operations:any[]=[];
  const batch={set:(ref:DocumentReference,data:any,options?:{merge?:boolean})=>{operations.push({type:'set',path:ref.path,data,merge:options?.merge});return batch;},delete:(ref:DocumentReference)=>{operations.push({type:'delete',path:ref.path});return batch;},commit:async()=>{await window.systemBuilderDesktop.commit(operations);}};
  return batch;
}
export async function runTransaction<T>(_db:any,fn:(transaction:any)=>Promise<T>):Promise<T> {
  for(let attempt=0;attempt<50;attempt++){
    const state=await window.systemBuilderDesktop.read(); const ops:any[]=[];
    const result=await fn({get:async(ref:DocumentReference)=>snapshot(ref,state),set:(ref:DocumentReference,data:any,options?:any)=>ops.push({type:'set',path:ref.path,data,merge:options?.merge}),delete:(ref:DocumentReference)=>ops.push({type:'delete',path:ref.path})});
    const outcome=await window.systemBuilderDesktop.commit(ops,state.revision);if(!outcome.conflict)return result;
  }
  throw Error('Another change was saved at the same time. Please try again.');
}

