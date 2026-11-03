# CodeEmy Next.js project — folder guide

This project uses **Next.js App Router, JavaScript, React, and CSS**. All three roles have separate route folders. The shared shell and components keep the design consistent.

This stage is frontend only. `data/mock` contains sample data. There are no API handlers, database connections, authentication guards, or migrations.

## 1. Overall structure

```text
codeemyLMS/
├── src/
│   ├── app/                         Next.js URLs, layouts, loading/error pages
│   │   ├── layout.js                Root HTML layout and global CSS
│   │   ├── page.js                  Redirects / to /student/dashboard
│   │   ├── globals.css              Shared responsive design system
│   │   ├── loading.js               Real Next.js loading boundary
│   │   ├── error.js                 Real Next.js error boundary
│   │   ├── not-found.js             404 page
│   │   └── (workspace)/             Route group; absent from the URL
│   │       ├── layout.js            Shared sidebar/header and mock-state provider
│   │       ├── student/             Only Student URLs
│   │       ├── mentor/              Only Mentor URLs
│   │       └── admin/               Only Admin URLs
│   ├── components/
│   │   ├── layout/                  Sidebar, topbar, workspace shell/dialog
│   │   ├── forms/                   Shared form fields
│   │   └── ui/                      Button, badge, progress bar, statistic cards
│   ├── features/                    Screen implementation by responsibility
│   │   ├── student/components/      Student dashboard entry and mentor queries
│   │   ├── mentor/components/       Mentor dashboard entry and attendance
│   │   ├── admin/components/        Admin dashboard entry
│   │   ├── auth/components/         Login preview
│   │   ├── dashboard/components/    Shared dashboard widgets
│   │   ├── courses/components/      Course list, card, course/lesson screen
│   │   ├── assessments/components/  Instructions, attempt, timer, result
│   │   ├── management/components/   Shared record tables and detail workflows
│   │   ├── notifications/components/ Notification list
│   │   ├── profile/components/      Profile and settings screens
│   │   ├── reports/components/      Progress/performance/report views
│   │   └── workspace/context/       Frontend mock state shared across navigation
│   ├── config/
│   │   ├── navigation.js            Different sidebar items for each role
│   │   └── routes.js                URL section → screen-name mapping
│   ├── data/mock/lms.js             Initial course, student, table fixtures
│   └── lib/routes.js                URL helpers and mock record lookup
├── docs/
│   ├── PROJECT_STRUCTURE.md         This guide
│   └── DATABASE_SCHEMA.md           Proposed future tables/columns; no implementation
├── tests/routes.test.mjs            Routing and folder consistency checks
├── jsconfig.json                   @/* points to src/*
├── package.json                    Dependencies and npm commands
├── package-lock.json               Reproducible dependency versions
├── .prettierrc.json                 Consistent code formatting
├── .prettierignore
├── .gitignore
└── README.md
```

`src` means source code. `app` decides the URL. `features` contains the actual screen UI. `components` contains reusable pieces. `config` contains navigation settings. `data/mock` contains sample data. `lib` contains small shared helper functions.

## 2. Student folders

```text
src/app/(workspace)/student/
├── layout.js
├── page.js                         /student → /student/dashboard
├── dashboard/page.js
├── login/page.js
├── courses/page.js
├── courses/[id]/page.js            Course details + lessons/material/activity tabs
├── classes/page.js
├── classes/[id]/page.js
├── materials/page.js
├── materials/[id]/page.js
├── assignments/page.js
├── assignments/[id]/page.js        Details + submission + feedback
├── assessments/page.js
├── assessments/[id]/page.js        Instructions → attempt → result
├── projects/page.js
├── projects/[id]/page.js           Details + GitHub/demo submission
├── progress/page.js
├── mentor/page.js                  Mentor profile + queries
├── certificates/page.js
├── certificates/[id]/page.js       Preview + mock verification/download
├── career/page.js
├── career/[id]/page.js             Opportunity + application dialog
├── notifications/page.js
├── profile/page.js
└── settings/page.js
```

Example: `/student/courses/full-stack-web-development` opens the course screen. `[id]` means a dynamic URL segment. Mock IDs currently use readable title slugs; real backend IDs can replace them later.

## 3. Mentor folders

