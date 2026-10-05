import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {downloadArtifact} from '@electron/get';
import extract from 'extract-zip';
import {Data,NtExecutable,NtExecutableResource,Resource} from 'resedit';
import {brandWindowsExecutable,iconPath} from '../desktop/windows-branding.mjs';

const require=createRequire(import.meta.url);
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sb-icon-test-'));
try {
  const icon=Data.IconFile.from(await fs.readFile(iconPath));
  assert.deepEqual(icon.icons.map(item=>item.data.width),[16,24,32,48,64,128,256]);
  const archive=await downloadArtifact({version:require('electron/package.json').version,artifactName:'electron',platform:'win32',arch:'x64'});
  await extract(archive,{dir});
  const exePath=path.join(dir,'electron.exe');
  await brandWindowsExecutable(exePath);
  const resources=NtExecutableResource.from(NtExecutable.from(await fs.readFile(exePath)));
  const groups=Resource.IconGroupEntry.fromEntries(resources.entries);
  assert.equal(groups.length,1);
  const embedded=groups[0].getIconItemsFromEntries(resources.entries);
  assert.equal(embedded.length,icon.icons.length);
  const rebuilt=new Data.IconFile();rebuilt.icons=embedded.map(data=>({data}));
  assert.deepEqual(Buffer.from(rebuilt.generate()),Buffer.from(icon.generate()));
  const info=Resource.VersionInfo.fromEntries(resources.entries)[0];
  const language=info.getAllLanguagesForStringValues()[0];
  const strings=info.getStringValues(language);
  assert.equal(strings.ProductName,'System Builder');
  assert.equal(strings.FileDescription,'System Builder');
  assert.equal(strings.OriginalFilename,'System Builder.exe');
  console.log('PASS: real Windows Electron EXE contains System Builder artwork at all seven icon sizes and correct product metadata.');
} finally {
  assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));
  assert.ok(path.basename(dir).startsWith('sb-icon-test-'));
  await fs.rm(dir,{recursive:true,force:true});
}

