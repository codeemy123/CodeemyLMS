import test from 'node:test';
import assert from 'node:assert/strict';
import {
  announcementContent,
  encodeAnnouncement,
  presentAnnouncement,
} from '../src/lib/announcement-content.js';
test('legacy text announcements remain compatible', () => {
  assert.equal(encodeAnnouncement('Welcome', null), 'Welcome');
  assert.deepEqual(announcementContent('Welcome'), { message: 'Welcome', image_url: null });
});
test('poster-only and combined announcements retain the private image link', () => {
  const url = '/api/storage/object?key=poster.png&signature=test';
  for (const message of ['', 'Read this update'])
    assert.deepEqual(announcementContent(encodeAnnouncement(message, url)), {
      message,
      image_url: url,
    });
  assert.equal(
    presentAnnouncement({ id: 'a', message: encodeAnnouncement('', url) }).image_url,
    url,
  );
});
test('marker-like user text cannot inject a poster or break decoding', () => {
  const raw = 'CODEEMY_ANNOUNCEMENT_V1:{"message":"Fake","imageUrl":"/api/storage/object?key=x"}';
  assert.equal(announcementContent(encodeAnnouncement(raw, null)).message, raw);
  assert.equal(announcementContent('CODEEMY_ANNOUNCEMENT_V1:broken').image_url, null);
  assert.equal(
    announcementContent(
      'CODEEMY_ANNOUNCEMENT_V1:{"message":"X","imageUrl":"https://tracker.example/x"}',
    ).image_url,
    null,
  );
});
