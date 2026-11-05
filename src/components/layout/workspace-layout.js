'use client';
import DatabaseAssignments from '@/features/database/assignments';
import DatabaseDashboard from '@/features/database/dashboard';
import DatabasePeople from '@/features/database/people';
import DatabaseBatches from '@/features/database/batches';
import DatabaseCourses from '@/features/database/courses';
import DatabaseAttendance from '@/features/database/attendance';
import DatabaseClasses from '@/features/database/classes';
import { logout } from '@/features/auth/client';
import Topbar from '@/components/layout/topbar';
import Sidebar from '@/components/layout/sidebar';
import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { BookOpen, CalendarDays, X } from 'lucide-react';
import { resolveWorkspaceRoute, workspaceHref } from '@/lib/routes';
import { initialCourses, initialRows, initialStudents } from '@/data/mock/lms';
import { WorkspaceContext } from '@/features/workspace/context/workspace-context';
import { Button } from '@/components/ui';
import CourseCard from '@/features/courses/components/course-card';
import StatGrid from '@/components/ui/stat-grid';
import FormFields from '@/components/forms/form-fields';
import WorkspaceDialog from '@/components/layout/workspace-dialog';
import { initialWorkflows, defaultQuestions } from '@/data/mock/workflows';
import { workspaceNotifications } from '@/lib/notifications';
import { validateExternalUrl } from '@/lib/urls';
import { workspaceView } from '@/lib/workspace-view';
import { renameWorkflow } from '@/lib/workspace-renames';
import useAssessmentAttempt from '@/features/assessments/use-assessment-attempt';

