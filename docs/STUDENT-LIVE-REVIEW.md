# Student portal live review — 12 November 2026

Tested https://lerno.codeemy.in against the GCP backend, Cloud SQL, Firebase and private Cloudflare R2 storage using isolated temporary accounts and content.

## Page-by-page results

| Student page | Verified live | Result |
| --- | --- | --- |
| Dashboard | Assigned course/class/update APIs, navigation, responsive layout | Passed |
| My Courses | Admin course/batch assignment reaches Student; published modules/lessons load | Passed |
| Classes | Assigned sessions and playable private R2 recording; byte-range seeking; unrelated student denied | Passed |
| Learning Materials | Assigned material list and resource link rendering | Passed |
| Assignments | Browser submission persists; duplicate submission denied; mentor marks/feedback reach Student | Passed |
| Assessments | Browser fullscreen attempt/submission, hidden answer keys, server scoring, written-answer evaluation, expired attempt ignores late answers | Passed |
| Leaderboard | Assessment score appears in the correct batch ranking | Passed |
| Projects | Submission/repository link persists; mentor evaluation; Student cannot award marks | Passed |
| Progress | Completion toggle persists; actual video plays; paused position saves and resumes after reload | Passed |
| Mentor | Student query, mentor reply and resolved status persist | Passed |
| Certificates | Student ownership, PDF download, Admin-only revoke/reissue, revoked download blocked | Passed |
| Career | Browser application, DB persistence, Admin review/feedback, withdrawal, unassigned student denied | Passed |
| Notifications | Attendance/evaluation notifications, user-scoped inbox and read status | Passed |
| Profile | Page load; recent live checks also cover name/phone/college/department saves, registration ID/date and photo upload/reload/removal | Passed |

All 14 Student routes returned HTTP 200 with zero observed API/browser runtime errors and no desktop horizontal overflow. Dashboard, Assignments and Profile were also checked at 390px width. Student access to Admin APIs returned 403; logout cleared the session and `/api/auth/me` returned 401.

## Issue resolved during this review

Career returned HTTP 500 because `career_applications` did not exist. The owner executed `docs/STUDENT-WORKFLOW-SETUP.sql`, adding that table and the recording tables with runtime grants. The repeat audit and actual Career application workflow passed. No student/course data was reset.

## Test evidence

- `scripts/audit-student-live.mjs`: all 14 Student routes, mobile samples, access denial and logout; detailed output in ignored `artifacts/student-live-audit.json`.
- `scripts/verify-authenticated-roles.mjs --live`: real login, role boundaries, course/batch/class updates, attendance, assignment evaluation, scoped notifications, private uploads and profile.
- `scripts/verify-learning-api.mjs --live`: real learning workflows, project/query persistence, grading/batch ranking, certificate lifecycle and browser assessment.
- `scripts/verify-student-outcomes.mjs`: browser Career lifecycle, playable recording, batch privacy, lesson resume, browser assignment feedback and expired exam enforcement.

Temporary identities, courses, batches, assignments, applications and uploaded test files were removed. The expiry test moved only its temporary attempt into the past; it did not wait 45 minutes or alter a real exam.

## Remaining boundaries

- Recording playback was tested using a generated WebM fixture uploaded to R2. Paid Zoom host setup, actual meeting capture/import and the recording worker schedule still need an end-to-end run with the real Zoom account.
- This audit used temporary email/password accounts; it did not complete a fresh real Google-account consent flow.
- Fullscreen behavior is browser-based; arbitrary OS split-screen activity cannot be guaranteed to be detectable.
- A 1,000-concurrent-student load test, backup restore exercise and unattended background-job monitoring were not part of this functional audit.

Core Student workflows are suitable for a controlled pilot with real assigned content. Complete the remaining operational checks before a large-scale launch.
