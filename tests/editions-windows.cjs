const {_electron}=require('playwright');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
  const version=require('../package.json').version;
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'sb-editions-test-'));
  let app;
  const launch=async(edition)=>{
    const env={...process.env,SYSTEM_BUILDER_TEST_PROFILE:path.join(base,edition),SYSTEM_BUILDER_TEST_HIDE:'1'};delete env.ELECTRON_RUN_AS_NODE;
    app=await _electron.launch({executablePath:path.resolve(`release/System-Builder-${edition}-v${version}/System Builder.exe`),args:[],env,timeout:30000});
    const page=await app.firstWindow();page.setDefaultTimeout(20000);await page.getByRole('button',{name:'Add Task',exact:true}).waitFor();return page;
  };
  const openHabits=async page=>{await page.getByRole('button',{name:'Open Tools',exact:true}).first().click();await page.getByRole('button',{name:'Habit Tracker',exact:true}).click();};
  try {
    let page=await launch('Pure-Desktop');
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    assert.equal(await app.evaluate(({app})=>app.getPath('userData')),path.join(base,'Pure-Desktop'));
    let state=await page.evaluate(()=>window.systemBuilderDesktop.read());
    assert.deepEqual(Object.values(state.collections).map(rows=>Object.keys(rows).length),[0,0,0,0,0,0]);
    assert.equal(await page.getByRole('button',{name:'Open backup',exact:true}).count(),0);
    assert.equal(await page.evaluate(()=>typeof window.systemBuilderDesktop.backup),'undefined');
    assert.equal(await page.evaluate(()=>typeof window.systemBuilderDesktop.exportLocal),'undefined');
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('system-builder:backup')));
    assert.equal(await page.getByRole('dialog',{name:'Backup',exact:true}).count(),0);
    await page.getByRole('button',{name:'Add Task',exact:true}).click();
    await page.getByPlaceholder('e.g., Complete chapter 4 of SQL fundamentals').fill('PURE DESKTOP TEST TASK');
    await page.getByRole('dialog',{name:'Enter tasks'}).getByRole('button',{name:'Add',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('input[placeholder="e.g., Complete chapter 4 of SQL fundamentals"]')?.value==='');
    await page.getByRole('button',{name:'Done',exact:true}).click();
    await openHabits(page);
    for(const name of ['PURE HABIT ONE','PURE HABIT TWO']){
      await page.getByRole('button',{name:/^Add(?: Habit)?$/,exact:true}).click();
      await page.getByPlaceholder('Habit name').fill(name);
      await page.getByRole('button',{name:'Save',exact:true}).click();
      await page.getByRole('button',{name:'Edit '+name,exact:true}).waitFor();
    }
    await page.getByRole('button',{name:'Reorder PURE HABIT TWO',exact:true}).dragTo(page.locator('[data-habit-id]').first());
    await page.waitForFunction(()=>document.querySelector('[data-habit-id]')?.textContent.includes('PURE HABIT TWO'));
    const ordered=await page.locator('[data-habit-id]').evaluateAll(rows=>rows.map(row=>row.dataset.habitId));
    await page.screenshot({path:'release/pure-desktop-test.png'});
    await app.close();app=null;
    page=await launch('Pure-Desktop');
    state=await page.evaluate(()=>window.systemBuilderDesktop.read());
    assert.ok(Object.values(state.collections.tasks).some(task=>task.title==='PURE DESKTOP TEST TASK'));
    assert.equal(Object.keys(state.collections.habits).length,2);
    await openHabits(page);
    assert.deepEqual(await page.locator('[data-habit-id]').evaluateAll(rows=>rows.map(row=>row.dataset.habitId)),ordered);
    assert.equal(await page.getByRole('button',{name:'Open backup',exact:true}).count(),0);
    await app.close();app=null;
    page=await launch('Up-To-Date');
    state=await page.evaluate(()=>window.systemBuilderDesktop.read());
    const seed=JSON.parse(fs.readFileSync('desktop/seed.json','utf8'));
    for(const name of ['users','tasks','habits','countdowns'])assert.deepEqual(state.collections[name],seed.collections[name]);
    for(const name of ['days','habitLogs'])for(const [id,data] of Object.entries(seed.collections[name])){
      if(data.dateKey!==new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}))assert.deepEqual(state.collections[name][id],data);
    }
    const prefs=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)])));
    for(const [key,value] of Object.entries(seed.desktopPreferences||{}))assert.equal(prefs[key],value);
    await page.getByRole('button',{name:'Open backup',exact:true}).first().click();
    await page.getByRole('dialog',{name:'Backup',exact:true}).waitFor();
    await page.getByRole('button',{name:'Back up to Firestore',exact:true}).waitFor();
    await page.getByRole('button',{name:'Close backup',exact:true}).click();
    await openHabits(page);
    assert.equal(await page.locator('[data-habit-id]').count(),Object.keys(seed.collections.habits).length);
    await page.screenshot({path:'release/up-to-date-test.png'});
    assert.deepEqual(errors,[]);
    console.log('PASS: both packaged Windows EXEs launch offline; pure starts empty with no backup API/UI; task creation, habit dragging and restart persistence work; personal data and preferences load in Up-to-Date Edition.');
  } finally {
    if(app)await app.close();
    assert.equal(path.dirname(base),path.resolve(os.tmpdir()));assert.ok(path.basename(base).startsWith('sb-editions-test-'));
    fs.rmSync(base,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});