export default function WorkspaceLayout({ children }) {
  const [actor, setActor] = useState(null);
  const [today, setToday] = useState('');
  useEffect(() => {
    setToday(
      new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(new Date()),
    );
  }, []);
  useEffect(() => {
    const refresh = () =>
      fetch('/api/auth/me', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => setActor(data?.user || null))
        .catch(() => {});
    refresh();
    window.addEventListener('codeemy-profile-updated', refresh);
    return () => window.removeEventListener('codeemy-profile-updated', refresh);
  }, []);
  const router = useRouter();
  const pathname = usePathname();
  const [courses, setCourses] = useState(() => structuredClone(initialCourses));
  const [students, setStudents] = useState(() => [...initialStudents]);
  const [mentors, setMentors] = useState(['Arjun Kumar', 'Priya Sharma', 'Rahul Verma']);
  const [baseRows, setBaseRows] = useState(() => structuredClone(initialRows));
  const [workflows, setWorkflows] = useState(() => structuredClone(initialWorkflows));
  const [demoLoaded, setDemoLoaded] = useState(false);
  const lastCache = useRef(null);
  const { role, page, detail } = resolveWorkspaceRoute(
    pathname,
    courses,
    baseRows,
    students,
    mentors,
  );
  const [tab, setTab] = useState('All'),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('All'),
    [current, setCurrent] = useState(1),
    [mobile, setMobile] = useState(false),
    [toast, setToast] = useState(''),
    [modal, setModal] = useState(null),
    [records, setRecords] = useState({}),
    [lesson, setLesson] = useState(0),
    [viewState, setViewState] = useState('Ready');
  const {
    question,
    setQuestion,
    answers,
    setAnswers,
    review,
    setReview,
    attempt,
    setAttempt,
    result,
    setResult,
    seconds,
    setSeconds,
    startAssessment,
    finishAssessment,
    assessmentOutcome,
    startingAssessment,
    attemptQuestions,
  } = useAssessmentAttempt({
    pathname,
    role,
    detail,
    workflows,
    setWorkflows,
    demoLoaded,
    setModal,
    notify: setToast,
  });
  const [notifications, setNotifications] = useState([]);
  const [notificationError, setNotificationError] = useState('');
  async function loadNotifications() {
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotifications(
        data.notifications.map((n) => ({ ...n, description: n.message, page: 'Notifications' })),
      );
      setNotificationError('');
    } catch (error) {
      setNotificationError(error.message);
    }
  }
  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 30000);
    return () => clearInterval(timer);
  }, []);
  const readIds = notifications.filter((n) => n.is_read).map((n) => n.id);
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const read = unreadCount === 0;
  async function setRead(id) {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { ids: [id] } : { all: true }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }
      await loadNotifications();
    } catch (error) {
      setToast(error.message);
    }
  }
  const completionKey = `lessons:${detail?.title || 'none'}`;
  const completed = records[completionKey]?.completed || [];
  function setCompleted(next) {
    setRecords((list) => ({
      ...list,
      [completionKey]: {
        completed: typeof next === 'function' ? next(list[completionKey]?.completed || []) : next,
      },
    }));
  }
  useEffect(() => {
    function restore(raw) {
      const cached = JSON.parse(raw || 'null');
      if (
        !cached ||
        !Array.isArray(cached.courses) ||
        !Array.isArray(cached.students) ||
        !Array.isArray(cached.mentors) ||
        !cached.baseRows ||
        !cached.records ||
        !cached.workflows
      )
        return;
      lastCache.current = raw;
      setCourses(cached.courses);
      setStudents(cached.students);
      setMentors(cached.mentors);
      setBaseRows(cached.baseRows);
      setRecords(cached.records);
      setWorkflows({ ...structuredClone(initialWorkflows), ...cached.workflows });
    }
    try {
      restore(localStorage.getItem('codeemy-demo-v3'));
    } catch {
      /* Invalid demo cache falls back to fixtures. */
    }
    setDemoLoaded(true);
    const synchronize = (event) => {
      if (event.key === 'codeemy-demo-v3' && event.newValue && event.newValue !== lastCache.current)
        try {
          restore(event.newValue);
        } catch {
          /* Ignore malformed external demo snapshots. */
        }
    };
    window.addEventListener('storage', synchronize);
    return () => window.removeEventListener('storage', synchronize);
  }, []);
  useEffect(() => {
    if (!demoLoaded) return;
    try {
      const raw = JSON.stringify({ courses, students, mentors, baseRows, records, workflows });
      if (raw !== lastCache.current) {
        localStorage.setItem('codeemy-demo-v3', raw);
        lastCache.current = raw;
      }
    } catch {
      setToast(
        'Browser storage is full or unavailable. Latest changes remain in this open session; remove unused uploaded files to save again.',
      );
    }
  }, [demoLoaded, courses, students, mentors, baseRows, records, workflows]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    setTab('All');
    setSearch('');
    setFilter('All');
    setCurrent(1);
    setModal(null);
    setMobile(false);
    setAttempt(false);
    setResult(false);
    setViewState('Ready');
    setLesson(0);
    setAnswers({});
    setReview([]);
  }, [pathname]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement;
    const dialog = document.querySelector('[role="dialog"]');
    const controls = () =>
      Array.from(dialog.querySelectorAll('button,input,select,textarea,a[href]'));
    controls()[0]?.focus();
    const handle = (e) => {
      if (e.key === 'Escape') setModal(null);
      if (e.key === 'Tab') {
        const list = controls(),
          first = list[0],
          last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      previous?.focus();
    };
  }, [modal]);
  const notify = (message) => setToast(message);
  const visible = workspaceView(role, courses, students, baseRows, workflows);
  function go(p, d = null) {
    setTab('All');
    setSearch('');
    setFilter('All');
    setCurrent(1);
    setMobile(false);
    setAttempt(false);
    setResult(false);
    router.push(workspaceHref(role, p, d));
  }
  async function signOut() {
    try {
      await logout();
    } catch {
      setToast('Unable to sign out. Please try again.');
      return;
    }
    setMobile(false);
    setModal(null);
    setAttempt(false);
    setResult(false);
    window.location.assign('/login');
  }
  function changeRole(r) {
    router.push(workspaceHref(r, 'Dashboard'));
    setSearch('');
    setTab('All');
    setFilter('All');
    setMobile(false);
  }
  function download(title, body) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
    a.href = url;
    a.download = title + '.txt';
    a.click();
    URL.revokeObjectURL(url);
    notify('Mock document downloaded');
  }
  const rows =
    page === 'Students'
      ? visible.students.map((n, i) => [
          n,
          Object.values(workflows.batches)
            .filter((b) => b.students.includes(n))
            .map((b) => b.course)
            .join(', ') || 'Unassigned',
          Object.entries(workflows.batches)
            .filter(([, b]) => b.students.includes(n))
            .map(([title]) => title)
            .join(', ') || 'Unassigned',
          records[n]?.status || 'Active',
          76 + (i % 5) * 4 + '% attendance',
        ])
      : page === 'Mentors'
        ? mentors.map((n) => [
            n,
            'Course mentor',
            `${Object.values(workflows.batches).filter((b) => b.mentor === n).length} active batches`,
            records[n]?.status || 'Active',
            'View profile',
          ])
        : (visible.baseRows[page] || []).map((row) => {
            const saved = records[row[0]] || {};
            if (page === 'Batches' && workflows.batches[row[0]]) {
              const batch = workflows.batches[row[0]];
              return [
                row[0],
                batch.course,
                batch.mentor,
                saved.Status || row[3],
                `${batch.students.length} students`,
              ];
            }
            if (page === 'Certificates' && workflows.certificates[row[0]]) {
              const certificate = workflows.certificates[row[0]];
              return [
                row[0],
                certificate.name,
                certificate.date,
                certificate.status,
                certificate.number,
              ];
            }
            if (page === 'Assessments') {
              const config = workflows.assessmentConfigs[row[0]];
              const results = workflows.assessmentResults.filter((r) => r.title === row[0]);
              return [
                row[0],
                row[1],
                row[2],
                results.length ? 'Completed' : row[3],
                `${(config?.questions || workflows.bank).length} questions · ${config?.duration || 45} min`,
              ];
            }
            if (page === 'Announcements' && workflows.announcements[row[0]]) {
              const item = workflows.announcements[row[0]];
              return [row[0], item.audience, row[2], item.status, row[4]];
            }
            if (page === 'Career') {
              const application = workflows.applications
                .filter((a) => a.title === row[0] && a.student === 'Kavin Raj')
                .at(-1);
              return [row[0], row[1], row[2], application?.status || row[3], row[4]];
            }
            if (['Assignments', 'Projects'].includes(page)) {
              const submission = workflows.submissions
                .filter((s) => s.title === row[0] && s.kind === page && s.student === 'Kavin Raj')
                .at(-1);
              const evaluation = submission && (workflows.evaluations[submission.id] || []).at(-1);
              if (submission)
                return [
                  row[0],
                  row[1],
                  row[2],
                  evaluation?.decision || submission.status,
                  evaluation
                    ? `${evaluation.marks} / ${evaluation.total || 100}`
                    : `Revision ${submission.revision}`,
                ];
            }
            return [
              row[0],
              row[1],
              row[2],
              saved.submitted ? 'Submitted' : saved.applied ? 'Applied' : saved.Status || row[3],
              saved.Marks ? `${saved.Marks} / 100` : row[4],
            ];
          });
  const open = (row) => go(page, { title: row[0], row });
  function save(e) {
    e.preventDefault();
    if (modal === 'Create course' && role !== 'Admin') {
      notify('Only an administrator can create courses');
      return;
    }
    if (page === 'Classes' && !modal.startsWith('Edit') && role !== 'Admin') {
      notify('Only an administrator can create classes');
      return;
    }
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      for (const key of Object.keys(data))
        if (key.includes('URL')) data[key] = validateExternalUrl(data[key]);
    } catch (err) {
      notify(err.message);
      return;
    }
    const title = data.Title || data.Name || detail?.title || modal;
    const collection =
      page === 'Students'
        ? students
        : page === 'Mentors'
          ? mentors
          : page === 'Courses'
            ? courses.map((c) => c.title)
            : (baseRows[page] || []).map((row) => row[0]);
    if (collection.includes(title) && (!modal.startsWith('Edit') || title !== detail?.title)) {
      notify('A record with this name already exists');
      return;
    }
    setRecords((r) => ({
      ...r,
      [title]: { ...r[title], ...data, status: data.Status || r[title]?.status },
    }));
    const editingPerson = modal.startsWith('Edit') && detail && data.Name;
    if (editingPerson && ['Students', 'Mentors'].includes(page)) {
      const update = (list) => list.map((name) => (name === detail.title ? title : name));
      if (page === 'Students') setStudents(update);
      else setMentors(update);
      if (title !== detail.title)
        setWorkflows((w) => ({
          ...w,
          batches: Object.fromEntries(
            Object.entries(w.batches).map(([key, b]) => [
              key,
              {
                ...b,
                mentor: page === 'Mentors' && b.mentor === detail.title ? title : b.mentor,
                students:
                  page === 'Students'
                    ? b.students.map((n) => (n === detail.title ? title : n))
                    : b.students,
              },
            ]),
          ),
          submissions: w.submissions.map((s) => ({
            ...s,
            student: s.student === detail.title ? title : s.student,
          })),
          assessmentResults: w.assessmentResults.map((r) => ({
            ...r,
            student: page === 'Students' && r.student === detail.title ? title : r.student,
          })),
          queries: w.queries.map((q) => ({
            ...q,
            student: q.student === detail.title ? title : q.student,
          })),
          applications: w.applications.map((a) => ({
            ...a,
            student: a.student === detail.title ? title : a.student,
          })),
        }));
      router.replace(workspaceHref(role, page, { title }));
    } else {
      if (page === 'Students' && data.Name && !students.includes(title))
        setStudents((list) => [...list, title]);
      if (page === 'Mentors' && data.Name && !mentors.includes(title))
        setMentors((list) => [...list, title]);
    }
    if (baseRows[page] && data.Title && modal.startsWith('Edit')) {
      setBaseRows((list) => ({
        ...list,
        [page]: list[page].map((row) =>
          row[0] === detail?.title
            ? [
                data.Title,
                data.Course || row[1],
                data.Deadline || row[2],
                data.Status || row[3],
                row[4],
              ]
            : row,
        ),
      }));
      router.replace(workspaceHref(role, page, { title: data.Title }));
    }
    if (baseRows[page] && data.Title && !modal.startsWith('Edit'))
      setBaseRows((list) => ({
        ...list,
        [page]: [
          ...list[page],
          [
            data.Title,
            data.Course || 'Full Stack Web Development',
            data.Deadline || 'Oct 10, 2026',
            data.Status ||
              (page === 'Assessments' || page === 'Classes'
                ? 'Upcoming'
                : page === 'Batches'
                  ? 'Active'
                  : page === 'Career'
                    ? 'Open'
                    : page === 'Announcements'
                      ? 'Draft'
                      : 'Pending'),
            'New',
          ],
        ],
      }));
    if (page === 'Batches' && data.Title)
      setWorkflows((w) => ({
        ...w,
        batches: {
          ...w.batches,
          [data.Title]: {
            ...w.batches[detail?.title],
            course: data.Course,
            mentor: data.Mentor || mentors[0],
            students: w.batches[detail?.title]?.students || [],
          },
        },
      }));
    if (page === 'Certificates' && data.Title)
      setWorkflows((w) => ({
        ...w,
        certificates: {
          ...w.certificates,
          [data.Title]: {
            name: data.Name || 'Kavin Raj',
            number: data['Certificate ID'] || 'CE-' + Date.now(),
            date: data['Issue date'] || new Date().toISOString().slice(0, 10),
            status: 'Issued',
            events: [{ action: 'Issued', date: new Date().toISOString().slice(0, 10) }],
          },
        },
      }));
    if (page === 'Assessments' && data.Title)
      setWorkflows((w) => ({
        ...w,
        assessmentConfigs: {
          ...w.assessmentConfigs,
          [data.Title]: {
            questions: w.assessmentConfigs[detail?.title]?.questions || structuredClone(w.bank),
            duration: Number(data.Duration),
            pass: Number(data['Pass marks']),
            attempts: Number(data.Attempts),
          },
        },
      }));
    if (page === 'Announcements' && data.Title)
      setWorkflows((w) => ({
        ...w,
        announcements: {
          ...w.announcements,
          [data.Title]: {
            ...w.announcements[detail?.title],
            body: data.Instructions,
            audience:
              w.announcements[detail?.title]?.audience || detail?.row?.[1] || 'All students',
            status: w.announcements[detail?.title]?.status || detail?.row?.[3] || 'Draft',
            history: w.announcements[detail?.title]?.history || [],
          },
        },
      }));
    if (modal === 'Create course') {
      setWorkflows((w) => ({ ...w, courseContent: { ...w.courseContent, [data.Title]: [] } }));
      setCourses((list) => [
        ...list,
        {
          title: data.Title,
          description: data.Description,
          category: 'DEVELOPMENT',
          mentor: data.Mentor,
          batch: 'New batch',
          progress: 0,
          lessons: 0,
          total: 0,
          art: '</>',
          color: 'blue',
          status: data.Status,
        },
      ]);
    }
    if (modal === 'Edit course') {
      const c = courses.find((c) => c.title === detail?.title);
      if (c) {
        setCourses((list) =>
          list.map((item) =>
            item.title === c.title
              ? {
                  ...item,
                  title: data.Title,
                  description: data.Description,
                  mentor: data.Mentor,
                  status: data.Status,
                }
              : item,
          ),
        );
        if (data.Title !== c.title) {
          setWorkflows((w) => ({
            ...w,
            courseContent: { ...w.courseContent, [data.Title]: w.courseContent[c.title] },
            batches: Object.fromEntries(
              Object.entries(w.batches).map(([name, b]) => [
                name,
                { ...b, course: b.course === c.title ? data.Title : b.course },
              ]),
            ),
            resources: w.resources.map((r) => ({
              ...r,
              course: r.course === c.title ? data.Title : r.course,
            })),
          }));
          setRecords((r) => ({
            ...r,
            [`lessons:${data.Title}`]: r[`lessons:${c.title}`] || { completed: [] },
          }));
        }
        router.replace(workspaceHref(role, page, { title: data.Title }));
      }
    }
    if (modal.startsWith('Edit') && detail && title !== detail.title && !editingPerson) {
      const before = detail.title;
      setWorkflows((w) => renameWorkflow(w, page, before, title));
      setRecords((r) => {
        const next = { ...r, [title]: { ...r[before], ...r[title] } };
        delete next[before];
        if (page === 'Courses')
          for (const [key, value] of Object.entries(next)) {
            if (value.Course === before) next[key] = { ...value, Course: title };
          }
        return next;
      });
      if (page === 'Courses')
        setBaseRows((list) =>
          Object.fromEntries(
            Object.entries(list).map(([key, items]) => [
              key,
              items.map((row) => row.map((value) => (value === before ? title : value))),
            ]),
          ),
        );
    }
    setModal(null);
    notify('Saved in this browser demo');
  }

  const questions =
    (attempt || result) && attemptQuestions
      ? attemptQuestions
      : workflows.assessmentConfigs[detail?.title]?.questions || workflows.bank;

  const titles = {
    Dashboard:
      role === 'Admin'
        ? 'Academy overview'
        : actor
          ? 'Welcome back, ' + actor.full_name
          : 'Your workspace',
    'My Courses': 'My courses',
    Mentor: 'Your mentor',
    Progress: 'Your learning progress',
    Career: 'Build your next chapter',
  };
  const subtitles = {
    Dashboard: 'A little progress every day adds up. Let’s make today count.',
    'My Courses': 'Your learning journey, all in one place.',
    Assignments: 'Put your knowledge into practice and keep moving forward.',
    Classes: 'Make time to learn. Your upcoming sessions are right here.',
    Career: 'Turn your skills into opportunities.',
  };

  const courseCard = (c) => <CourseCard key={c.title} c={c} />;
  const stats = (items) => <StatGrid items={items} />;
  const formFields = (fields, values) => <FormFields fields={fields} values={values} />;
  const context = {
    actor,
    notificationError,
    startAssessment,
    finishAssessment,
    assessmentOutcome,
    startingAssessment,
    notifications,
    unreadCount,
    readIds,
    workflows,
    setWorkflows,
    role,
    page,
    detail,
    tab,
    setTab,
    search,
    setSearch,
    filter,
    setFilter,
    current,
    setCurrent,
    mobile,
    setMobile,
    toast,
    setToast,
    modal,
    setModal,
    records,
    setRecords,
    lesson,
    setLesson,
    completed,
    setCompleted,
    question,
    setQuestion,
    answers,
    setAnswers,
    review,
    setReview,
    attempt,
    setAttempt,
    result,
    setResult,
    seconds,
    setSeconds,
    read,
    setRead,
    viewState,
    setViewState,
    notify,
    go,
    signOut,
    changeRole,
    download,
    rows,
    open,
    save,
    courseCard,
    stats,
    formFields,
    courses: visible.courses,
    allCourses: courses,
    students: visible.students,
    mentors,
    baseRows: visible.baseRows,
    questions,
    setCourses,
    setStudents,
    setBaseRows,
  };
  if (page === 'Login') {
    return <WorkspaceContext.Provider value={context}>{children}</WorkspaceContext.Provider>;
  }
  return (
    <WorkspaceContext.Provider value={context}>
      <Sidebar />
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setMobile(false)}
        />
      )}
      <main className="main">
        <Topbar />
        <div className="content">
          <div className="eyebrow">
            <button className="text-link" onClick={() => go('Dashboard')}>
              Workspace
            </button>{' '}
            / {role} /{' '}
            <button className="text-link" onClick={() => go(page)}>
              {page}
            </button>
            {detail && ' / ' + detail.title}
          </div>
          {![
            'Dashboard',
            'Courses',
            'My Courses',
            'Classes',
            'Attendance',
            'Students',
            'Mentors',
            'Batches',
            'Profile',
            'Notifications',
            'Assignments',
          ].includes(page) && (
            <p role="status">
              This workflow is still a preview. Changes here are not saved to the academy database.
            </p>
          )}
          <div className="page-title">
            <div>
              <h1>{detail?.title || titles[page] || page}</h1>
              <p>
                {detail
                  ? 'Everything you need, in one place.'
                  : subtitles[page] ||
                    'Manage your ' + page.toLowerCase() + ' in your CodeEmy workspace.'}
              </p>
            </div>
            {page === 'Dashboard' && today && (
              <Button secondary onClick={() => go('Classes')}>
                <CalendarDays size={14} /> {today}
              </Button>
            )}
          </div>
          {viewState === 'Loading' ? (
            <div className="card skeleton" aria-label="Loading content" />
          ) : viewState === 'Error' ? (
            <div className="card empty">
              <h2>Something went wrong</h2>
              <p>We couldn’t display this preview.</p>
              <Button onClick={() => setViewState('Ready')}>Try again</Button>
            </div>
          ) : viewState === 'Empty' ? (
            <div className="card empty">
              <BookOpen size={30} />
              <h2>Nothing here yet</h2>
              <p>Your learning content will appear here.</p>
              <Button onClick={() => setViewState('Ready')}>Return to preview</Button>
            </div>
          ) : !demoLoaded ? (
            <div className="card skeleton" aria-label="Loading saved workspace" />
          ) : page === 'Assignments' ? (
            <DatabaseAssignments />
          ) : page === 'Dashboard' ? (
            <DatabaseDashboard />
          ) : ['Students', 'Mentors'].includes(page) ? (
            <DatabasePeople />
          ) : page === 'Batches' ? (
            <DatabaseBatches />
          ) : ['My Courses', 'Courses'].includes(page) ? (
            <DatabaseCourses />
          ) : page === 'Attendance' ? (
            <DatabaseAttendance />
          ) : page === 'Classes' ? (
            <DatabaseClasses />
          ) : (
            children
          )}
          <footer className="footer">
            <span>© 2026 CodeEmy Edutech. Keep learning, keep growing.</span>
          </footer>
        </div>
      </main>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setModal(null);
            }}
          >
            <button className="close" aria-label="Close dialog" onClick={() => setModal(null)}>
              <X size={20} />
            </button>
            {<WorkspaceDialog />}
          </div>
        </div>
      )}
      {toast && (
        <div id="toast" style={{ display: 'block' }} role="status">
          ✓ {toast}
        </div>
      )}
    </WorkspaceContext.Provider>
  );
}
