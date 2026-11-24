import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Prisma maps the profile image property to the production column', async () => {
  const schema = await readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  const migration = await readFile(
    new URL('../prisma/migrations/202611240001_profile_image_url/migration.sql', import.meta.url),
    'utf8',
  );

  assert.match(schema, /profile_image\s+String\?\s+@map\("profile_image_url"\)/);
  assert.match(migration, /RENAME COLUMN profile_image TO profile_image_url/);
  assert.match(migration, /IF EXISTS/);
});
