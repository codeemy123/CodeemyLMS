# CodeEmy LMS — frontend completion review

Review date: October 20, 2026.

Readiness decision: **ready for local demo/UAT with live R2 file storage; not ready for real-user production use.** Latest November 1 verification: 32 unit/route checks, 48 browser checks, production build and formatting passed. Storage checks performed actual R2 uploads/downloads, generated WebM playback/range requests, signature rejection and test-object cleanup. Only loopback storage API routes were added; there is still no database, real authentication or multi-user authorization.

Student portal audit (October 20): every Student sidebar link was clicked and its route/active state checked; mobile navigation is covered by the existing suite. Incorrect demo passwords are rejected, demo sign-in opens the dashboard, password visibility toggles, and Sign out returns to the login screen. Google login and password reset explicitly report that they are not connected. Direct dashboard navigation still works without login, including after logout: no real authenticated session or server access enforcement exists yet. The notification suite verified role separation, relevant links, persistent read state and new replies becoming unread. No new application defect was found in these tested demo flows; three regression tests were added in `tests/browser/student-portal.spec.js`.

## Scope

Three roles: **Student, Mentor, Admin**, with separate Next.js App Router folders. This milestone completes the frontend workflows using browser demo storage. The user explicitly excluded database integration, real authentication/login, domain and deployment.

## Implemented workflows

| Role    | Available workflows                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student | Course/module/lesson navigation, per-course completion and progress, direct video playback when a video URL is supplied, uploaded resource previews/downloads, assignments/projects with uploaded files and revision history, mentor evaluation feedback, configurable timed assessments and attempt history, query threads/replies, PDF certificate download and local verification, career eligibility/application/resume/history/withdrawal, notifications, profile/settings. |
| Mentor  | Course lesson add/edit/remove/reorder, lesson resources, linked batch/student profiles, attendance per session and roster, individual submission evaluations with marks/decision/feedback histories, assessment configuration and single-choice/multiple-choice/short-answer question editor, question-bank reuse, query replies/resolution, announcement audience/publication histories, reports and CSV exports.                                                               |
| Admin   | Student/mentor/course/batch create/edit and activation, linked course/mentor/student batch assignments, resource library, academic briefs and assessment/question management, certificate issue/revoke/reissue/history, career eligibility and application status management, report datasets/search/CSV exports, announcement publication, profile/settings and read-only audit preview.                                                                                        |

## Cross-screen behavior

- Changes persist through navigation and refresh in the same browser using `codeemy-demo-v3` localStorage.
- Cross-role review: open tabs on the same browser/origin receive saved updates through storage events, without manually refreshing. This uses local demo snapshots and does not provide multi-device sharing or conflict-safe simultaneous writes.
- Batch assignments appear on user profiles; attendance uses the selected batch roster.
- Student/TL course lists, mentor labels and student rosters derive from current batch assignments. Reassigning a course removes it from the former TL workspace; unassigned academic detail links show an explanatory state. These frontend filters do not replace server authorization.
- Admin course/batch creation and assignment → TL lesson updates → Student lesson/progress views are browser-tested. Admin class/brief edits and TL attendance/marks flow into Student views and Admin reports. Profile contact edits are shared between account detail and personal profile views.
- Assignment/course/batch renaming preserves linked submission IDs, evaluation histories, lesson content, resources and enrollment relationships. Submission detail badges now reflect the current review decision.
- Evaluation decisions and marks appear on submission lists and the student's revision history. Reviews are keyed to individual submission IDs.
- Assessment questions/configuration edited by staff are used by the student attempt; submitted answers/results are retained locally.
- Certificate status/IDs update after revoke/reissue; downloads are actual PDF files. Verification searches the local credential dataset, including superseded IDs.
- Career application states appear in history and lists; eligibility checks the configured course progress and deadline.
- Published announcements reach the selected preview audience. Query replies/evaluation feedback create local notifications; read state persists.
- Notification review: Student receives its own assigned-course feedback, replies from the course's current mentor, application decisions, certificate updates and matching announcements. TL receives pending submissions and queries for its assigned course AND student, plus matching announcements. Admin receives applications/withdrawals and announcements explicitly addressed to All admins; Student/TL announcements no longer enter Admin's received inbox. Own publications, own student withdrawals, and already evaluated submissions are excluded from received/pending alerts. Queries now store the selected course; ambiguous legacy queries are not broadcast to multiple TLs. Read state is stored by preview role/account; individual read, mark-all-read and View update the sidebar badge, persist on refresh and stay independent across roles. Five focused unit checks and additional browser assertions cover these boundaries.
- Dashboards and progress summaries use current demo records. Some decorative streak/activity examples remain sample content.
- Emerald/champagne responsive theme, full logo display, sidebar scroll and mobile navigation. Guidance card removed.

## Validation

Student leaderboard: a dedicated sidebar route shows best completed assessment scores in descending percentage order, shared ranks for ties, top-performer cards and a full participant list. Batch choices are restricted to the preview student's current enrollments; assessment choices follow the selected batch's course. Rankings require an explicit matching result batch, course, assessment and enrolled student, preventing same-course old/new batches from mixing. Legacy results without batch attribution and interrupted attempts are excluded rather than guessed into a batch. New assessment attempts snapshot their selected batch; students enrolled in multiple batches of the same course choose the intended batch before starting. Batch renaming preserves saved result attribution, and Student name edits preserve result names. Unit tests cover filtering, invalid marks, best attempts, ties and batch rename. Browser checks cover Python batch separation, mobile overflow, actual submission-to-leaderboard flow and same-course multiple-batch selection. Results remain browser-local until database/API integration.

