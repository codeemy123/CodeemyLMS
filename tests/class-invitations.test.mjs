import assert from 'node:assert/strict';
import test from 'node:test';
import { buildClassInvitation, sendClassInvitationEmails } from '../src/lib/server/class-invitations.js';

const session = { title: 'Python Foundations', start_at: '2026-12-01T10:00:00.000Z', meeting_url: 'https://zoom.us/j/123456789' };
const batch = { name: 'Python December Batch' };

test('class invitation includes the learner join link without host controls', () => {
  const invitation = buildClassInvitation({ recipient: { full_name: 'Asha' }, audience: 'student', session, batch });
  assert.match(invitation.text, /https:\/\/zoom\.us\/j\/123456789/);
  assert.doesNotMatch(invitation.text, /start_url/);
});

test('class invitations send one email for each unique recipient', async () => {
  const calls = [];
  const result = await sendClassInvitationEmails({
    students: [{ email: 'student@example.com', full_name: 'Student' }, { email: 'student@example.com', full_name: 'Student' }],
    mentor: { email: 'mentor@example.com', full_name: 'Mentor' },
    session,
    batch,
    config: { RESEND_API_KEY: 'test-key', EMAIL_FROM: 'CodeEmy <classes@example.com>' },
    fetcher: async (...args) => { calls.push(args); return { ok: true }; },
  });
  assert.equal(result.sent, 2);
  assert.equal(calls.length, 2);
});

test('class invitations remain non-blocking when email is not configured', async () => {
  const result = await sendClassInvitationEmails({ students: [{ email: 'student@example.com' }], session, batch, config: {} });
  assert.deepEqual(result, { emailConfigured: false, recipients: 1, sent: 0, failed: 0, skipped: 1 });
});
