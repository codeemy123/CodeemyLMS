import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statfsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import pg from 'pg';

config({ path: ['.env.local', '.env'], quiet: true });

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backupDirectory = 'C:\\LMS\\Backend\\Backups\\Database';
const preservedTables = [
  'employees',
  'leave_applications',
  'permission_od_requests',
  'employee_attendance',
  'announcements',
  'answers',
  'assessment_attempts',
  'assessments',
  'assignment_submissions',
  'assignments',
  'attendance',
  'audit_logs',
  'batch_members',
  'batches',
  'career_applications',
  'certificates',
  'class_sessions',
  'course_modules',
  'courses',
  'enrollments',
  'lesson_progress',
  'lessons',
  'mentor_profiles',
  'notifications',
  'project_submissions',
  'projects',
  'query_replies',
  'question_options',
  'questions',
  'resources',
  'student_profiles',
  'student_queries',
  'users',
  'zoom_class_links',
  'zoom_recordings',
];
const migrationTouchedTables = [
  'student_profiles',
  'resources',
  'users',
  'career_applications',
  'class_sessions',
  'employees',
  'leave_applications',
  'permission_od_requests',
  'employee_attendance',
  'zoom_class_links',
  'zoom_recordings',
];
const expectedColumns = {
  employees: ['id', 'firebase_uid', 'emp_role', 'status', 'team_leader_id'],
  leave_applications: ['employee_id', 'leave_type', 'from_date', 'to_date', 'status'],
  permission_od_requests: ['employee_id', 'od_type', 'day_type', 'from_date', 'to_date', 'status'],
  employee_attendance: ['employee_id', 'att_date', 'att_status', 'status'],
  users: ['firebase_uid', 'email', 'role', 'status', 'profile_image_url'],
  attendance: ['session_id', 'student_id', 'status'],
  class_sessions: ['start_time', 'end_time', 'description', 'thumbnail_url', 'tags'],
  zoom_recordings: ['file_size_bytes', 'lease_expires_at', 'status'],
};