Assessment session update (November 1): Student sidebar order keeps Assessments directly after Assignments. Starting an assessment requires browser fullscreen and snapshots staff-configured duration, questions and pass mark. An absolute deadline drives the countdown; expiry automatically submits saved answers, closes confirmation dialogs and locks the attempt. Fullscreen exit, window blur, hidden tab, substantial viewport resize, navigation, refresh and page-close signals end the attempt with a recorded reason. Terminated attempts consume the configured allowance. A per-tab journal and synchronous local result persistence preserve interrupted attempts on reload without duplicate result IDs. Browser checks exercise timeout with a pending submission dialog, answer preservation, attempt limits, fullscreen denial and event-specific termination (visibility/focus events are simulated in headless tests). Browser signals cannot reliably identify every OS split-screen, second display or external device. These frontend preview controls require authoritative server deadlines, attempt records and grading before secure production exams.

Profile update (October 23): Student and Mentor profiles support R2-backed photo uploads (PNG/JPG/WebP/GIF, up to 5 MB) and display the saved avatar. Student personal details include an optional college name. Saved photos and college details appear on the corresponding Admin account detail view. Uploading a photo preserves unsaved personal-detail input. Dedicated browser checks cover both roles, actual R2 image loading, refresh persistence, Admin visibility and document rejection before upload. Profile metadata remains browser-local until database integration.

Admin audit: class editing preserves its existing course and date, including design classes outside the first course. Batch editing defaults to the current assignment. The content library supports editing resource titles, courses and lessons while retaining an attached R2 file. Resource detail filtering applies the assigned-course scope as well as the title. Editing an announcement preserves its existing audience, publication state and history. Dedicated Admin browser checks cover every sidebar page and demo sign-in/out, real R2 image preview, live resource edits reaching open Student/Mentor tabs, and removal from those views after course reassignment. The real R2 video playback/range test runs for both Admin and Mentor uploads.

Mentor audit: dedicated browser checks exercise demo login/logout and every sidebar link, assessment duration/pass settings and short-answer creation through Student grading back to Mentor results, scoped reports/CSV, assigned-only attendance batches, batch announcements and saved preferences. Fixed report/statistics leakage across courses and batches (including a student shared between two TLs), removed Mentor's account-creation control, disabled attendance save without an assigned session/roster and hid Student lesson-completion actions from staff. Course renaming preserves assessment-result course linkage. These are frontend preview restrictions, not server authorization.

Latest verification: **29 unit/route tests and 34 browser checks passed on October 20**, along with the production build and formatting check. Browser checks ran against the local production app, including desktop/mobile screenshots, four Mentor scenarios, five dedicated cross-role scenarios and live R2 image/video tests. Test uploads are cleaned up through their exact returned object URLs.

Use `npm test`, `npm run format:check`, `npm run build`, and `npm run test:browser` with the application running.

The unit/route suite covers route and folder consistency, CSV escaping/formula protection, PDF structure and weighted grading. Browser checks cover all primary role routes, assessment grading, attendance persistence, mobile layout/navigation, query replies, submission revisions/evaluation, question edits, batch assignments, certificate lifecycle/PDF, uploaded resources, filtered CSV reports, career applications, lesson edits/completion and announcement audience/read state.

Browser checks use installed Microsoft Edge. Set `PLAYWRIGHT_BASE_URL` when testing a port other than 3000. Desktop/mobile screenshots are generated in `artifacts/`.

## Deliberately remaining: production integration

- Database, migrations, APIs/server actions and durable shared records.
- Real login/password recovery/session handling and server-enforced role/ownership permissions.
- Domain, deployment environments, monitoring and backups.

Private file/video upload storage is now integrated with Cloudflare R2 for localhost preview; see [R2 storage](R2_STORAGE.md). Production file authorization, durable database references, authoritative grading/timers/attempt limits, certificate issuance/verification and notification delivery remain pending. UI completion does not make them secure production services. Demo role switching remains accessible without authentication.

New files upload to R2 (20 MB files, 100 MB videos); browser storage holds metadata instead of file bytes. Legacy Base64 files remain readable and are not automatically migrated. If browser storage is full/unavailable, a message explains that the latest metadata edits remain only in the open session. Different browsers/devices do not share these records. No email/SMS/meeting-provider service is connected; configured meeting URLs open external meetings. R2 preview routes are loopback-only and opt-in until real storage authorization is implemented.

## Owner inputs for the next stage

- Database/authentication/storage/hosting choices and accounts.
- Final course videos, lesson resources, batch schedules and academic records.
- Pass marks, attempts, grading rubrics, attendance and certificate eligibility policies.
- Approved certificate design, signature/issuer details and numbering policy.
- Actual career opportunities, eligibility rules and reviewers.
- Final brand approval: supplied logo says CodeEmy Technologies; project brief says CodeEmy Edutech.

## Preview

Run `npm run dev` and open `/student/dashboard`, `/mentor/dashboard`, or `/admin/dashboard`. The sidebar dropdown changes preview roles. Login screens are visual previews only. For the production build locally, run `npm run build` followed by `npm start`.