```text
src/app/(workspace)/mentor/
├── layout.js
├── page.js
├── dashboard/page.js
├── login/page.js
├── students/page.js
├── students/[id]/page.js
├── courses/page.js
├── courses/[id]/page.js            Content, lessons, materials management
├── classes/page.js
├── classes/[id]/page.js            Class details/manage dialog
├── attendance/page.js
├── assignments/page.js
├── assignments/[id]/page.js        Submission review/evaluation dialogs
├── assessments/page.js
├── assessments/[id]/page.js        Questions, settings, results UI
├── projects/page.js
├── projects/[id]/page.js           Submission review/evaluation
├── performance/page.js
├── feedback/page.js
├── feedback/[id]/page.js
├── announcements/page.js
├── announcements/[id]/page.js
├── notifications/page.js
├── profile/page.js
└── settings/page.js
```

## 4. Admin folders

```text
src/app/(workspace)/admin/
├── layout.js
├── page.js
├── dashboard/page.js
├── login/page.js
├── students/page.js
├── students/[id]/page.js
├── mentors/page.js
├── mentors/[id]/page.js
├── courses/page.js
├── courses/[id]/page.js
├── batches/page.js
├── batches/[id]/page.js            Student/mentor assignment dialogs
├── content/page.js
├── content/[id]/page.js
├── classes/page.js                Schedule link from the shared dashboard
├── classes/[id]/page.js
├── attendance/page.js             Attendance link from class details
├── assignments/page.js
├── assignments/[id]/page.js
├── assessments/page.js
├── assessments/[id]/page.js
├── question-bank/page.js
├── question-bank/[id]/page.js
├── projects/page.js
├── projects/[id]/page.js
├── certificates/page.js
├── certificates/[id]/page.js
├── career/page.js
├── career/[id]/page.js
├── reports/page.js
├── notifications/page.js
├── announcements/page.js
├── announcements/[id]/page.js
├── settings/page.js
├── profile/page.js
├── audit-log/page.js
└── audit-log/[id]/page.js
```

Create/edit/apply/evaluate are currently dialogs inside the relevant section. They have not been turned into separate URLs merely to duplicate the same UI.

## 5. How a page works

```text
/student/courses
    ↓
src/app/(workspace)/student/courses/page.js
    ↓ imports
src/features/courses/components/course-list.js
    ↓ uses
src/features/courses/components/course-card.js
    ↓ reads frontend context
src/features/workspace/context/workspace-context.js
    ↓ initial state from
src/data/mock/lms.js
```

`page.js` files remain short. They choose the screen. Role-specific dashboard files let you customize one role without changing its route. Shared module components are reused because course, table, and form UI should remain consistent.

Server Components are the default for layouts and route entry files. Components that use React state, event handlers, or context use `'use client'`. Keep that directive at the top of the component file.

The workspace provider lives in a persistent parent layout. Mock edits survive navigation between these routes, but a full refresh resets mock state. URL, browser Back/Forward, and direct links use Next.js navigation instead of hash-based routing.

## 6. How to add a page later

1. Add the feature screen to `src/features/<module>/components/`.
2. Create `src/app/(workspace)/<role>/<section>/page.js` and import it.
3. Add the URL section to that role in `src/config/routes.js`.
4. Add a sidebar entry in `src/config/navigation.js` if it is a primary section.
5. For a record detail screen, add `[id]/page.js` below the section folder.
6. Keep mock fixtures in `src/data/mock/`, not inside route files.
7. Run `npm test`, `npm run format:check`, and `npm run build`.

Example import:

```js
import CourseList from '@/features/courses/components/course-list';

export default function StudentCoursesPage() {
  return <CourseList />;
}
```

`@/` is an alias for `src/`. It avoids long imports such as `../../../../../components/...`.

## 7. When backend work is approved

Choose the database/ORM and authentication approach first. Then add a server-only data layer, validated request handlers or server actions, and database migrations. Replace the mock fixtures at feature boundaries. Protect every server read/write by role and enrollment ownership.

The current folder split is organization only: it does **not** enforce permissions. A Student can visit the Admin preview today because this is an intentionally unauthenticated frontend demo.

Do not create placeholder API routes or database tables until the frontend review and backend decision are complete. The proposed data model is in [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).
