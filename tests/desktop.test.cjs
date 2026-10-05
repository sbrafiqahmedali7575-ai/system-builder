const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {Store,DELETE}=require('../desktop/store.cjs');const {backup,encode}=require('../desktop/backup.cjs');
const seed=require('./synthetic-seed.cjs');
const config={projectId:'test-project',firestoreDatabaseId:'test-database',apiKey:'test'};
function temporary(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sb-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('all six exports, durable edits, deletes, reopen and previous file',t=>{
 const dir=temporary(t),store=new Store(dir,seed);
 assert.deepEqual(Object.values(store.state.collections).map(v=>Object.keys(v).length),[1,64,63,6,24,1]);
 store.commit([{type:'set',path:'tasks/test',data:{title:'Offline',notes:'note',Iscompleted:false}}]);
 store.commit([{type:'set',path:'tasks/test',data:{Iscompleted:true,notes:DELETE},merge:true}]);
 let reopened=new Store(dir,seed);assert.deepEqual(reopened.state.collections.tasks.test,{title:'Offline',Iscompleted:true});assert.ok(fs.existsSync(store.file+'.previous'));
 reopened.commit([{type:'delete',path:'tasks/test'}]);reopened=new Store(dir,seed);assert.equal(reopened.state.collections.tasks.test,undefined);assert.ok(reopened.state.deleted.includes('tasks/test'));
 reopened.commit([{type:'set',path:'tasks/test',data:{title:'Restored'}}]);assert.ok(!reopened.state.deleted.includes('tasks/test'));
});
test('atomic batch, stale transaction and invalid paths do not lose writes',t=>{
 const store=new Store(temporary(t),seed),version=store.state.revision;
 store.commit([{type:'set',path:'tasks/one',data:{title:'One'}}],version);
 assert.deepEqual(store.commit([{type:'delete',path:'tasks/one'}],version),{conflict:true});
 assert.throws(()=>store.commit([{type:'delete',path:'tasks/one'},{type:'set',path:'tasks/__proto__',data:{}}]));assert.ok(store.state.collections.tasks.one);
});
test('disk failure preserves memory and corrupt database is never reset',t=>{
 const dir=temporary(t),store=new Store(dir,seed),before=store.snapshot();store.persist=()=>{throw Error('disk full');};
 assert.throws(()=>store.commit([{type:'delete',path:'tasks/T1'}]));assert.deepEqual(store.snapshot(),before);
 fs.writeFileSync(store.file,'corrupt');assert.throws(()=>new Store(dir,seed));assert.equal(fs.readFileSync(store.file,'utf8'),'corrupt');
});
test('Firestore backup contains six tables, correct types and pending deletion',async t=>{
 const store=new Store(temporary(t),seed);store.commit([{type:'delete',path:'tasks/T1'}]);let calls=0;
 const result=await backup(store.snapshot(),config,async(url,options)=>{
  calls++;assert.match(url,/documents:commit/);const {writes}=JSON.parse(options.body);
  assert.equal(writes.length,159);assert.ok(writes.some(w=>w.delete?.endsWith('/tasks/T1')));assert.equal(writes.filter(w=>w.update).length,158);
  assert.deepEqual(encode([true,2,'hi',null]),{arrayValue:{values:[{booleanValue:true},{integerValue:'2'},{stringValue:'hi'},{nullValue:null}]}});
  return {ok:true,json:async()=>({writeResults:writes.map(()=>({}))})};
 });assert.equal(calls,1);assert.equal(store.state.lastBackup,null);store.finishBackup(result.revision,result.time);assert.equal(store.state.backupRevision,result.revision);
});
test('backup failure cannot mark local data backed up; retries work; edits during backup stay pending',async t=>{
 const store=new Store(temporary(t),seed);await assert.rejects(backup(store.snapshot(),config,async()=>({ok:false,status:403})));assert.equal(store.state.lastBackup,null);
 const snapshot=store.snapshot();const result=await backup(snapshot,config,async(_url,options)=>({ok:true,json:async()=>({writeResults:JSON.parse(options.body).writes.map(()=>({}))})}));
 store.commit([{type:'set',path:'tasks/new',data:{title:'During backup'}}]);store.finishBackup(result.revision,result.time);assert.ok(store.state.revision>store.state.backupRevision);
});
// Model commit semantics to assert resulting cloud data as well as requests.
function cloudRequest(cloud) {
 return async(_url,options)=>{
  const {writes}=JSON.parse(options.body);
  for(const w of writes) {
   const key=(w.delete||w.update.name).split('/documents/')[1];
   if(w.delete)delete cloud[key];
   else cloud[key]=w.updateMask?{...cloud[key],...w.update.fields}:w.update.fields;
  }
  return {ok:true,json:async()=>({writeResults:writes.map(()=>({}))})};
 };
}
test('months/years-old edits, field removals, deletions and recreated records converge after restart',async t=>{
 const dir=temporary(t);let store=new Store(dir,seed);const cloud={};
 store.commit([
  {type:'set',path:'tasks/year-old',data:{date:'2024-10-03',title:'Before',notes:'Remove',updatedAt:'2024-10-03'}},
  {type:'set',path:'tasks/deleted-old',data:{date:'2025-01-01'}},
  {type:'set',path:'tasks/recreated',data:{title:'Original'}}
 ]);
 let result=await backup(store.snapshot(),config,cloudRequest(cloud));store.finishBackup(result.revision,result.time);
 store.commit([
  {type:'set',path:'tasks/year-old',data:{title:'After',notes:DELETE},merge:true},
  {type:'delete',path:'tasks/deleted-old'},
  {type:'delete',path:'tasks/recreated'},
  {type:'set',path:'tasks/recreated',data:{title:'Recreated'}}
 ]);
 store=new Store(dir,seed);
 cloud['tasks/year-old'].cloudOnly=encode('Remove too');
 cloud['tasks/year-old'].updatedAt=encode('2099-01-01');
 cloud['tasks/unrelated']={title:encode('Preserve remote-only record')};
 result=await backup(store.snapshot(),config,cloudRequest(cloud));store.finishBackup(result.revision,result.time);
 assert.deepEqual(cloud['tasks/year-old'],{date:encode('2024-10-03'),title:encode('After'),updatedAt:encode('2024-10-03')});
 assert.equal(cloud['tasks/deleted-old'],undefined);assert.deepEqual(cloud['tasks/recreated'],{title:encode('Recreated')});assert.ok(cloud['tasks/unrelated']);
 store=new Store(dir,seed);cloud['tasks/deleted-old']={title:encode('Stale cloud record')};
 await backup(store.snapshot(),config,cloudRequest(cloud));assert.equal(cloud['tasks/deleted-old'],undefined);
});
test('large histories recover from a partially committed backup without duplicates or lost deletions',async t=>{
 const dir=temporary(t);let store=new Store(dir,seed);const cloud={};
 store.commit(Array.from({length:1100},(_,i)=>({type:'set',path:'tasks/history-'+i,data:{date:'2020-01-01',title:'Old '+i}})));
 store.commit([{type:'delete',path:'tasks/history-1099'}]);
 const oldTime='2025-01-01T00:00:00.000Z';store.finishBackup(0,oldTime);
 let calls=0;
 await assert.rejects(backup(store.snapshot(),config,async(...args)=>{
  if(++calls===2)throw Error('Connection lost');return cloudRequest(cloud)(...args);
 }),/Backup incomplete/);
 assert.equal(store.state.lastBackup,oldTime);assert.equal(store.state.backupRevision,0);
 store=new Store(dir,seed);
 const result=await backup(store.snapshot(),config,cloudRequest(cloud));store.finishBackup(result.revision,result.time);
 assert.equal(Object.keys(cloud).length,159+1099);assert.equal(cloud['tasks/history-1099'],undefined);
 const before=structuredClone(cloud);await backup(store.snapshot(),config,cloudRequest(cloud));assert.deepEqual(cloud,before);
});
test('in-flight edits and deletion recreation are uploaded by the next backup',async t=>{
 const store=new Store(temporary(t),seed),cloud={};
 store.commit([{type:'delete',path:'tasks/recreated-in-flight'}]);
 const result=await backup(store.snapshot(),config,async(...args)=>{
  store.commit([{type:'set',path:'tasks/recreated-in-flight',data:{title:'Keep me'}},{type:'delete',path:'tasks/T1'}]);
  return cloudRequest(cloud)(...args);
 });
 store.finishBackup(result.revision,result.time);assert.ok(store.state.revision>store.state.backupRevision);
 await backup(store.snapshot(),config,cloudRequest(cloud));assert.deepEqual(cloud['tasks/recreated-in-flight'],{title:encode('Keep me')});assert.equal(cloud['tasks/T1'],undefined);
});
test('payload size batching, missing acknowledgements and invalid data are handled before success',async t=>{
 const store=new Store(temporary(t),seed);
 store.commit(Array.from({length:20},(_,i)=>({type:'set',path:'tasks/large-'+i,data:{text:'x'.repeat(250000)}})));
 let calls=0;await backup(store.snapshot(),config,async(_url,options)=>{
  calls++;assert.ok(Buffer.byteLength(options.body)<4*1024*1024);
  return {ok:true,json:async()=>({writeResults:JSON.parse(options.body).writes.map(()=>({}))})};
 });assert.ok(calls>1);
 await assert.rejects(backup(store.snapshot(),config,async()=>({ok:true,json:async()=>({writeResults:[]})})),/did not confirm/);assert.equal(store.state.lastBackup,null);
 const invalid=store.snapshot();invalid.deleted.push('tasks/a/b');calls=0;
 await assert.rejects(backup(invalid,config,async()=>{calls++;}),/Invalid deletion/);assert.equal(calls,0);
});

