import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {downloadArtifact} from '@electron/get';
import extract from 'extract-zip';
const require=createRequire(import.meta.url);
const {validateState}=require('./store.cjs');
const profile=path.join(process.env.APPDATA,'System Builder Desktop');
const copy=path.resolve('desktop/capture-profile');
const runtime=path.resolve('desktop/build-runtime');
await fs.mkdir(copy,{recursive:true});
await fs.cp(path.join(profile,'Local Storage'),path.join(copy,'Local Storage'),{recursive:true,filter:source=>path.basename(source)!=='LOCK'});
const executable=path.join(runtime,'electron.exe');
try{await fs.access(executable);}catch{
  await fs.mkdir(runtime,{recursive:true});
  const archive=await downloadArtifact({version:require('electron/package.json').version,artifactName:'electron',platform:'win32',arch:'x64'});
  await extract(archive,{dir:runtime});
}
await new Promise((resolve,reject)=>{
  const capture=spawn(executable,[path.resolve('desktop/capture-preferences.cjs')],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';capture.stdout.on('data',data=>{output+=data;});capture.stderr.on('data',data=>{output+=data;});
  capture.on('error',reject);capture.on('exit',code=>code===0?resolve():reject(Error('Preference capture failed: '+output)));
});
const desktopPreferences=JSON.parse(await fs.readFile('desktop/capture-result.json','utf8'));
const seed=validateState(JSON.parse(await fs.readFile(path.join(profile,'system-builder.json'),'utf8')));
seed.capturedAt=new Date().toISOString();seed.source='Installed desktop app snapshot';seed.desktopPreferences=desktopPreferences;
await fs.writeFile('desktop/seed.json',JSON.stringify(seed));
console.log(JSON.stringify({capturedAt:seed.capturedAt,revision:seed.revision,preferenceKeys:Object.keys(desktopPreferences).length,counts:Object.fromEntries(Object.entries(seed.collections).map(([name,rows])=>[name,Object.keys(rows).length]))}));

