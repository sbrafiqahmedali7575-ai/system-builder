import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {downloadArtifact} from '@electron/get';
import extract from 'extract-zip';
import {brandWindowsExecutable} from './windows-branding.mjs';
const require=createRequire(import.meta.url);
const {validateState,COLLECTIONS}=require('./store.cjs');
const pure=process.argv[2]==='pure';
if(process.argv[2]&&!['pure','up-to-date'].includes(process.argv[2]))throw Error('Use up-to-date or pure.');
const appVersion=require('../package.json').version;
const edition=pure?'Pure-Desktop':'Up-To-Date';
const root=path.resolve(`release/System-Builder-${edition}-v${appVersion}`);
try{await fs.access(root);throw Error('Package output already exists. Choose a new version or archive the previous output.');}catch(error){if(error.code!=='ENOENT')throw error;}
const seed=pure?{schema:1,revision:0,backupRevision:-1,lastBackup:null,collections:Object.fromEntries(COLLECTIONS.map(name=>[name,{}])),deleted:[]}:validateState(JSON.parse(await fs.readFile('desktop/seed.json','utf8')));
const dist=path.resolve(pure?'build/pure':'build/up-to-date');
await fs.access(path.join(dist,'index.html'));
const version=require('electron/package.json').version;
await fs.mkdir(root,{recursive:true});
const archive=await downloadArtifact({version,artifactName:'electron',platform:'win32',arch:'x64'});
await extract(archive,{dir:root});
await fs.rename(path.join(root,'electron.exe'),path.join(root,'System Builder.exe'));
await brandWindowsExecutable(path.join(root,'System Builder.exe'));
const target=path.join(root,'resources/app');await fs.mkdir(path.join(target,'desktop'),{recursive:true});
await fs.cp(dist,path.join(target,'dist'),{recursive:true});
for(const file of ['main.cjs','store.cjs','system-builder.ico'])await fs.copyFile('desktop/'+file,path.join(target,'desktop',file));
if(pure){
  const mainFile=path.join(target,'desktop/main.cjs');
  const main=(await fs.readFile(mainFile,'utf8')).replace(/\r\n/g,'\n').replace(/  if\(!edition\.pure\)\{[\s\S]*?\n  }\n/, '').replace(',backingUp=false','');
  if(main.includes("ipcMain.handle('database:backup'")||main.includes("require('./backup.cjs')"))throw Error('Pure edition still contains backup handlers.');
  await fs.writeFile(mainFile,main);
  const storeFile=path.join(target,'desktop/store.cjs');
  const store=(await fs.readFile(storeFile,'utf8')).replace(/\r\n/g,'\n').replace(/\n  finishBackup\([\s\S]*?\n  }\n/, '\n');
  if(store.includes('finishBackup('))throw Error('Pure edition still contains the backup store method.');
  await fs.writeFile(storeFile,store);
}
await fs.copyFile(pure?'desktop/preload-pure.cjs':'desktop/preload.cjs',path.join(target,'desktop/preload.cjs'));
if(!pure){
  await fs.copyFile('desktop/backup.cjs',path.join(target,'desktop/backup.cjs'));
  await fs.copyFile('firebase-applet-config.json',path.join(target,'firebase-applet-config.json'));
}
await fs.writeFile(path.join(target,'desktop/seed.json'),JSON.stringify(seed));
await fs.writeFile(path.join(target,'desktop/edition.json'),JSON.stringify({pure,dataFolder:pure?'System Builder Pure Desktop':'System Builder Desktop'}));
await fs.writeFile(path.join(target,'package.json'),JSON.stringify({name:pure?'system-builder-pure-desktop':'system-builder-desktop',version:appVersion,main:'desktop/main.cjs'}));
const counts=Object.entries(seed.collections).map(([name,rows])=>`${name}: ${Object.keys(rows).length}`).join(', ');
const notes=`SYSTEM BUILDER - ${pure?'PURE DESKTOP EDITION':'UP-TO-DATE EDITION'} - v${appVersion}\r\n\r\nExtract the entire ZIP, then open System Builder.exe. Windows 10/11 x64. No installation, Node.js, or internet is required.\r\n\r\n${pure?'Starts with no personal data. Backup controls and upload functionality are removed. All work is saved locally.':'Includes your installed desktop database captured '+new Date(seed.capturedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})+' IST. '+counts+'. The manual Backup panel is retained.'}\r\n\r\nDrag the grip beside a habit to arrange it. The order saves automatically and survives restarts. The EXE uses the System Builder icon.\r\n\r\nData is stored at %APPDATA%\\${pure?'System Builder Pure Desktop':'System Builder Desktop'}. The editions use separate data folders. Moving or updating the extracted app preserves your data. ${pure?'Your existing desktop data is not loaded into this edition.':'Existing installations reuse their current local data; a new computer starts with the bundled snapshot.'}\r\n\r\nClose the app before copying its data folder to another computer. The app is unsigned.\r\n`;
await fs.writeFile(path.join(root,'READ-ME-FIRST.txt'),notes);
console.log(JSON.stringify({edition,root,counts}));

