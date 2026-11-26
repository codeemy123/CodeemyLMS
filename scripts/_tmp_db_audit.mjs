import { config } from 'dotenv';
import pg from 'pg';

config({ path: '.env.local', quiet: true });

function describe(label, raw) {
  const at = (raw.match(/@/g) || []).length;
  const u = new URL(raw);
  console.log(label, JSON.stringify({
    user: u.username,
    host: u.hostname,
    port: u.port,
    db: u.pathname,
    query: u.search,
    atCount: at,
    passLength: decodeURIComponent(u.password || '').length,
    passEncoded: (u.password || '') !== decodeURIComponent(u.password || ''),
  }));
  return u;
}
const appUrl = describe('APP_TARGET', process.env.DATABASE_URL);
const migUrl = describe('MIG_TARGET', process.env.MIGRATION_DATABASE_URL);
console.log('SAME_DB', appUrl.pathname === migUrl.pathname && appUrl.hostname === migUrl.hostname);

function clientFrom(raw) {
  const u = new URL(raw);
  return new pg.Client({
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    host: u.hostname,
    port: Number(u.port || 5432),
    database: u.pathname.replace(/^\//, ''),
  });
}

const mig = clientFrom(process.env.MIGRATION_DATABASE_URL);
try {
  await mig.connect();
  console.log('MIG_CONNECT', 'ok');
} catch (error) {
  console.log('MIG_CONNECT', error.code || error.message);
  process.exit(1);
}
let app = null;
try {
  app = clientFrom(process.env.DATABASE_URL);
  await app.connect();
  console.log('APP_CONNECT', 'ok');
} catch (error) {
  console.log('APP_CONNECT', error.code || error.message);
  app = null;
}

async function ident(client, label) {
  const r = await client.query(`
    SELECT current_user, session_user, current_database() AS db,
      (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_super
  `);
  console.log(label, JSON.stringify(r.rows[0]));
}

if (app) await ident(app, 'APP');
await ident(mig, 'MIG');

const owners = await mig.query(`
  SELECT c.relname AS table_name, pg_get_userbyid(c.relowner) AS owner
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND c.relname IN (
      'class_sessions','zoom_class_links','zoom_recordings','employees',
      'leave_applications','permission_od_requests','employee_attendance','users'
    )
  ORDER BY c.relname
`);
console.log('OWNERS', JSON.stringify(owners.rows));

const cols = await mig.query(`
  SELECT table_name, column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (
      (table_name = 'class_sessions' AND column_name IN (
        'start_time','end_time','start_at','end_at','description','thumbnail_url','tags'
      ))
      OR table_name = 'zoom_recordings'
    )
  ORDER BY table_name, ordinal_position
`);
console.log('COLS', JSON.stringify(cols.rows));

const counts = await mig.query(`
  SELECT 'employees' AS t, count(*)::int AS n FROM employees
  UNION ALL SELECT 'leave_applications', count(*)::int FROM leave_applications
  UNION ALL SELECT 'permission_od_requests', count(*)::int FROM permission_od_requests
  UNION ALL SELECT 'employee_attendance', count(*)::int FROM employee_attendance
  UNION ALL SELECT 'class_sessions', count(*)::int FROM class_sessions
  UNION ALL SELECT 'zoom_class_links', count(*)::int FROM zoom_class_links
  UNION ALL SELECT 'zoom_recordings', count(*)::int FROM zoom_recordings
  UNION ALL SELECT 'users', count(*)::int FROM users
`);
console.log('COUNTS', JSON.stringify(counts.rows));

const statuses = await mig.query(`
  SELECT status, count(*)::int AS n FROM zoom_recordings GROUP BY status ORDER BY status
`);
console.log('REC_STATUS', JSON.stringify(statuses.rows));

const hist = await mig.query(`
  SELECT migration_name,
         finished_at IS NOT NULL AS finished,
         rolled_back_at IS NOT NULL AS rolled_back
  FROM _prisma_migrations
  ORDER BY started_at
`);
console.log('HISTORY', JSON.stringify(hist.rows));

const grants = await mig.query(`
  SELECT table_name, privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND grantee = 'codeemy_app'
    AND table_name IN (
      'class_sessions','zoom_class_links','zoom_recordings','employees',
      'leave_applications','permission_od_requests','employee_attendance'
    )
  ORDER BY table_name, privilege_type
`);
console.log('APP_GRANTS', JSON.stringify(grants.rows));

const checks = await mig.query(`
  SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE conrelid = 'public.zoom_recordings'::regclass AND contype = 'c'
`);
console.log('CHECKS', JSON.stringify(checks.rows));

if (app) await app.end();
await mig.end();
