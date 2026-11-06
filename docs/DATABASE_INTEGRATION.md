# Database integration work in progress

The existing 28-table Cloud SQL schema is represented in Prisma. The runtime helper uses the PostgreSQL adapter, a pooled lazy singleton and the application DATABASE_URL. Prisma CLI can use a separate MIGRATION_DATABASE_URL for database-owner/migration operations.

## Preserved data and baseline

Before integration, a custom-format pg_dump, schema SQL, table counts and check constraints were saved in the ignored `artifacts/database-before-integration` folder. All 28 tables were empty at the time of this snapshot.

The Admin dashboard also offers Download workspace backup. It downloads the current browser workspace as JSON without clearing or changing it. This backup is not an automatic database import; keep it for the reviewed identity/relationship mapping stage.

`prisma/migrations/00000000000000_baseline/migration.sql` captures the actual database schema, including its 11 check constraints. Its creation statements must NOT be replayed on the original database. The intended existing-database registration is:

```sh
npx prisma migrate resolve --applied 00000000000000_baseline
npx prisma migrate status
```

Registration is currently BLOCKED: the application user has no CREATE permission on schema public. No application tables were reset or dropped. Configure a database-owner/migration connection privately as MIGRATION_DATABASE_URL, then register the baseline. Keep DATABASE_URL restricted to the runtime application account.

## Implemented API foundation

All database endpoints verify a Firebase bearer ID token or HttpOnly session cookie, then load role and active status from users by verified Firebase UID. Client role headers never grant access. Writes require same-origin JSON requests. No unauthenticated database preview route was added.

| Route                              | Operation                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `/api/auth/config`                 | Public runtime configuration; Firebase web config is public, never Admin credentials |
| `/api/auth/session`                | Create a session from a recent Firebase ID token; clear session cookie               |
| `/api/auth/me`                     | Current provisioned database user                                                    |
| `/api/courses`                     | Scoped course list; Admin-only creation                                              |
| `/api/courses/[id]`                | Assigned-course read; Admin-only updates                                             |
| `/api/class-sessions`              | Assigned class sessions                                                              |
| `/api/attendance`                  | Own/assigned attendance read; Admin/Mentor batch-validated writes                    |
| `/api/submissions`                 | Own/assigned assignment submissions                                                  |
| `/api/submissions/[id]/evaluation` | Admin/Mentor evaluation with maximum marks and course/student/batch checks           |
| `/api/notifications`               | Own notifications/unread count and own read-state updates                            |

Attendance changes and evaluations generate Student notifications atomically in the same transaction. Request payloads cannot choose another notification owner. Database errors return sanitized messages.

## Verification

`node scripts/check-db-services.mjs` exercises course scope, attendance, marks and notifications against Cloud SQL inside a transaction that is deliberately rolled back. It leaves no test users, courses, submissions or notifications behind. Unit tests exercise role/scope/validation boundaries; API browser checks cover anonymous and cross-origin denial.

## Not complete yet

- Firebase APIs were not enabled on the GCP project when checked. The account owner must finish Firebase setup and supply the web app configuration plus the initial user's verified Firebase UID/DB provisioning.
- Baseline registration needs a migration-capable database connection.
- Existing frontend screens still use their browser preview data. They have NOT been silently switched to empty database tables, and localStorage/sessionStorage have NOT been cleared or imported.
- Frontend/API wiring and reviewed localStorage import remain required after Firebase identity mapping and migration setup are available.
- Remaining workflows (including revisions, question answers/snapshots, career applications and certificate history) need schema/API coverage before a full cutover.
- The Docker builder generates Prisma Client without requiring a database secret at build time. Deploy only after runtime Firebase and database configuration are ready.

Do not describe this foundation as a completed production migration or real-user launch.

## Authentication implementation update

- `/login` supports Firebase email/password, Google popup sign-in and password reset. Tokens stay in Firebase in-memory persistence and are exchanged for the existing HttpOnly session cookie; temporary Firebase state is signed out after exchange.
- Server Proxy verifies session and active database role for every Student/Mentor/Admin portal request. Anonymous/invalid sessions redirect to login; another role redirects to its own dashboard. Production cannot opt out with the local preview flag.
- Sidebar role selector removed; logout must clear the server session before navigation.
- Admin dashboard has account activation form. `/api/admin/accounts` verifies the Firebase UID with Admin SDK before mapping only STUDENT or MENTOR; existing identities/permissions are preserved on conflict.
- Build, 36 unit tests and 3 browser authentication checks passed. Browser checks cover anonymous/forged sessions, login UI, anonymous provisioning rejection, and cookie removal. They do not prove successful provider authentication or authenticated cross-role redirects.
- Local Firebase Admin credential probe currently fails `app/invalid-credential`. Application Default Credentials and cross-project Firebase Auth permissions must be configured before real session issuance and UID lookup can work. Use `gcloud auth application-default login` locally; on Cloud Run use its service account with appropriate Firebase Auth permissions in `codeemylms`. Do not copy private keys into client config.
- Actual Google account login, successful server cookie issuance, authenticated role redirects, and account activation need live verification after credentials are available. Firebase Google account selection requires the user's interaction.
- The workspace business screens still use mock/localStorage workflows and hardcoded profile identities in several places. Authentication does not complete database UI migration. Do not release to real users yet.
- Local auth review server: http://127.0.0.1:3004/login . Changes are not deployed to Cloud Run.

