// Server-side deployment configuration. Never prints environment values or secret payloads.
import { config } from 'dotenv';
import { spawnSync } from 'node:child_process';
import { applicationDefault } from 'firebase-admin/app';
import { parse } from 'pg-connection-string';
config({ path: ['.env.local', '.env'], quiet: true });
const project = 'my-project-8521codeemy-lms',
  firebaseProject = 'codeemylms',
  region = 'asia-south1',
  service = 'codeemy-lms';
const sa = 'codeemy-lms-runtime@' + project + '.iam.gserviceaccount.com';
const python =
  'C:/Program Files (x86)/Google/Cloud SDK/google-cloud-sdk/platform/bundledpython/python.exe';
const sdk = 'C:/Program Files (x86)/Google/Cloud SDK/google-cloud-sdk/lib/gcloud.py';
const apply = process.argv.includes('--apply');
function cli(args, { input, optional = false, sensitive = false } = {}) {
  const result = spawnSync(python, [sdk, ...args, '--quiet'], {
    input,
    encoding: 'utf8',
    maxBuffer: 8e6,
    windowsHide: true,
  });
  if (result.status !== 0) {
    if (optional) return null;
    throw new Error(
      'GCP operation failed: ' +
        args.slice(0, 3).join(' ') +
        ' (exit ' +
        result.status +
        ')' +
        (sensitive ? '' : ': ' + String(result.stderr || '').slice(-1200)),
    );
  }
  return result.stdout.trim();
}
const required = [
  'DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_WEB_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'CLOUDFLARE_R2_BUCKET_NAME',
  'CLOUDFLARE_R2_ENDPOINT',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
];
for (const key of required) if (!process.env[key]) throw new Error('Missing local setting: ' + key);
if (process.env.FIREBASE_PROJECT_ID !== firebaseProject)
  throw new Error('Unexpected Firebase project.');
const database = new URL(process.env.DATABASE_URL);
if (database.pathname !== '/codeemy_lms') throw new Error('Unexpected database.');
database.hostname = 'localhost';
database.port = '5432';
database.searchParams.set('host', '/cloudsql/' + project + ':' + region + ':codeemy-lms-db');
database.searchParams.set('sslmode', 'disable');
const socketUrl = database.toString();
if (parse(socketUrl).host !== '/cloudsql/' + project + ':' + region + ':codeemy-lms-db')
  throw new Error('Unix socket URL validation failed.');
const env = {
  FIREBASE_PROJECT_ID: firebaseProject,
  FIREBASE_WEB_API_KEY: process.env.FIREBASE_WEB_API_KEY,
  FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
  CLOUDFLARE_R2_BUCKET_NAME: process.env.CLOUDFLARE_R2_BUCKET_NAME,
  CLOUDFLARE_R2_ENDPOINT: process.env.CLOUDFLARE_R2_ENDPOINT,
  LMS_DATABASE_MODE: 'true',
  R2_LOCAL_PREVIEW_ENABLED: 'false',
};
const secrets = [
  ['DATABASE_URL', 'codeemy-lms-database-url', socketUrl],
  [
    'CLOUDFLARE_R2_ACCESS_KEY_ID',
    'codeemy-lms-r2-access-key-id',
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
  ],
  [
    'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    'codeemy-lms-r2-secret-access-key',
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  ],
];
console.log(
  JSON.stringify({
    apply,
    service,
    project,
    region,
    runtimeServiceAccount: sa,
    publicEnvironmentNames: Object.keys(env),
    secretEnvironmentNames: secrets.map((s) => s[0]),
    databaseSocketValidated: true,
  }),
);
if (!apply) process.exit(0);
if (
  !cli(
    ['iam', 'service-accounts', 'describe', sa, '--project=' + project, '--format=value(email)'],
    { optional: true },
  )
) {
  cli([
    'iam',
    'service-accounts',
    'create',
    'codeemy-lms-runtime',
    '--project=' + project,
    '--display-name=CodeEmy LMS runtime',
  ]);
}
console.log('Runtime service identity ready.');
cli([
  'projects',
  'add-iam-policy-binding',
  project,
  '--member=serviceAccount:' + sa,
  '--role=roles/cloudsql.client',
  '--condition=None',
  '--format=none',
]);
const roleName = 'projects/' + firebaseProject + '/roles/codeemySessionAuth';
const existingRole = cli(
  [
    'iam',
    'roles',
    'describe',
    'codeemySessionAuth',
    '--project=' + firebaseProject,
    '--format=value(name)',
  ],
  { optional: true },
);
if (!existingRole)
  cli([
    'iam',
    'roles',
    'create',
    'codeemySessionAuth',
    '--project=' + firebaseProject,
    '--title=CodeEmy session authentication',
    '--permissions=firebaseauth.users.get,firebaseauth.users.createSession',
    '--stage=GA',
  ]);
