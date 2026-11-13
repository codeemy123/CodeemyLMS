# Admin management review — 13 November 2026

Live target: https://lerno.codeemy.in. `node scripts/verify-admin-management.mjs --live` passed with isolated Firebase/Cloud SQL fixtures; all test records/files were cleaned up.

- Admin create/edit/remove actions verified for announcements, courses, classes, modules, lessons, resources, projects, assessments/questions/options, certificates and career opportunities.
- Student and Mentor account edit, deactivate and reactivate verified; deactivation blocks an existing authenticated session at the backend. Account removal is access removal, preserving academic history.
- Targeted announcement editing updates the Student notification; removal removes the associated notification.
- Student/Mentor attempts to use Admin management endpoints were denied.
- Linked courses/classes/assignments and assessment question/answer changes after attempts are protected. Existing results and attendance are not silently erased.
- Admin identities and audit logs cannot be edited/deleted using generic resource controls. Firebase identities, passwords and role changes are not exposed through ordinary account editing.
- All 18 previously visible Admin routes loaded in the live browser audit, and browser announcement create/edit/remove passed. Missing direct sidebar links to existing **Classes** and **Attendance** routes were added, bringing the menu to 20 entries; production build passed.

Student/Mentor account editing currently supports full name, phone and account status. Registration approval, batch assignment, evaluations, certificate revoke/reissue and assessment retry review use their dedicated Admin workflows. This audit does not claim unrestricted database access, arbitrary role promotion or destructive deletion of academic/audit history.