## Verified database screen cutover

The following pages now use authenticated database APIs: dashboard, course list/course edit (Admin), students/mentors directory, batch creation/membership (Admin), class list/scheduling (Admin), attendance (Admin/Mentor), assignments/create/submit/evaluate, profile name/phone/photo, and notifications/read status. Student assignment resubmission is explicitly rejected to preserve existing work until revision history is implemented. Course lessons are currently listed only; full lesson editing/player/progress cutover remains pending.

Production R2 routes now require an active Firebase/DB actor. Upload metadata is registered in audit_logs; failed metadata registration triggers removal of that newly uploaded object. Downloads require ownership, Admin access, assigned course access, or an assigned mentor reading a submitted assignment attachment. Signed object URLs alone do not grant access. Deletion requires owner/Admin access and same-origin checks. Legacy unregistered objects are intentionally denied until reviewed metadata import.

Baseline `00000000000000_baseline` was registered as applied after a no-difference Prisma check. No baseline SQL was replayed. `codeemy_app` CREATE privilege was subsequently revoked and verified false.

Real Firebase integration tests create isolated random test users, sign in via Firebase password Auth, issue HttpOnly sessions, and check all three portal roles and cross-role redirects. They also check batch/class/course/assignment APIs, attendance/grading, private notifications, profile persistence, R2 access and logout, then delete only test fixtures. The automated test uses password sign-in; successful end-user Google OAuth sign-in is still a separate interactive check. Google's account chooser has been verified reachable.

### Release remains incomplete

Pending: assessments/server attempt deadline and grading cutover, leaderboard, projects, lesson content/media management and progress, resources, queries/feedback/announcements, certificates/career/report/audit workflows, submission revisions, college/location persistence, existing browser data import and full portal acceptance. Unconverted workflow screens display a preview notice and still use browser fixtures. Do not treat them as production records.

Read-only Cloud Run audit found runtime env names only NODE_ENV, Database, Username, Instance, Region. Required DATABASE_URL/Firebase/R2 configuration is absent. Cloud SQL instance attachment exists. Latest ready revision was codeemy-lms-00006-j4w. Runtime secret configuration, cross-project Firebase service-account permissions, fresh image/deployment and live verification remain necessary. Local ADC files must never be copied into the image. No Cloud Run deployment was performed during this cutover.

## Registration and administrator approvals

- Public `/register` supports Student/Mentor requests using Firebase email/password or Google identity. No public Admin role is accepted. The server takes email/UID from a verified Firebase ID token rather than applicant-supplied identity fields.
- New requests create an INACTIVE users row. Existing users/roles are never overwritten. Passwords stay in Firebase and are never stored in PostgreSQL request details.
- Registration details (college/institution, qualification, phone, applicant note, original email verification state) are stored in a REGISTRATION_REQUESTED audit event linked to that user. This uses the existing users/audit_logs schema; no destructive migration or new schema privileges are needed.
- `/admin/approvals` shows pending, approved and rejected requests, search, details and reviewer/reason history. Active administrators receive in-app notifications; the sidebar pending count and list refresh every 30 seconds.
- Approve verifies the current Firebase identity and activates the existing requested Student/Mentor role. Reject leaves the user inactive and requires a reason. Decisions are separate audit events; row locking prevents concurrent decisions. Repeated decisions return 409. Rejected users see their reason on sign-in; pending users see a pending approval message. No portal session is issued until ACTIVE.
- Existing manual administrator activation remains available for deliberately provisioned accounts; it cannot overwrite a submitted registration. Existing active accounts do not need reapproval.
- `node scripts/verify-registration-approvals.mjs` passed with real Firebase and GCP PostgreSQL: browser Student registration, blocked pending access, Admin browser approval, allowed Student login, blocked role escalation/self-approval, duplicate prevention, Mentor rejection/reason, administrator notifications and responsive desktop/mobile review pages. Test accounts/requests/notifications were removed. This test does not complete an interactive Google OAuth login.
- This feature is locally available on port 3004; deployment is separate.
