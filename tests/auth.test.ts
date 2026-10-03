import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { authInternalsForTests } from '../server/auth';
import { buildCanonicalUserProfile } from '../src/services/dataModelMigration';

const {
  hashPassword,
  verifyPassword,
  signSession,
  verifySessionToken,
  loginRequired,
} = authInternalsForTests;

const dummyPassword = 'temporary-test-password';
const legacyDigest = createHash('sha256')
  .update(dummyPassword, 'utf8')
  .digest('hex');

const legacyCheck = verifyPassword(
  dummyPassword,
  `sha256:${legacyDigest}`
);
assert.equal(legacyCheck.valid, true);
assert.equal(legacyCheck.needsUpgrade, true);

const wrongLegacyCheck = verifyPassword(
  'wrong-password',
  `sha256:${legacyDigest}`
);
assert.equal(wrongLegacyCheck.valid, false);

const strongHash = hashPassword(dummyPassword);
assert.match(strongHash, /^pbkdf2\$\d+\$[0-9a-f]+\$[0-9a-f]+$/);
const strongCheck = verifyPassword(dummyPassword, strongHash);
assert.equal(strongCheck.valid, true);
assert.equal(strongCheck.needsUpgrade, false);
assert.equal(verifyPassword('wrong-password', strongHash).valid, false);

const profile = {
  userId: 'default-user',
  name: 'Test User',
  userName: 'tester',
  password: strongHash,
  IsLoginRequired: 1,
};

const token = signSession(profile);
assert.equal(verifySessionToken(token, profile), true);
assert.equal(
  verifySessionToken(token, { ...profile, name: 'Renamed User' }),
  true,
  'Non-credential profile changes must not invalidate a session.'
);
assert.equal(
  verifySessionToken(token, { ...profile, password: hashPassword(dummyPassword) }),
  false,
  'Changing the password verifier must invalidate older sessions.'
);

assert.equal(loginRequired(profile), true);
assert.equal(loginRequired({ ...profile, IsLoginRequired: true }), true);
assert.equal(loginRequired({ ...profile, IsLoginRequired: 0 }), false);
assert.equal(loginRequired({ ...profile, IsLoginRequired: false }), false);

const preservedPassword = 'pbkdf2$210000$existing-salt$existing-digest';
const existingUser = {
  userId: 'default-user',
  name: 'Custom Name',
  userName: 'custom-user',
  password: preservedPassword,
  IsLoginRequired: 0,
  customField: 'preserve-me',
};
const migratedExisting = buildCanonicalUserProfile(existingUser);

assert.equal(migratedExisting.userName, 'custom-user');
assert.equal(migratedExisting.password, preservedPassword);
assert.equal(migratedExisting.IsLoginRequired, 0);
assert.equal(migratedExisting.name, 'Custom Name');
assert.equal(migratedExisting.customField, 'preserve-me');

const newUser = buildCanonicalUserProfile(null);
assert.equal(newUser.userId, 'default-user');
assert.equal(newUser.userName, 'sa');
assert.equal(newUser.IsLoginRequired, 1);
assert.match(String(newUser.password), /^sha256:/);

console.log('auth tests passed');
