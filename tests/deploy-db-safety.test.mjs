import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseDatabaseUrl, validateDatabaseTargets } from '../scripts/deploy-db-safety.mjs';

const runtimeUrl = 'postgresql://codeemy_app:runtime-test@127.0.0.1:5432/codeemy_lms';
const migrationUrl = 'postgresql://postgres:migration-test@127.0.0.1:5432/codeemy_lms';
const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
const preDeploy = readFileSync(new URL('../scripts/predeploy-db.ps1', import.meta.url), 'utf8');
const postDeploySync = readFileSync(new URL('../scripts/sync-vps.ps1', import.meta.url), 'utf8');
const prismaConfig = readFileSync(new URL('../prisma7.config.js', import.meta.url), 'utf8');
const recordingMigration = readFileSync(
  new URL('../prisma/migrations/202611260002_zoom_recordings_column_mapping/migration.sql', import.meta.url),
  'utf8',
);

test('deployment DB targets require app-only runtime and separate owner migration roles', () => {
  const targets = validateDatabaseTargets(runtimeUrl, migrationUrl);

  assert.equal(targets.runtime.username, 'codeemy_app');
  assert.equal(targets.migration.username, 'postgres');
  assert.equal(targets.runtime.database, targets.migration.database);
});

test('deployment DB targets reject runtime owner credentials', () => {
  assert.throws(
    () => validateDatabaseTargets(migrationUrl, migrationUrl),
    /DATABASE_URL must authenticate as codeemy_app/,
  );
});

test('deployment DB targets reject migration through the runtime role', () => {
  assert.throws(
    () => validateDatabaseTargets(runtimeUrl, runtimeUrl),
    /MIGRATION_DATABASE_URL must use a database-owner role/,
  );
});

test('deployment DB targets must point to the same database', () => {
  const otherDatabase = migrationUrl.replace('/codeemy_lms', '/another_database');
  assert.throws(
    () => validateDatabaseTargets(runtimeUrl, otherDatabase),
    /must target the same database/,
  );
});

test('invalid URLs are rejected without echoing credential input', () => {
  const secret = 'do-not-echo-this';
  assert.throws(
    () => parseDatabaseUrl(`not-a-url-${secret}`, 'MIGRATION_DATABASE_URL'),
    (error) => error.message.includes('valid PostgreSQL URL') && !error.message.includes(secret),
  );
});

test('URL-encoded credentials are parsed without changing the configured target', () => {
  const parsed = parseDatabaseUrl(
    'postgresql://owner:p%40ss%3Aword@localhost:5432/codeemy_lms',
    'MIGRATION_DATABASE_URL',
  );

  assert.equal(parsed.password, 'p@ss:word');
  assert.equal(parsed.database, 'codeemy_lms');
});

test('Prisma CLI has no fallback to the runtime database URL', () => {
  assert.match(prismaConfig, /process\.env\.MIGRATION_DATABASE_URL/);
  assert.doesNotMatch(prismaConfig, /process\.env\.DATABASE_URL/);
});

test('production workflow gates release deployment on database backup and migration checks', () => {
  const safetyGate = workflow.indexOf('name: Back up, verify restore, and migrate before deployment');
  const deploy = workflow.indexOf('- name: Deploy production release');
  const sync = workflow.indexOf('- name: Sync latest code, build, and restart LMSBackend');

  assert.ok(safetyGate >= 0 && safetyGate < deploy && deploy < sync);
  assert.match(workflow, /secrets\.DATABASE_URL/);
  assert.match(workflow, /secrets\.MIGRATION_DATABASE_URL/);
  assert.match(preDeploy, /git worktree add --detach/);
  assert.doesNotMatch(preDeploy, /git reset --hard/);
  assert.match(workflow, /catch \{ Write-Error \$\_; exit 1 \}/);
  assert.ok(
    preDeploy.indexOf("SetEnvironmentVariable('DATABASE_URL'") >
      preDeploy.indexOf('node scripts/deploy-db-safety.mjs'),
  );
});

test('post-deployment sync neither embeds DB credentials nor runs migrations', () => {
  assert.doesNotMatch(postDeploySync, /postgresql:\/\/[^/\s]+:[^@\s]+@/i);
  assert.doesNotMatch(postDeploySync, /PGPASSWORD/);
  assert.doesNotMatch(postDeploySync, /prisma migrate deploy/);
  assert.doesNotMatch(postDeploySync, /SetEnvironmentVariable\('DATABASE_URL'/);
  for (const name of ['GOOGLE_APPLICATION_CREDENTIALS', 'LMS_ADMIN_EMAILS', 'LMS_DATABASE_MODE']) {
    const guard = postDeploySync.indexOf(`GetEnvironmentVariable('${name}', 'Machine')`);
    const setter = postDeploySync.indexOf(`SetEnvironmentVariable('${name}'`);
    assert.ok(guard >= 0 && setter > guard);
  }
});

test('recording compatibility migration renames legacy columns without discarding data', () => {
  assert.match(recordingMigration, /RENAME COLUMN size_bytes TO file_size_bytes/);
  assert.match(recordingMigration, /RENAME COLUMN lease_until TO lease_expires_at/);
  assert.doesNotMatch(recordingMigration, /\b(DROP TABLE|DELETE FROM|TRUNCATE)\b/i);
});
