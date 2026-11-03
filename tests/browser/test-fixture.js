import { test as base, expect } from '@playwright/test';
// Delete only objects created by this isolated test context; never scan the bucket.
export const test = base.extend({
  r2Cleanup: [
    async ({ context, baseURL }, use) => {
      const pending = [],
        files = [];
      const handler = (response) => {
        if (new URL(response.url()).pathname === '/api/storage/upload' && response.status() === 201)
          pending.push(
            response.json().then((file) => {
              if (file.storage === 'r2') files.push(file.data);
            }),
          );
      };
      context.on('response', handler);
      await use();
      context.off('response', handler);
      await Promise.allSettled(pending);
      for (const path of files) {
        const response = await context.request.delete(new URL(path, baseURL).href, {
          headers: { 'x-codeemy-upload': '1' },
        });
        expect(response.status(), 'cleanup of test-created R2 object').toBe(204);
      }
    },
    { auto: true },
  ],
});
export { expect };
