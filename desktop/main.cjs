const {app,BrowserWindow,ipcMain,protocol,net,dialog}=require('electron');
const fs=require('node:fs'); const path=require('node:path'); const {pathToFileURL}=require('node:url');
const {Store}=require('./store.cjs');
const editionFile=path.join(__dirname,'edition.json');
const edition=fs.existsSync(editionFile)?JSON.parse(fs.readFileSync(editionFile,'utf8')):{pure:false,dataFolder:'System Builder Desktop'};
protocol.registerSchemesAsPrivileged([{scheme:'app',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
app.setName(edition.pure?'System Builder Pure Desktop':'System Builder Desktop');
app.setAppUserModelId(edition.pure?'com.systembuilder.pure.desktop':'com.systembuilder.desktop');
// Stable path survives moving/updating the portable application.
// Automated launch tests use a temporary profile and never touch live user data.
app.setPath('userData',process.env.SYSTEM_BUILDER_TEST_PROFILE||path.join(app.getPath('appData'),edition.dataFolder));
if(!app.requestSingleInstanceLock())app.quit();
else {
let win,store,backingUp=false;
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
app.whenReady().then(()=>{
  try {store=new Store(app.getPath('userData'),JSON.parse(fs.readFileSync(path.join(__dirname,'seed.json'),'utf8')));}
  catch(e){dialog.showErrorBox('Local data could not be opened',e.message+'\nYour files have been preserved in '+app.getPath('userData'));app.quit();return;}
  const dist=path.resolve(__dirname,'../dist');
  protocol.handle('app',request=>{
    const url=new URL(request.url);if(url.host!=='system-builder')return new Response('Forbidden',{status:403});
    const file=path.resolve(dist,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(dist+path.sep))return new Response('Forbidden',{status:403});
    return net.fetch(pathToFileURL(fs.existsSync(file)&&fs.statSync(file).isFile()?file:path.join(dist,'index.html')).href);
  });
  const trusted=event=>{if(event.sender!==win?.webContents||event.senderFrame!==win.webContents.mainFrame||!event.senderFrame.url.startsWith('app://system-builder/'))throw Error('Untrusted request.');};
  ipcMain.handle('database:read',event=>{trusted(event);return store.snapshot();});
  ipcMain.handle('database:commit',(event,ops,revision)=>{trusted(event);const result=store.commit(ops,revision);if(result.changed)win.webContents.send('database:changed');return result;});
  if(!edition.pure){
  const {backup}=require('./backup.cjs');
  ipcMain.handle('database:backup',async event=>{
    trusted(event);if(backingUp)throw Error('Backup is already running.');backingUp=true;
    try {
      const result=await backup(store.snapshot(),require('../firebase-applet-config.json'));
      store.finishBackup(result.revision,result.time);win.webContents.send('database:changed');return result;
    }finally{backingUp=false;}
  });
  ipcMain.handle('database:export',async event=>{trusted(event);const selected=await dialog.showSaveDialog(win,{defaultPath:'System-Builder-Backup.json',filters:[{name:'JSON backup',extensions:['json']}]});if(selected.canceled)return false;fs.writeFileSync(selected.filePath,JSON.stringify(store.snapshot(),null,2),{mode:0o600});return true;});
  }
  win=new BrowserWindow({show:process.env.SYSTEM_BUILDER_TEST_HIDE!=='1',width:1440,height:960,minWidth:800,minHeight:600,title:'System Builder',icon:path.join(__dirname,'system-builder.ico'),autoHideMenuBar:true,backgroundColor:'#f6f8ff',webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
  // The renderer cannot reach cloud services. Only the explicit backup handler can.
  win.webContents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:/^https?:|^wss?:/.test(details.url)}));
  win.webContents.session.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('app://system-builder/'))event.preventDefault();});
  win.loadURL('app://system-builder/');
});
app.on('window-all-closed',()=>app.quit());
}

