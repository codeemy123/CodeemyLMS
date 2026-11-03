import { test, expect } from './test-fixture';
for (const uploader of ['admin', 'mentor']) {
  test(
    uploader +
      ' R2 image and lesson video uploads persist as metadata and support private preview/ranges',
    async ({ page }) => {
      await page.goto('/' + uploader + '/courses/full-stack-web-development');
      await page.getByLabel('Resource title', { exact: true }).fill('Cloud image');
      await page.getByLabel('Resource file').setInputFiles({
        name: 'pixel.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
          'base64',
        ),
      });
      await page.getByRole('button', { name: 'Add resource', exact: true }).click();
      await expect(page.getByText('Cloud image', { exact: true })).toBeVisible();
      const image = await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('codeemy-demo-v3')).workflows.resources.find(
            (r) => r.title === 'Cloud image',
          ).file,
      );
      expect(image.storage).toBe('r2');
      expect(image.data).toMatch(/^\/api\/storage\/object\?/);
      expect(JSON.stringify(image)).not.toContain('base64');
      const imageResponse = await page.request.get(image.data);
      expect(imageResponse.status()).toBe(200);
      expect(imageResponse.headers()['content-type']).toContain('image/png');
      const video = await page.evaluate(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const stream = canvas.captureStream(0),
          recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' }),
          parts = [];
        const completed = new Promise((resolve) => {
          recorder.ondataavailable = (event) => parts.push(event.data);
          recorder.onstop = async () =>
            resolve(Array.from(new Uint8Array(await new Blob(parts).arrayBuffer())));
        });
        recorder.start();
        const ctx = canvas.getContext('2d');
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = i % 2 ? 'red' : 'blue';
          ctx.fillRect(0, 0, 32, 32);
          stream.getVideoTracks()[0].requestFrame();
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        recorder.stop();
        const bytes = await completed;
        stream.getTracks().forEach((track) => track.stop());
        return bytes;
      });
      await page.getByLabel('Module', { exact: true }).fill('Video practice');
      await page.getByLabel('Lesson title').fill('R2 video lesson');
      await page.getByLabel('Lesson description').fill('Playback from Cloudflare R2');
      await page
        .getByLabel('Upload lesson video')
        .setInputFiles({ name: 'lesson.webm', mimeType: 'video/webm', buffer: Buffer.from(video) });
      await page.getByRole('button', { name: 'Save lesson', exact: true }).click();
      await expect(
        page.getByRole('button', { name: /Video practice.*R2 video lesson/ }),
      ).toBeVisible();
      await page.goto('/student/courses/full-stack-web-development');
      await page.getByRole('button', { name: /Video practice.*R2 video lesson/ }).click();
      const player = page.locator('video');
      await expect(player).toBeVisible();
      await expect
        .poll(() => player.evaluate((node) => node.readyState), { timeout: 15000 })
        .toBeGreaterThanOrEqual(1);
      const source = await player.getAttribute('src');
      const range = await page.request.get(source, { headers: { range: 'bytes=0-15' } });
      expect(range.status()).toBe(206);
      expect((await range.body()).length).toBe(16);
      await page.reload();
      await page.getByRole('button', { name: /Video practice.*R2 video lesson/ }).click();
      await expect(player).toHaveAttribute('src', source);
      const invalid = new URL(source, 'http://localhost:3002');
      invalid.searchParams.set('signature', '0'.repeat(64));
      expect((await page.request.get(invalid.href)).status()).toBe(403);
    },
  );
}
test('storage rejects executable uploads, forged origin and unsigned object access', async ({
  request,
}) => {
  const headers = { 'x-codeemy-upload': '1', 'x-file-name': 'bad.html' };
  expect(
    (
      await request.post('/api/storage/upload', {
        headers,
        data: Buffer.from('<script>test</script>'),
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post('/api/storage/upload', {
        headers: { ...headers, 'x-file-name': 'test.txt', origin: 'https://evil.example' },
        data: Buffer.from('test'),
      })
    ).status(),
  ).toBe(403);
  expect((await request.get('/api/storage/object?key=private/file.txt')).status()).toBe(403);
});
