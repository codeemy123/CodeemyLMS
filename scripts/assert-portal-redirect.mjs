import assert from 'node:assert/strict';

export async function assertPortalRedirect(response, target) {
  if ([307, 308].includes(response.status)) {
    assert.equal(new URL(response.headers.get('location'), response.url).pathname, target);
    return;
  }
  // Next.js emits a meta redirect when server layouts have started streaming.
  assert.equal(response.status, 200);
  const html = await response.text();
  const tag = html.match(/<meta\b[^>]*id="__next-page-redirect"[^>]*>/)?.[0];
  assert.ok(tag, 'Expected an actual Next.js redirect, not a successful portal response');
  assert.ok(tag.includes('url=' + target + '"'), 'Unexpected portal redirect target');
}
