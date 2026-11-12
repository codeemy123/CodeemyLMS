import test from 'node:test';
import assert from 'node:assert/strict';
import {
  requestAssessmentReopen,
  reviewAssessmentReopen,
} from '../src/lib/server/assessment-reopens.js';
const id = '11111111-1111-4111-8111-111111111111';
test('only students request access and only Admin reviews it', async () => {
  for (const role of ['ADMIN', 'MENTOR'])
    await assert.rejects(
      requestAssessmentReopen({}, { role }, { attemptId: id, reason: 'Test' }),
      (e) => e.status === 403,
    );
  for (const role of ['STUDENT', 'MENTOR'])
    await assert.rejects(
      reviewAssessmentReopen({}, { role }, { requestId: id, decision: 'APPROVED' }),
      (e) => e.status === 403,
    );
});
test('access requests and rejections require a reason', async () => {
  await assert.rejects(
    requestAssessmentReopen({}, { role: 'STUDENT' }, { attemptId: id, reason: ' ' }),
    (e) => e.status === 400,
  );
  await assert.rejects(
    reviewAssessmentReopen(
      {},
      { role: 'ADMIN' },
      { requestId: id, decision: 'REJECTED', reason: '' },
    ),
    (e) => e.status === 400,
  );
});
test('Admin approval requires a valid future closing window', async () => {
  for (const window of [
    { openAt: 'invalid', closeAt: 'invalid' },
    { openAt: new Date().toISOString(), closeAt: new Date(Date.now() - 1000).toISOString() },
  ])
    await assert.rejects(
      reviewAssessmentReopen(
        {},
        { role: 'ADMIN' },
        { requestId: id, decision: 'APPROVED', ...window },
      ),
      (e) => e.status === 400,
    );
});
