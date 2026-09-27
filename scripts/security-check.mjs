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
const allowedFirebaseConfigKeys = new Set([
  'projectId',
  'firestoreDatabaseId',
  'apiKey',
  'authDomain',
  'appId',
  'messagingSenderId',
]);
for (const key of Object.keys(firebaseConfig)) {
  if (!allowedFirebaseConfigKeys.has(key)) {
    failures.push(
      `firebase-applet-config.json contains an unnecessary Firebase client field: ${key}`
    );
  }
}

for (const requiredKey of [
  'projectId',
  'firestoreDatabaseId',
  'apiKey',
  'authDomain',
  'appId',
  'messagingSenderId',
]) {
  if (!String(firebaseConfig[requiredKey] || '').trim()) {
    failures.push(
      `firebase-applet-config.json is missing required public client field: ${requiredKey}`
    );
  }
}

const firestoreRules = read('firestore.rules');
if (!firestoreRules.includes('notification_settings/daily-settings')) {
  failures.push(
    'Firestore rules must anchor browser ownership to the existing daily settings document.'
  );
}
if (!firestoreRules.includes('request.auth.token.email')) {
  failures.push(
    'Firestore rules must require the authenticated Google account email.'
  );
}
if (!/match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/.test(firestoreRules)) {
  failures.push('Firestore rules must retain a default-deny catch-all.');
}

const packageJson = JSON.parse(read('package.json'));
if (!packageJson.dependencies?.firebase) {
  failures.push('The Firebase browser SDK is required for Starter Tier authenticated data access.');
}

if (
  /--outfile=dist\//.test(String(packageJson.scripts?.build || '')) ||
  /^node\s+dist\//.test(String(packageJson.scripts?.start || '').trim())
) {
  failures.push('The backend bundle must never be written inside the public dist directory.');
}

const clientFiles = walk('src').filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));
const approvedFirebaseClientFiles = new Set([
  'src/services/firebaseClient.ts',
  'src/services/firebaseService.ts',
]);

for (const file of clientFiles) {
  const source = read(file);
  const usesFirebase =
    /from\s+['"]firebase(?:\/|['"])/.test(source) ||
    /firebase-applet-config\.json/.test(source);

  if (usesFirebase && !approvedFirebaseClientFiles.has(file.replaceAll('\\\\', '/'))) {
    failures.push(
      `${file} uses Firebase outside the approved authentication/data service boundary.`
    );
  }

  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(source)) {
    failures.push(`${file} contains a hardcoded email address in client source.`);
  }
}

const firebaseClientSource = read('src/services/firebaseClient.ts');
const firebaseServiceSource = read('src/services/firebaseService.ts');
const ownerGateSource = read('src/components/OwnerAccessGate.tsx');

if (!firebaseClientSource.includes('GoogleAuthProvider')) {
  failures.push('Firebase owner authentication must use Google Sign-In.');
}
if (!firebaseClientSource.includes("'notification_settings', 'daily-settings'")) {
  failures.push('Firebase owner verification must read the owner settings document.');
}
if (!firebaseServiceSource.includes("collection(firestoreDb, 'records')")) {
  failures.push('Interactive records must use authenticated Firestore client access.');
}
if (!ownerGateSource.includes('signInFirebaseOwner')) {
  failures.push('OwnerAccessGate must require Firebase Google owner verification.');
}

for (const file of ['server.ts', 'server/emailService.ts']) {
  const source = read(file);
  if (/rejectUnauthorized\s*:\s*false/.test(source)) {
    failures.push(`${file} disables TLS certificate verification.`);
  }
}

const serverSource = read('server.ts');
const schedulerSource = read('server/scheduler.ts');
const dbSource = read('server/db.ts');
const tokenServiceSource = read('server/tokenService.ts');
const offlineStorageSource = read('src/services/offlineStorage.ts');
const emailServiceSource = read('server/emailService.ts');
const deploymentConfig = JSON.parse(read('deployment-config.json'));

if (!/secret\.length\s*<\s*32/.test(tokenServiceSource)) {
  failures.push('CONFIRMATION_SECRET must enforce a minimum length of 32 characters.');
}

if (/process\.env\.[A-Z0-9_]*SERVICE_ACCOUNT[A-Z0-9_]*/.test(dbSource)) {
  failures.push(
    'Runtime Firestore access must use Application Default Credentials, not a service-account JSON environment secret.'
  );
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
