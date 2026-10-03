// Usage: node desktop/import-seed.mjs /path/to/six/exported/xlsx/files
import fs from 'node:fs';import path from 'node:path';import XLSX from 'xlsx';
const folder=process.argv[2];if(!folder)throw Error('Provide a folder containing the six System Builder XLSX exports.');
const keys={users:'userId',days:'dateKey',tasks:'taskId',habits:'habitId',habitLogs:'habitLogId',countdowns:'countdownId'};
const seed={schema:1,revision:0,backupRevision:-1,lastBackup:null,source:'User exports imported '+new Date().toISOString(),collections:{},deleted:[]};
for(const [name,key] of Object.entries(keys)){
 const matches=fs.readdirSync(folder).filter(f=>f.startsWith('system-builder-'+name+'-')&&f.endsWith('.xlsx'));
 if(matches.length!==1)throw Error('Expected exactly one export for '+name);
 const workbook=XLSX.readFile(path.join(folder,matches[0]));const rows=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{defval:''});seed.collections[name]={};
 for(const row of rows){const id=String(row[key]||'').trim();if(!id||id.includes('/')||['__proto__','constructor','prototype'].includes(id)||Object.hasOwn(seed.collections[name],id))throw Error('Invalid or duplicate ID in '+name);
 if(name==='habits'&&typeof row.repeatDays==='string')row.repeatDays=JSON.parse(row.repeatDays);
 if(name==='tasks'&&row.taskOrder!==undefined){row.sortOrder=row.taskOrder;delete row.taskOrder;}
 seed.collections[name][id]=row;
 }
}
fs.writeFileSync('desktop/seed.json',JSON.stringify(seed));console.log(Object.fromEntries(Object.entries(seed.collections).map(([name,rows])=>[name,Object.keys(rows).length])));
