const {chromium}=require('playwright');const {backup}=require('../desktop/backup.cjs');const {Store}=require('../desktop/store.cjs');const fs=require('node:fs');const path=require('node:path');const http=require('node:http');const os=require('node:os');const assert=require('node:assert/strict');
(async()=>{
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sb-ui-'));let store=new Store(dir,JSON.parse(fs.readFileSync('desktop/seed.json')));
const server=http.createServer((req,res)=>{let file=path.join(process.cwd(),'dist',new URL(req.url,'http://localhost').pathname);if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.resolve('dist/index.html');const ext=path.extname(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[ext]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(15000);const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))requests.push(r.url());});
await page.exposeFunction('desktopRead',()=>store.snapshot());await page.exposeFunction('desktopCommit',(ops,rev)=>{const r=store.commit(ops,rev);if(r.changed)setImmediate(()=>page.evaluate(()=>window.dispatchEvent(new Event('local-changed'))).catch(()=>{}));return r;});
await page.exposeFunction('desktopBackup',()=>{throw Error('Simulated offline network. Local data is safe.');});
await page.addInitScript(()=>{Object.defineProperty(navigator,'onLine',{get:()=>false});window.systemBuilderDesktop={read:()=>window.desktopRead(),commit:(ops,rev)=>window.desktopCommit(ops,rev),backup:()=>window.desktopBackup(),exportLocal:async()=>true,onChange:fn=>{window.addEventListener('local-changed',fn);return()=>window.removeEventListener('local-changed',fn);}};});
try{
// Offset Date only; keep real timers/performance for startup animations.
await page.addInitScript(()=>{
 const NativeDate=Date,offset=NativeDate.parse(localStorage.getItem('__habitTestDate')||'2026-10-03T06:30:00Z')-NativeDate.now();
 window.Date=class extends NativeDate{constructor(...args){if(args.length)super(...args);else super(NativeDate.now()+offset);}static now(){return NativeDate.now()+offset;}};
});
await page.goto(origin);
await page.getByRole('button',{name:'Open Tools',exact:true}).first().or(page.getByRole('button',{name:'Habit Tracker',exact:true})).first().waitFor();
if(await page.getByRole('button',{name:'Open Tools',exact:true}).first().isVisible()) await page.getByRole('button',{name:'Open Tools',exact:true}).first().click();
await page.getByRole('button',{name:'Habit Tracker',exact:true}).click();
await page.getByText('Wake Up Early 5 AM',{exact:true}).first().waitFor();
// Exercise the real habit UI, then upload through the real backup serializer to
// an isolated in-memory cloud. Never send test data to live Firestore.
const cloud={};
const upload=()=>backup(store.snapshot(),{projectId:'test',apiKey:'test'},async(_url,options)=>{
 const {writes}=JSON.parse(options.body);
 for(const w of writes){const key=(w.delete||w.update.name).split('/documents/')[1];if(w.delete)delete cloud[key];else cloud[key]=w.update.fields;}
 return {ok:true,json:async()=>({writeResults:writes.map(()=>({}))})};
});
await page.getByRole('button',{name:/^Add(?: Habit)?$/,exact:true}).click();
await page.getByPlaceholder('Habit name').fill('DESKTOP HABIT TEST');
assert.equal(await page.getByRole('switch',{name:'Habit active'}).getAttribute('aria-checked'),'true');
await page.getByRole('switch',{name:'Habit active'}).click();
await page.getByRole('button',{name:'Save',exact:true}).click();
await page.getByPlaceholder('Habit name').waitFor({state:'hidden'});
await page.getByRole('button',{name:'Edit DESKTOP HABIT TEST',exact:true}).waitFor();
const habit=Object.values(store.state.collections.habits).find(h=>h.name==='DESKTOP HABIT TEST');assert.ok(habit);
const habitId=habit.habitId;
assert.equal(habit.isActive,false);assert.deepEqual(habit.inactivePeriods,[{from:'2026-10-03',to:null}]);
assert.equal(Object.values(store.state.collections.habitLogs).filter(l=>l.habitId===habitId).length,0);
await upload();assert.equal(cloud['habits/'+habitId].isActive.booleanValue,false);
// Inactive creation remains inactive after a full reload.
await page.reload();
await page.getByRole('button',{name:'Open Tools',exact:true}).first().or(page.getByRole('button',{name:'Habit Tracker',exact:true})).first().waitFor();
if(await page.getByRole('button',{name:'Open Tools',exact:true}).first().isVisible()) await page.getByRole('button',{name:'Open Tools',exact:true}).first().click();
await page.getByRole('button',{name:'Habit Tracker',exact:true}).click();

await page.getByRole('button',{name:'Edit DESKTOP HABIT TEST',exact:true}).click();
await page.getByPlaceholder('Habit name').fill('DESKTOP HABIT UPDATED');
assert.equal(await page.getByRole('switch',{name:'Habit active'}).getAttribute('aria-checked'),'false');
await page.getByRole('switch',{name:'Habit active'}).click();
await page.getByRole('button',{name:'Update',exact:true}).click();
await page.getByPlaceholder('Habit name').waitFor({state:'hidden'});
await page.getByRole('button',{name:'Edit DESKTOP HABIT UPDATED',exact:true}).waitFor();
const today='2026-10-03';
assert.equal(store.state.collections.habits[habitId].isActive,true);
assert.equal(Object.values(store.state.collections.habitLogs).filter(l=>l.habitId===habitId&&l.dateKey===today).length,1);
await page.getByRole('button',{name:'DESKTOP HABIT UPDATED on '+today,exact:true}).click();
await page.getByRole('button',{name:'DESKTOP HABIT UPDATED on '+today,exact:true}).locator('svg').waitFor();
assert.ok(Object.values(store.state.collections.habitLogs).some(l=>l.habitId===habitId&&l.dateKey===today&&l.Iscompleted));
// Pause after completing today: keep history, stop tomorrow, then resume.
const completedLogs=Object.entries(store.state.collections.habitLogs).filter(([,l])=>l.habitId===habitId);
await page.getByRole('button',{name:'Edit DESKTOP HABIT UPDATED',exact:true}).click();
await page.getByRole('switch',{name:'Habit active'}).click();
await page.getByRole('button',{name:'Update',exact:true}).click();
await page.getByPlaceholder('Habit name').waitFor({state:'hidden'});
await page.waitForFunction(async id=>(await window.systemBuilderDesktop.read()).collections.habits[id].isActive===false,habitId);
await page.evaluate(()=>localStorage.setItem('__habitTestDate','2026-10-04T06:30:00Z'));
store=new Store(dir,JSON.parse(fs.readFileSync('desktop/seed.json')));await page.reload();
await page.getByRole('button',{name:'Open Tools',exact:true}).first().or(page.getByRole('button',{name:'Habit Tracker',exact:true})).first().waitFor();
if(await page.getByRole('button',{name:'Open Tools',exact:true}).first().isVisible()) await page.getByRole('button',{name:'Open Tools',exact:true}).first().click();
await page.getByRole('button',{name:'Habit Tracker',exact:true}).click();
await page.getByRole('button',{name:'Edit DESKTOP HABIT UPDATED',exact:true}).waitFor();
assert.deepEqual(Object.entries(store.state.collections.habitLogs).filter(([,l])=>l.habitId===habitId),completedLogs);
await page.getByRole('button',{name:'Edit DESKTOP HABIT UPDATED',exact:true}).click();
await page.getByRole('switch',{name:'Habit active'}).click();
await page.getByRole('button',{name:'Update',exact:true}).click();
await page.getByPlaceholder('Habit name').waitFor({state:'hidden'});
await page.waitForFunction(async id=>Object.values((await window.systemBuilderDesktop.read()).collections.habitLogs).some(l=>l.habitId===id&&l.dateKey==='2026-10-04'),habitId);
assert.equal(Object.values(store.state.collections.habitLogs).filter(l=>l.habitId===habitId&&l.dateKey==='2026-10-04').length,1);
for(const [id,log] of completedLogs)assert.deepEqual(store.state.collections.habitLogs[id],log);
assert.deepEqual(store.state.collections.habits[habitId].inactivePeriods,[{from:'2026-10-03',to:'2026-10-03'}]);
// Old history must be deleted too; it is not restricted to today's logs.
store.commit(['2025-01-01','2026-06-01'].map(date=>({type:'set',path:'habitLogs/'+habitId+'_'+date,data:{habitLogId:habitId+'_'+date,habitId,dateKey:date,Iscompleted:true}})));
await upload();assert.equal(cloud['habits/'+habitId].name.stringValue,'DESKTOP HABIT UPDATED');
const logPaths=Object.entries(store.state.collections.habitLogs).filter(([,v])=>v.habitId===habitId).map(([id])=>'habitLogs/'+id);
assert.ok(logPaths.length>=3);for(const key of logPaths)assert.ok(cloud[key]);
await page.getByRole('button',{name:'Delete DESKTOP HABIT UPDATED',exact:true}).click();
await page.getByRole('button',{name:'Edit DESKTOP HABIT UPDATED',exact:true}).waitFor({state:'hidden'});
await page.waitForFunction(async id=>!(await window.systemBuilderDesktop.read()).collections.habits[id],habitId);
assert.ok(!store.state.collections.habits[habitId]);
for(const key of logPaths){assert.ok(store.state.deleted.includes(key));assert.ok(!store.state.collections.habitLogs[key.split('/')[1]]);}
store=new Store(dir,JSON.parse(fs.readFileSync('desktop/seed.json')));await upload();await upload();
assert.equal(cloud['habits/'+habitId],undefined);for(const key of logPaths)assert.equal(cloud[key],undefined);
assert.equal(Object.keys(store.state.collections.habits).length,6);


assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
console.log('PASS: inactive creation, enable/check-in, pause across restart/day change, resume without duplicates, backup, delete with old logs; no live cloud writes.');
}catch(error){console.log((await page.locator('body').innerText()).slice(0,6000));console.log('Errors:',errors);throw error;}finally{await browser.close();server.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
