# Mentor verification — 12 November 2026

Target: https://lerno.codeemy.in. Tests used disposable Firebase identities and isolated Cloud SQL records; fixtures and uploaded files were removed. Database-only scope checks ran inside a rolled-back transaction.

| Page / workflow        | Result                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Login, session, logout | Real Firebase email login passed; logout removes access.                                                                        |
| Dashboard              | Live authenticated page passed without API/browser errors.                                                                      |
| Students               | Live page passed; roster API is restricted to assigned students.                                                                |
| Courses                | Assigned course read and authenticated browser rendering passed.                                                                |
| Classes                | Live page passed. Class creation remains Admin-only. Actual Zoom automation is pending.                                         |
| Attendance             | Mentor update persisted; Student received attendance notification. Unauthorized update blocked.                                 |
| Assignments            | Student submission → Mentor marks/feedback → Student notification passed; duplicate submission blocked.                         |
| Assessments            | Assigned assessment rendering and written-answer evaluation passed; server score and batch leaderboard updated.                 |
| Projects               | Student submission → Mentor evaluation → persisted Student score passed.                                                        |
| Performance            | Live page passed; database checks confirmed exact-batch lesson completion scope and denied Student report access.               |
| Feedback / queries     | Student question → assigned Mentor reply/resolution passed; cross-user access denied.                                           |
| Announcements          | Live page passed; published assigned-batch notices visible, drafts and unrelated batch notices hidden in database scope checks. |
| Notifications          | User-scoped inbox verified; Student notifications do not appear in Mentor inbox.                                                |
| Profile                | Name/phone DB persistence, R2 photo upload, reload, removal, white background and mobile layout passed.                         |

All 13 Mentor top-level pages returned HTTP 200 with no observed browser errors, API failures or horizontal desktop overflow. Dashboard, Assignments and Profile also passed 390px mobile overflow checks. Mentor Admin API access returned 403; `/api/auth/me` returned 401 after logout.

Commands: `node scripts/audit-mentor-live.mjs`, `node scripts/verify-authenticated-roles.mjs --live`, `node scripts/verify-learning-api.mjs --live`, `node scripts/verify-profiles.mjs --live`, `node scripts/verify-learning-workflows.mjs`.

An old integration test attempted to resume an assessment before grading it. It was updated to match the current one-time attempt policy; the repeat-entry result is checked after submission and preserves its marks. No application defect was found in this audit, so no application deployment was needed.

Limits: these checks cover representative populated workflows and top-level pages, not every possible input/device. No new real Google consent flow, real paid Zoom recording session, or 1,000-user load test was performed in this review.
