const {COLLECTIONS, validateState} = require('./store.cjs');
function encode(value) {
  if (value === null || value === undefined) return {nullValue:null};
  if (typeof value === 'boolean') return {booleanValue:value};
  if (typeof value === 'number') { if(!Number.isFinite(value)) throw Error('Invalid numeric value.'); return Number.isInteger(value) ? {integerValue:String(value)} : {doubleValue:value}; }
  if (typeof value === 'string') return {stringValue:value};
  if (Array.isArray(value)) return {arrayValue:{values:value.map(encode)}};
  return {mapValue:{fields:Object.fromEntries(Object.entries(value).map(([key,v])=>[key,encode(v)]))}};
}
function documentPath(root, name, id) {
  if (!COLLECTIONS.includes(name) || !id || id.includes('/') || ['.', '..', '__proto__', 'constructor', 'prototype'].includes(id)) throw Error('Invalid backup document path.');
  return `${root}/${name}/${id}`;
}
async function backup(snapshot, config, request=fetch) {
  // Freeze the upload. Date, updatedAt and lastBackup never filter records.
  snapshot=structuredClone(validateState(snapshot));
  const root = `projects/${config.projectId}/databases/${config.firestoreDatabaseId || '(default)'}/documents`;
  const writes=[];
  for (const name of COLLECTIONS) for (const [id,data] of Object.entries(snapshot.collections[name])) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Invalid backup document.');
    const fields = Object.fromEntries(Object.entries(data).map(([k,v])=>[k,encode(v)]));
    // No updateMask or timestamp precondition: desktop is authoritative, even
    // for years-old records. Replacement also propagates removed local fields.
    writes.push({update:{name:documentPath(root,name,id),fields}});
  }
  for (const p of new Set(snapshot.deleted)) {
    const [name,id,...rest]=p.split('/');
    if (rest.length) throw Error('Invalid deletion path.');
    const target=documentPath(root,name,id);
    if (Object.hasOwn(snapshot.collections[name],id)) throw Error('Conflicting backup deletion.');
    writes.push({delete:target});
  }
  // Bound both operation count and serialized size for large offline histories.
  const batches=[];let batch=[],bytes=20;
  for (const write of writes) {
    const size=Buffer.byteLength(JSON.stringify(write),'utf8')+1;
    if (size>4*1024*1024) throw Error('A record is too large to back up. Local data is safe.');
    if (batch.length && (batch.length>=450 || bytes+size>4*1024*1024)) {batches.push(batch);batch=[];bytes=20;}
    batch.push(write);bytes+=size;
  }
  if(batch.length)batches.push(batch);
  for (const writes of batches) {
    try {
      const response = await request(`https://firestore.googleapis.com/v1/${root}:commit?key=${encodeURIComponent(config.apiKey)}`, {
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({writes}),signal:AbortSignal.timeout(45000)
      });
      if (!response.ok) throw Error(`Firestore returned ${response.status}.`);
      const result=await response.json();
      if (!Array.isArray(result.writeResults) || result.writeResults.length!==writes.length) throw Error('Firestore did not confirm every record.');
    } catch (error) {
      throw Error(`Backup incomplete. ${error.message} Local data is safe. Some records may already be uploaded; retry Backup to resend all records and deletions.`,{cause:error});
    }
  }
  return {records:writes.length,revision:snapshot.revision,time:new Date().toISOString()};
}
module.exports={backup,encode};