export function parseDatabaseUrl(raw, label) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error(`${label} is required.`);

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} is not a valid PostgreSQL URL.`);
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error(`${label} must use PostgreSQL.`);
  }

  let username;
  let password;
  try {
    username = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch {
    throw new Error(`${label} has invalid URL-encoded credentials.`);
  }

  const database = decodeURIComponent(url.pathname.slice(1));
  if (!url.hostname || !username || !password || !database) {
    throw new Error(`${label} must include host, database, username, and password.`);
  }

  return { url, host: url.hostname, port: url.port || '5432', database, username, password };
}

export function validateDatabaseTargets(runtimeRaw, migrationRaw) {
  const runtime = parseDatabaseUrl(runtimeRaw, 'DATABASE_URL');
  const migration = parseDatabaseUrl(migrationRaw, 'MIGRATION_DATABASE_URL');

  if (runtime.username !== 'codeemy_app') {
    throw new Error('DATABASE_URL must authenticate as codeemy_app.');
  }
  if (migration.username === 'codeemy_app') {
    throw new Error('MIGRATION_DATABASE_URL must use a database-owner role, not codeemy_app.');
  }
  if (
    runtime.host !== migration.host ||
    runtime.port !== migration.port ||
    runtime.database !== migration.database
  ) {
    throw new Error('Runtime and migration URLs must target the same database.');
  }

  return { runtime, migration };
}

function urlForDatabase(parsed, database) {
  const url = new URL(parsed.url);
  url.pathname = `/${database}`;
  return url.toString();
}

function postgresEnvironment(parsed, database = parsed.database) {
  const env = {
    ...process.env,
    PGHOST: parsed.host,
    PGPORT: parsed.port,
    PGUSER: parsed.username,
    PGPASSWORD: parsed.password,
    PGDATABASE: database,
  };
  const parameterMap = {
    sslmode: 'PGSSLMODE',
    sslcert: 'PGSSLCERT',
    sslkey: 'PGSSLKEY',
    sslrootcert: 'PGSSLROOTCERT',
  };

  for (const [parameter, variable] of Object.entries(parameterMap)) {
    const value = parsed.url.searchParams.get(parameter);
    if (value) env[variable] = value;
  }
  return env;
}

function safeRun(command, args, env, label) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  let output = `${result.stdout || ''}${result.stderr || ''}`;
  for (const key of ['DATABASE_URL', 'MIGRATION_DATABASE_URL']) {
    const raw = env[key];
    if (!raw) continue;
    output = output.replaceAll(raw, '[redacted database URL]');
    try {
      const password = decodeURIComponent(new URL(raw).password);
      if (password) output = output.replaceAll(password, '[redacted]');
    } catch {
      output = '[database command output redacted because its connection URL was invalid]';
    }
  }

  if (output.trim()) process.stdout.write(output);
  if (result.error || result.status !== 0) {
    throw new Error(`${label} failed${result.status === null ? '' : ` (exit ${result.status})`}.`);
  }
}

function runPrisma(command, migrationUrl) {
  const env = { ...process.env, MIGRATION_DATABASE_URL: migrationUrl };
  const executable =
    process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npx';
  const args =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', `npx prisma migrate ${command}`]
      : ['prisma', 'migrate', command];
  safeRun(executable, args, env, `Prisma migrate ${command}`);
}

function findPostgresTool(name) {
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const candidates = [
    process.env.PG_BIN_DIR && path.join(process.env.PG_BIN_DIR, `${name}${suffix}`),
    process.platform === 'win32' && `C:\\Program Files\\PostgreSQL\\18\\bin\\${name}.exe`,
    process.platform === 'win32' && `C:\\Program Files\\PostgreSQL\\17\\bin\\${name}.exe`,
    process.platform === 'win32' && `C:\\Program Files\\PostgreSQL\\16\\bin\\${name}.exe`,
    name,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === name || (path.isAbsolute(candidate) && existsSync(candidate))) return candidate;
  }
  throw new Error(`Could not locate PostgreSQL ${name}.`);
}

async function openClient(connectionString, label) {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.end().catch(() => {});
    throw new Error(`${label} connection failed (PostgreSQL ${error.code || 'connection error'}).`);
  }
}

async function verifyRoles(runtime, migration) {
  const runtimeClient = await openClient(runtime.url.toString(), 'Runtime database');
  let ownerClient;

  try {
    ownerClient = await openClient(migration.url.toString(), 'Migration database');
    const app = await runtimeClient.query(`
      SELECT current_user AS role,
             has_schema_privilege(current_user, 'public', 'CREATE') AS can_create
    `);
    if (app.rows[0].role !== 'codeemy_app' || app.rows[0].can_create) {
      throw new Error('Runtime DB role must be codeemy_app and must not have CREATE on public.');
    }

    const owner = await ownerClient.query(`
      SELECT current_user AS role,
             r.rolsuper AS is_superuser,
             r.rolcreatedb AS can_create_database,
             has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_schema
      FROM pg_roles r
      WHERE r.rolname = current_user
    `);
    const state = owner.rows[0];
    if (!state || state.role !== migration.username) {
      throw new Error('Migration URL authenticated as an unexpected database role.');
    }
    if (!state.is_superuser && (!state.can_create_database || !state.can_create_schema)) {
      throw new Error(
        'Migration role needs database CREATE and public schema CREATE privileges for restore verification.',
      );
    }

    if (!state.is_superuser) {
      const owners = await ownerClient.query(`
        SELECT c.relname AS table_name,
               pg_get_userbyid(c.relowner) = current_user AS is_owner
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = ANY($1::text[])
          AND c.relkind IN ('r', 'p')
      `, [migrationTouchedTables]);
      if (owners.rows.some((row) => !row.is_owner)) {
        throw new Error('Migration role must own every existing LMS and Leave/ESS table it will modify.');
      }
    }

    const history = await ownerClient.query(`
      SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS exists
    `);
    if (!history.rows[0].exists) {
      throw new Error('Prisma migration history is missing; deployment is blocked.');
    }
    const baseline = await ownerClient.query(`
      SELECT EXISTS (
        SELECT 1 FROM public._prisma_migrations
        WHERE migration_name = '00000000000000_baseline'
          AND finished_at IS NOT NULL
          AND rolled_back_at IS NULL
      ) AS registered
    `);
    if (!baseline.rows[0].registered) {
      throw new Error('The existing database baseline is not registered; deployment is blocked.');
    }
    const failed = await ownerClient.query(`
      SELECT migration_name
      FROM public._prisma_migrations
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    `);
    if (failed.rowCount) {
      throw new Error('A previous Prisma migration is unfinished; resolve it before deployment.');
    }

    return { runtimeClient, ownerClient };
  } catch (error) {
    await Promise.allSettled([runtimeClient.end(), ownerClient?.end()]);
    throw error;
  }
}

async function countsForPreservedTables(client) {
  const counts = {};
  for (const table of preservedTables) {
    const exists = await client.query('SELECT to_regclass($1) IS NOT NULL AS exists', [
      `public.${table}`,
    ]);
    if (!exists.rows[0].exists) {
      counts[table] = '0';
      continue;
    }
    const result = await client.query(`SELECT count(*)::text AS count FROM public."${table}"`);
    counts[table] = result.rows[0].count;
  }
  return counts;
}

async function verifyRequiredTables(client, label) {
  const result = await client.query(
    `SELECT table_name
     FROM unnest($1::text[]) AS required(table_name)
     WHERE to_regclass('public.' || quote_ident(table_name)) IS NULL`,
    [preservedTables],
  );
  if (result.rowCount) {
    throw new Error(`${label} is missing required tables: ${result.rows.map((row) => row.table_name).join(', ')}.`);
  }
}

function sameCounts(before, after, label) {
  for (const table of preservedTables) {
    if (before[table] !== after[table]) {
      throw new Error(`${label} changed the row count of public.${table}; deployment is blocked.`);
    }
  }
}

async function verifyMappedSchema(client, label) {
  for (const [table, columns] of Object.entries(expectedColumns)) {
    const result = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    const present = new Set(result.rows.map((row) => row.column_name));
    if (columns.some((column) => !present.has(column))) {
      throw new Error(`${label} is missing required columns on public.${table}.`);
    }
  }
}

function availableBytes(targetPath) {
  const stats = statfsSync(targetPath);
  return BigInt(stats.bavail) * BigInt(stats.bsize);
}

function requireFreeSpace(targetPath, requiredBytes, label) {
  let available;
  try {
    available = availableBytes(targetPath);
  } catch {
    throw new Error(`Could not verify free space for ${label}; deployment is blocked.`);
  }
  if (available < requiredBytes) {
    throw new Error(`Not enough free space for the database backup and restore check on ${label}.`);
  }
}

async function runBackupAndRestoreCheck(ownerClient, migration, baselineCounts) {
  mkdirSync(backupDirectory, { recursive: true });
  const databaseState = await ownerClient.query(`
    SELECT pg_database_size(current_database())::text AS size,
           current_setting('data_directory') AS data_directory
  `);
  const databaseBytes = BigInt(databaseState.rows[0].size);
  const dataDirectory = databaseState.rows[0].data_directory;
  const backupRoot = path.parse(path.resolve(backupDirectory)).root.toLowerCase();
  const dataRoot = path.parse(path.resolve(dataDirectory)).root.toLowerCase();
  if (backupRoot === dataRoot) {
    requireFreeSpace(backupDirectory, databaseBytes * 2n, 'backup and restore volume');
  } else {
    requireFreeSpace(backupDirectory, databaseBytes, 'backup volume');
    requireFreeSpace(dataDirectory, databaseBytes, 'PostgreSQL restore volume');
  }

  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const backupPath = path.join(backupDirectory, `codeemy-lms-pre-migration-${timestamp}.dump`);
  const environment = postgresEnvironment(migration);
  const pgDump = findPostgresTool('pg_dump');
  const pgRestore = findPostgresTool('pg_restore');

  safeRun(
    pgDump,
    ['--format=custom', '--no-password', `--file=${backupPath}`, migration.database],
    environment,
    'Database backup',
  );
  const backupBytes = BigInt(statSync(backupPath).size);
  if (backupBytes <= 0n) throw new Error('Database backup archive is empty.');
  safeRun(pgRestore, ['--list', '--no-password', backupPath], environment, 'Backup archive verification');

  const restoreDatabase = `codeemy_restore_${timestamp.toLowerCase()}`;
  if (!/^[a-z0-9_]+$/.test(restoreDatabase)) throw new Error('Invalid restore-check database name.');
  const adminUrl = new URL(migration.url);
  adminUrl.pathname = '/postgres';
  const adminClient = await openClient(adminUrl.toString(), 'Database administration');
  let created = false;

  try {
    await adminClient.query(`CREATE DATABASE "${restoreDatabase}"`);
    created = true;
    safeRun(
      pgRestore,
      ['--exit-on-error', '--no-password', `--dbname=${restoreDatabase}`, backupPath],
      { ...environment, PGDATABASE: restoreDatabase },
      'Backup restore verification',
    );

    const restoreUrl = urlForDatabase(migration, restoreDatabase);
    const restoredClient = await openClient(restoreUrl, 'Restored database');
    try {
      const restoredCounts = await countsForPreservedTables(restoredClient);
      sameCounts(baselineCounts, restoredCounts, 'Backup restore');
      runPrisma('deploy', restoreUrl);
      runPrisma('status', restoreUrl);
      await verifyRequiredTables(restoredClient, 'Restored migration test database');
      await verifyMappedSchema(restoredClient, 'Restored migration test database');
      const postMigrationCounts = await countsForPreservedTables(restoredClient);
      sameCounts(restoredCounts, postMigrationCounts, 'Test migration');
    } finally {
      await restoredClient.end();
    }
  } finally {
    if (created) await adminClient.query(`DROP DATABASE "${restoreDatabase}"`);
    await adminClient.end();
  }

  console.log(`Fresh backup and restore/migration verification succeeded: ${backupPath}`);
}

async function main() {
  const { runtime, migration } = validateDatabaseTargets(
    process.env.DATABASE_URL,
    process.env.MIGRATION_DATABASE_URL,
  );
  const { runtimeClient, ownerClient } = await verifyRoles(runtime, migration);
  try {
    const before = await countsForPreservedTables(ownerClient);
    await runBackupAndRestoreCheck(ownerClient, migration, before);
    runPrisma('deploy', migration.url.toString());
    runPrisma('status', migration.url.toString());
    await verifyRequiredTables(ownerClient, 'Production database');
    await verifyMappedSchema(ownerClient, 'Production database');
    const after = await countsForPreservedTables(ownerClient);
    sameCounts(before, after, 'Production migration');
    console.log('Production database migration verified; preserved table row counts are unchanged.');
  } finally {
    await Promise.allSettled([runtimeClient.end(), ownerClient.end()]);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Pre-deployment database safety check failed: ${error.message}`);
    process.exitCode = 1;
  });
}
