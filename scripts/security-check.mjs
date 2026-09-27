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

const firebaseConfig = JSON.parse(read('firebase-applet-config.json'));
const allowedFirebaseConfigKeys = new Set(['projectId', 'firestoreDatabaseId']);
for (const key of Object.keys(firebaseConfig)) {
  if (!allowedFirebaseConfigKeys.has(key)) {
    failures.push(
      `firebase-applet-config.json contains unnecessary public client field: ${key}`
    );
  }
}

for (const sensitiveKey of [
  'apiKey',
  'appId',
  'authDomain',
  'storageBucket',
  'messagingSenderId',
  'oAuthClientId',
  'recaptchaSiteKey',
]) {
  if (firebaseConfig[sensitiveKey]) {
    failures.push(
      `firebase-applet-config.json must not retain unused client identifier: ${sensitiveKey}`
    );
  }
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
  /--outfile=dist\//.test(String(packageJson.scripts?.build || '')) ||
  /^node\s+dist\//.test(String(packageJson.scripts?.start || '').trim())
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

  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(source)) {
    failures.push(`${file} contains a hardcoded email address in client source.`);
  }
}

for (const file of ['server.ts', 'server/emailService.ts']) {
  const source = read(file);
  if (/rejectUnauthorized\s*:\s*false/.test(source)) {
    failures.push(`${file} disables TLS certificate verification.`);
  }
}

const serverSource = read('server.ts');
const schedulerSource = read('server/scheduler.ts');
const tokenServiceSource = read('server/tokenService.ts');
const offlineStorageSource = read('src/services/offlineStorage.ts');
const emailServiceSource = read('server/emailService.ts');
const deploymentConfig = JSON.parse(read('deployment-config.json'));
const firebaseDeployWorkflow = read('.github/workflows/deploy-firestore-rules.yml');

if (!/secret\.length\s*<\s*32/.test(tokenServiceSource)) {
  failures.push('CONFIRMATION_SECRET must enforce a minimum length of 32 characters.');
}

if (!schedulerSource.includes('refusing to send without deduplication')) {
  failures.push('Scheduler must fail closed when the distributed reminder lock is unavailable.');
}

if (!schedulerSource.includes('saveNotificationLastSentDate(dateKey)')) {
  failures.push('Scheduler must persist lastSentDate after confirmed delivery.');
}

if (!offlineStorageSource.includes('isRetryableSyncError')) {
  failures.push('Offline sync must preserve retryable authentication/network/server failures.');
}

if (!offlineStorageSource.includes('sync_conflicts_v1')) {
  failures.push('Offline sync must retain conflict audit records.');
}

if (/localStorage\.setItem\s*\(/.test(offlineStorageSource)) {
  failures.push('Offline cache must not mirror owner data into legacy localStorage.');
}

if (!emailServiceSource.includes('habitIds: habits.map')) {
  failures.push('Daily email review tokens must bind the due habit scope.');
}

if (
  !deploymentConfig.appBaseUrl ||
  !deploymentConfig.oidcAudience ||
  !String(deploymentConfig.appBaseUrl).startsWith('https://')
) {
  failures.push('deployment-config.json must define HTTPS appBaseUrl and oidcAudience.');
}

if (
  !firebaseDeployWorkflow.includes('FIREBASE_SERVICE_ACCOUNT_JSON') ||
  !firebaseDeployWorkflow.includes('firebase-tools@latest deploy')
) {
  failures.push('Firestore rules must have an authenticated deployment workflow.');
}


for (const protectedPath of [
  '/firebase-applet-config.json',
  '/firestore.rules',
  '/firebase-blueprint.json',
  '/server.ts',
  '/server',
  '/scripts',
]) {
  if (!serverSource.includes(protectedPath)) {
    failures.push(`Server source/config denylist is missing: ${protectedPath}`);
  }
}

for (const ownerRoutePattern of [
  /app\.get\('\/api\/data\/records',\s*requireOwner/,
  /app\.put\('\/api\/data\/records\/:id',\s*requireOwner/,
  /app\.delete\('\/api\/data\/records\/:id',\s*requireOwner/,
  /app\.get\('\/api\/data\/tasks',\s*requireOwner/,
  /app\.put\('\/api\/data\/tasks\/:id',\s*requireOwner/,
  /app\.delete\('\/api\/data\/tasks\/:id',\s*requireOwner/,
  /app\.get\('\/api\/data\/habits',\s*requireOwner/,
  /app\.put\('\/api\/data\/habits\/:id',\s*requireOwner/,
  /app\.delete\('\/api\/data\/habits\/:id',\s*requireOwner/,
  /app\.get\('\/api\/data\/countdown',\s*requireOwner/,
  /app\.put\('\/api\/data\/countdown',\s*requireOwner/,
]) {
  if (!ownerRoutePattern.test(serverSource)) {
    failures.push(
      `A data API route is missing requireOwner: ${ownerRoutePattern}`
    );
  }
}

if (!serverSource.includes('verifyPrivilegedFirestoreAccess')) {
  failures.push('Server startup must verify privileged IAM Firestore access.');
}

if (/name=["']token["']/.test(serverSource)) {
  failures.push('Signed capability tokens must not be rendered into hidden form fields.');
}

const tokenPropagationSource = [
  serverSource,
  read('server/emailService.ts'),
  read('server/scheduler.ts'),
].join('\n');

if (/previewLinks\s*:/.test(tokenPropagationSource)) {
  failures.push('Signed capability links must not be returned through API or scheduler result objects.');
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
