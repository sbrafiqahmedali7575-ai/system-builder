import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function walk(directory) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];

  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(relative) : [relative];
  });
}

const firestoreRules = read('firestore.rules');
if (!/match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/.test(firestoreRules)) {
  failures.push('firestore.rules must deny all direct client reads and writes.');
}

const packageJson = JSON.parse(read('package.json'));
if (packageJson.dependencies?.firebase || packageJson.devDependencies?.firebase) {
  failures.push('The Firebase browser SDK must not be a direct dependency.');
}

if (
  String(packageJson.scripts?.build || '').includes('outfile=dist/server') ||
  String(packageJson.scripts?.start || '').includes('dist/server')
) {
  failures.push('The backend bundle must never be written inside the public dist directory.');
}

const clientFiles = walk('src').filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));
for (const file of clientFiles) {
  const source = read(file);

  if (
    /from\s+['"]firebase(?:\/|['"])/.test(source) ||
    /firebase-applet-config\.json/.test(source)
  ) {
    failures.push(`${file} directly imports Firebase client configuration or SDK code.`);
  }
}

for (const file of ['server.ts', 'server/emailService.ts']) {
  const source = read(file);
  if (/rejectUnauthorized\s*:\s*false/.test(source)) {
    failures.push(`${file} disables TLS certificate verification.`);
  }
}

const serverSource = read('server.ts');
if (!serverSource.includes('verifyPrivilegedFirestoreAccess')) {
  failures.push('Server startup must verify privileged IAM Firestore access.');
}

for (const route of [
  '/api/data/records',
  '/api/data/tasks',
  '/api/data/habits',
  '/api/data/countdown',
]) {
  if (!serverSource.includes(route)) {
    failures.push(`Missing owner-authenticated data route: ${route}`);
  }
}

if (failures.length > 0) {
  console.error('Security regression check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Security regression check passed.');
