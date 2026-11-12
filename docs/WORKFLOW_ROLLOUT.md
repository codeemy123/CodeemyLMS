# Learning workflow rollout

This branch adds database-backed learning/progress, projects/evaluation, mentor query routing, announcements, server-timed assessments and written evaluation, batch leaderboard, certificates/PDF/revoke/reissue audit history, career applications and college profile editing. Zoom recording ingestion is implemented but requires account credentials and a deployed transfer worker before real use.

## Apply migrations before deploying this code

Set `MIGRATION_DATABASE_URL` privately in `.env.local` to a migration-owner connection. Keep `DATABASE_URL` using the limited application account. The two URLs must target the same PostgreSQL database/schema. Do not grant schema CREATE permanently to the runtime account.

Run `npx prisma migrate deploy` using the existing baseline history. Never reset the database or replay the baseline SQL. New migrations add a college column, career applications, and Zoom class links/recording jobs. Grants are scoped to the new tables. Deployment before these migrations will break the new profile/career/recording queries.

Regenerate the Prisma client with `npx prisma generate`. Keep migration-owner credentials out of the Cloud Run runtime and out of Git.

## Zoom setup

The company account needs licensed hosts and cloud recording enabled. Create a Zoom Server-to-Server OAuth app for that company account. Give it the recording read/download and host-user lookup permissions shown in the Zoom Marketplace for these endpoints. Activate the app. Use these environment names on the web service/worker as applicable:

```
ZOOM_ACCOUNT_ID=
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
ZOOM_WEBHOOK_SECRET=
```

Store client/webhook secrets in Secret Manager. The worker also needs the existing DATABASE_URL, R2 endpoint/bucket/access key/secret. Do not put any Zoom credentials in NEXT_PUBLIC variables.

Set the webhook URL to `https://codeemy-lms-796236466632.asia-south1.run.app/api/zoom/webhook` and subscribe to `recording.completed`. The endpoint validates the signature/time/account and persists MP4 jobs; it never transfers a video in the webhook request. Subscribe to users in the company account. Personal unrelated Zoom accounts are not covered by this S2S app.

In Classes, choose Find Zoom recordings, select the completed class by title/date, then sync. Internally the exact meeting occurrence UUID is linked to that class, so recurring meetings and batch names cannot be confused. A mentor can connect only recordings hosted by their own Zoom email; Admin can link company recordings. Meeting IDs/titles are not used as batch identifiers. If a webhook arrived before linking, Sync discovers those recordings. Mentor Publish queues the transfer; students see only READY recordings for their batch.

Build the worker with `Dockerfile.worker`. Set `WORKER_TASK=recordings` for the recording job. Create a second job from the same image with `WORKER_TASK=assessments` and schedule it every minute to finalize expired attempts even when a student never reconnects. Deploy it as a Cloud Run Job with one task, parallelism 1, a suitable execution timeout (up to one hour for this implementation), and at least 512 MiB memory. Execute it every minute with Cloud Scheduler using authenticated Jobs execution and a dedicated scheduler service account with only permission to execute this job. Do not deploy it as an HTTP service. Each execution claims at most one queued job; the PostgreSQL lease prevents duplicate transfers from overlapping executions. Retry failed transfers through the mentor Publish UI (maximum five attempts). Monitor FAILED/expired leases and billing before increasing parallelism.

Downloads are streamed into 8 MiB R2 multipart parts, with a 20 GiB recording limit. Zoom originals are retained. Downloads requiring redirects or a non-zoom.us host currently fail closed; validate the actual download host for your account before widening an allowlist. No DRM, transcoding, adaptive bitrate, or prevention of screen capture is provided.

## Assessment behavior and limitations

Each student gets one attempt per assessment. The server locks start/submit operations, derives the deadline from persisted start time and the scheduled end, rejects answers arriving after the deadline, hides correctness, grades choices on the server and retains written answers for an assigned mentor. Once attempts exist, Admin management locks the assessment/questions/options.

The browser saves every five seconds and submits on visibility/fullscreen changes. Browser checks are deterrents, not proof of cheating or a secure proctoring system. Browser crashes/network loss cannot guarantee delivery; the server deadline still applies when the student reconnects. Expired abandoned attempts are finalized on resume or by the scheduled assessment job. Deploy that job before high-stakes exam use. This implementation does not claim reliable split-screen detection across devices.

Certificate PDFs use the existing simple template and ASCII text support; names outside ASCII require a font-embedded PDF implementation before those names can be issued correctly. Download uses current DB ownership/revocation; external copies already downloaded cannot be recalled. Reissue creates a fresh certificate number and retains the history event. Eligibility is still an administrator decision.

## Verification

`npm test`, `npm run build`, and `npx prisma validate` are offline/source checks. `node scripts/verify-learning-workflows.mjs` uses a transaction with real Cloud SQL fixtures and rolls them all back; it checks learning persistence, project evaluation, query ownership, assessment grading/resume and late-answer rejection. For a temporary proxy port set TEST_DB_PROXY_PORT without modifying runtime secrets.

College/career/Zoom table tests require the new migrations first. Actual Zoom OAuth/webhook/download/playback requires real account configuration. Do not label those external flows tested merely because unit tests pass. Repeat authenticated browser tests after migrations and deployment.

## Live infrastructure check (12 November 2026)

Cloud Run still reports Ready on the previously deployed revision. However, live requests return server errors and infrastructure logs report disabled billing. The project billing link is enabled, while the linked billing account reports `open: false`. The account owner must reopen that account or link a suitable active billing account before live verification/deployment. No billing settings were changed by this work.

Current local verification: 44 unit tests and production build passed. Real Cloud SQL rollback tests passed for progress, scoped mentor performance, project evaluation, query routing and assessment deadlines/grading. Authenticated Student/Mentor browser checks, actual fullscreen exam start/answer/submit, mentor written grading, Admin-created content reflection and certificate revoke/reissue API checks passed. Real R2 9 MiB multipart upload and byte-range reads passed, with the test object removed. New migration-dependent college/career/Zoom-table checks and actual Zoom account ingestion remain unverified until configuration is supplied.
