// Read a temporary copy of the Chromium profile; never launch against the live profile.
const {app,BrowserWindow,protocol}=require('electron');
const fs=require('node:fs');const path=require('node:path');
protocol.registerSchemesAsPrivileged([{scheme:'app',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
app.setPath('userData',path.resolve(__dirname,'capture-profile'));
app.whenReady().then(async()=>{
  protocol.handle('app',()=>new Response('<!doctype html><title>Snapshot reader</title>'));
  const win=new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  await win.loadURL('app://system-builder/');
  const values=await win.webContents.executeJavaScript(`Object.fromEntries(Object.keys(localStorage).filter(key=>(key.startsWith('SYSTEM_BUILDER_')||key.startsWith('system-builder:'))&&!key.includes('CACHE')).map(key=>[key,localStorage.getItem(key)]))`);
  fs.writeFileSync(path.join(__dirname,'capture-result.json'),JSON.stringify(values));
  console.log('Captured preference keys:',Object.keys(values).length);
  app.quit();
}).catch(error=>{console.error(error);app.exit(1);});

