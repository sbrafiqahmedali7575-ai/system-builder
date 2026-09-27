import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateConfirmationToken,
  generateDailyReviewToken,
  verifyConfirmationToken,
} from '../server/tokenService';

test('confirmation secrets shorter than 32 characters fail closed', () => {
  process.env.CONFIRMATION_SECRET = 'too-short';
  assert.throws(
    () =>
      generateConfirmationToken({
        taskId: 'task-1',
        recordId: 'record-1',
        taskDate: '27-Sep-2026',
        status: 'completed',
      }),
    /at least 32 characters/
  );
});

test('signed confirmation tokens verify and tampering is rejected', () => {
  process.env.CONFIRMATION_SECRET =
    'test-only-confirmation-secret-with-more-than-32-characters';

  const token = generateConfirmationToken({
    taskId: 'task-1',
    recordId: 'record-1',
    taskDate: '27-Sep-2026',
    status: 'completed',
  });

  const verified = verifyConfirmationToken(token);
  assert.equal(verified.valid, true);
  assert.equal(verified.payload?.taskId, 'task-1');

  const tampered = token.replace(/.$/, (value) => (value === 'a' ? 'b' : 'a'));
  assert.equal(verifyConfirmationToken(tampered).valid, false);
});

test('daily review tokens bind both task and habit scopes', () => {
  process.env.CONFIRMATION_SECRET =
    'test-only-confirmation-secret-with-more-than-32-characters';

  const token = generateDailyReviewToken({
    taskDate: '27-Sep-2026',
    recordId: 'record-1',
    taskIds: ['task-1', 'task-1', 'task-2'],
    habitIds: ['habit-1', 'habit-1'],
  });

  const verified = verifyConfirmationToken(token);
  assert.equal(verified.valid, true);
  assert.deepEqual(verified.payload?.taskIds, ['task-1', 'task-2']);
  assert.deepEqual(verified.payload?.habitIds, ['habit-1']);
});