cli([
  'projects',
  'add-iam-policy-binding',
  firebaseProject,
  '--member=serviceAccount:' + sa,
  '--role=' + roleName,
  '--condition=None',
  '--format=none',
]);
console.log('Cloud SQL and narrowly scoped Firebase session permissions configured.');
const bindings = [];
for (const [variable, name, value] of secrets) {
  const existing = cli(
    ['secrets', 'describe', name, '--project=' + project, '--format=value(name)'],
    { optional: true },
  );
  const args = existing
    ? ['secrets', 'versions', 'add', name]
    : ['secrets', 'create', name, '--replication-policy=automatic'];
  const version =
    existing && process.argv.includes('--reuse-secrets')
      ? ''
      : cli([...args, '--project=' + project, '--data-file=-', '--format=value(name)'], {
          input: value,
          sensitive: true,
        });
  let number = version.match(/versions\/(\d+)$/)?.[1];
  if (!number) {
    number = cli([
      'secrets',
      'versions',
      'list',
      name,
      '--project=' + project,
      '--filter=state:ENABLED',
      '--sort-by=~createTime',
      '--limit=1',
      '--format=value(name)',
    ])
      .split('/')
      .pop();
  }
  if (!/^\d+$/.test(number)) throw new Error('Unable to pin secret version.');
  cli([
    'secrets',
    'add-iam-policy-binding',
    name,
    '--project=' + project,
    '--member=serviceAccount:' + sa,
    '--role=roles/secretmanager.secretAccessor',
    '--condition=None',
    '--format=none',
  ]);
  bindings.push(variable + '=' + name + ':' + number);
  console.log('Secret binding prepared: ' + variable);
}
const access = await applicationDefault().getAccessToken();
const endpoint =
  'https://identitytoolkit.googleapis.com/admin/v2/projects/' + firebaseProject + '/config';
const headers = {
  authorization: 'Bearer ' + access.access_token,
  'x-goog-user-project': project,
  'Content-Type': 'application/json',
};
let response = await fetch(endpoint, { headers });
if (!response.ok)
  throw new Error('Unable to inspect Firebase authorized domains: ' + response.status);
const firebaseConfig = await response.json();
const domains = [
  ...new Set([
    ...(firebaseConfig.authorizedDomains || []),
    'lerno.codeemy.in',
    'learnoin.netlify.app',
    'codeemy-lms-796236466632.asia-south1.run.app',
    'codeemy-lms-ro3s2c3rda-el.a.run.app',
  ]),
];
if (domains.length !== (firebaseConfig.authorizedDomains || []).length) {
  response = await fetch(endpoint + '?updateMask=authorizedDomains', {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      name: 'projects/' + firebaseProject + '/config',
      authorizedDomains: domains,
    }),
  });
  if (!response.ok)
    throw new Error('Unable to update Firebase authorized domains: ' + response.status);
}
console.log('Both live hostnames are authorized for Firebase OAuth.');
cli([
  'run',
  'services',
  'update',
  service,
  '--project=' + project,
  '--region=' + region,
  '--service-account=' + sa,
  '--update-env-vars=' +
    Object.entries(env)
      .map(([k, v]) => k + '=' + v)
      .join(','),
  '--update-secrets=' + bindings.join(','),
  '--add-cloudsql-instances=' + project + ':' + region + ':codeemy-lms-db',
  '--format=value(status.latestReadyRevisionName)',
]);
console.log(
  'Cloud Run runtime configuration deployed. No credentials were printed or embedded in the image.',
);
