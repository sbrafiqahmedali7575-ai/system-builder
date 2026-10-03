const fs = require('node:fs');
const path = require('node:path');
const COLLECTIONS = ['users', 'days', 'tasks', 'habits', 'habitLogs', 'countdowns'];
const DELETE = '__system_builder_delete_field__';
function validateState(value) {
  if (value?.schema !== 1 || !Number.isSafeInteger(value.revision) || !value.collections || !Array.isArray(value.deleted)) throw Error('Invalid desktop database.');
  for (const name of COLLECTIONS) if (!value.collections[name] || typeof value.collections[name] !== 'object' || Array.isArray(value.collections[name])) throw Error('Missing collection: ' + name);
  return value;
}
class Store {
  constructor(directory, seed) {
    fs.mkdirSync(directory, {recursive:true});
    this.file = path.join(directory, 'system-builder.json');
    if (fs.existsSync(this.file)) {
      // Never silently reset user data when the database is damaged.
      this.state = validateState(JSON.parse(fs.readFileSync(this.file,'utf8')));
    } else { this.state = validateState(structuredClone(seed)); this.persist(this.state); }
  }
  snapshot() { return structuredClone(this.state); }
  persist(next) {
    const temporary = this.file + '.tmp';
    const fd = fs.openSync(temporary, 'w', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(next)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    if (fs.existsSync(this.file)) fs.copyFileSync(this.file, this.file + '.previous');
    fs.renameSync(temporary, this.file);
  }
  commit(operations, expectedRevision) {
    if (expectedRevision !== undefined && expectedRevision !== this.state.revision) return {conflict:true};
    if (!Array.isArray(operations) || operations.length > 10000) throw Error('Invalid write batch.');
    const next = this.snapshot();
    for (const op of operations) {
      const [name,id,...extra] = String(op.path).split('/');
      if (!COLLECTIONS.includes(name) || !id || extra.length || ['__proto__','constructor','prototype'].includes(id)) throw Error('Invalid document path.');
      if (op.type === 'delete') { delete next.collections[name][id]; if (!next.deleted.includes(op.path)) next.deleted.push(op.path); }
      else if (op.type === 'set') {
        if (!op.data || typeof op.data !== 'object' || Array.isArray(op.data)) throw Error('Invalid document data.');
        const data = op.merge ? {...next.collections[name][id]} : {};
        for (const [key,value] of Object.entries(op.data)) {
          if (['__proto__','constructor','prototype'].includes(key)) throw Error('Invalid field.');
          if (value === DELETE) delete data[key]; else if (value !== undefined) data[key] = value;
        }
        next.collections[name][id] = data;
        next.deleted = next.deleted.filter(p => p !== op.path);
      } else throw Error('Invalid write operation.');
    }
    if (JSON.stringify(next) === JSON.stringify(this.state)) return {revision:this.state.revision,changed:false};
    next.revision++; this.persist(next); this.state = next;
    return {revision:next.revision,changed:true};
  }
  finishBackup(revision, time) {
    const next = this.snapshot(); next.lastBackup = time; next.backupRevision = revision;
    // Keep tombstones: a retry is idempotent, including partially failed backups.
    this.persist(next); this.state = next;
  }
}
module.exports = { Store, COLLECTIONS, DELETE, validateState };
