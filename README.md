# CodeEmy LMS

Next.js 16 App Router frontend for **Student, Mentor, and Admin**, with separate role folders, shared components, responsive styling, and realistic mock data.

## Start

```sh
npm install
npm run dev
```

Open http://localhost:3000. The home page redirects to the Student dashboard.

| Role    | Dashboard            | Login preview    |
| ------- | -------------------- | ---------------- |
| Student | `/student/dashboard` | `/student/login` |
| Mentor  | `/mentor/dashboard`  | `/mentor/login`  |
| Admin   | `/admin/dashboard`   | `/admin/login`   |

Use the sidebar dropdown to change preview roles. Direct URLs, browser Back/Forward, and page refresh use actual Next.js routes.

## Project guide

```text
src/app/(workspace)/student/   Student pages and layout
src/app/(workspace)/mentor/    Mentor pages and layout
src/app/(workspace)/admin/     Admin pages and layout
src/components/               Shared layout, forms and UI pieces
src/features/                 Actual module screens and frontend context
src/config/                   Role navigation and route configuration
src/data/mock/                Mock fixtures
src/lib/                      Route helpers
docs/                         Architecture and proposed database documentation
tests/                        Navigation/folder consistency tests
```

Read [the folder guide](docs/PROJECT_STRUCTURE.md) for every role's folder tree and how to add a page. Read [the database proposal](docs/DATABASE_SCHEMA.md) for the 51 proposed tables, columns, types, foreign keys, constraints, and relationships.

Read [the current project review](docs/PROJECT_STATUS.md) for completed frontend workflows, production integration tasks and the information needed from the academy owner. Shared premium styling lives in `src/styles/premium.css`.

## Verify and build

```sh
npm test
npm run format:check
npm run build
npm start
```

With the app running, use `npm run test:browser` to check primary role screens, assessment grading, attendance persistence and mobile navigation in installed Microsoft Edge. Screenshots are saved to `artifacts/`.

Use `npm run format` to format source code and documentation.

## Current scope

Frontend demo plus local-only Cloudflare R2 storage API integration. No database, real authentication, payment, meeting-provider integration, or real-time chat service has been implemented. The database document is a proposal for the later backend stage. See [R2 storage](docs/R2_STORAGE.md) for connected uploads and the local-preview security boundary.

Forms, queries, submissions/revisions, evaluations, linked batches, applications, preferences and notifications use browser demo state, persisted across navigation and refresh using localStorage. New attachments, images and lesson videos are uploaded to private R2 storage; only their metadata/links remain in the demo records. Files are limited to 20 MB, videos to 100 MB. Existing Base64 files are not automatically migrated. Different browsers/devices do not share the LMS catalog. Login is a visual preview; role folders do not provide access control. Development and local production preview bind to loopback only.

Course content supports direct video URLs and uploaded resource previews/downloads. Certificates download as actual PDF previews with local verification and revoke/reissue history. Assessments support editable single/multiple-choice and short-answer questions, weighted marks, duration/pass/attempt settings, timer/review markers and retained local results. Reports export selected filtered datasets as CSV. Footer controls demonstrate loading, empty, and error states; Next.js loading, error, and not-found boundaries are also present.
