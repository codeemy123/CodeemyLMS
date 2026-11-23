'use client';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Users,
  GraduationCap,
  Layers,
  CalendarDays,
  Bell,
  Plus,
  Sparkles,
  Check,
  ChevronRight,
} from 'lucide-react';
import { api } from './api';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import AccountMapping from '@/features/auth/components/account-mapping';
export default function DatabaseDashboard() {
  const { role, actor, go } = useWorkspace();
  const [data, setData] = useState(null),
    [error, setError] = useState('');
  async function load() {
    setError('');
    try {
      const [c, s, n, people, batches, approvals] = await Promise.all([
        api('/api/courses'),
        api('/api/class-sessions'),
        api('/api/notifications'),
        role === 'Admin' ? api('/api/people') : Promise.resolve({ users: [] }),
        role === 'Admin' ? api('/api/batches') : Promise.resolve({ batches: [] }),
        role === 'Admin'
          ? api('/api/admin/approvals')
          : Promise.resolve({ pendingCount: 0 }),
      ]);
      setData({
        courses: c.courses || [],
        sessions: s.sessions || [],
        unread: n.unreadCount || 0,
        notifications: n.notifications || [],
        people: people.users || [],
        batches: batches.batches || [],
        approvalCount: approvals.pendingCount || 0,
      });
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [role]);
  const admin = role === 'Admin';
  const student =
    String(role || actor?.role || '')
      .trim()
      .toUpperCase() === 'STUDENT';
  const metrics = admin
    ? [
        [
          'Students',
          data?.people.filter((p) => p.role === 'STUDENT').length,
          Users,
          'Students',
          'Learners in your academy',
          'sage',
        ],
        [
          'Mentors',
          data?.people.filter((p) => p.role === 'MENTOR').length,
          GraduationCap,
          'Mentors',
          'The people behind the progress',
          'sand',
        ],
        [
          'Courses',
          data?.courses.length,
          BookOpen,
          'Courses',
          'Your academy course library',
          'lavender',
        ],
        [
          'Active batches',
          data?.batches.filter((b) => b.status === 'ACTIVE').length,
          Layers,
          'Batches',
          'Learning together, moving forward',
          'blue',
        ],
      ]
    : [
        [
          'My courses',
          data?.courses.length,
          BookOpen,
          role === 'Student' ? 'My Courses' : 'Courses',
          'Your learning, all in one place',
          'sage',
        ],
        [
          'Classes',
          data?.sessions.length,
          CalendarDays,
          'Classes',
          'Stay connected with your classroom',
          'sand',
        ],
        [
          'Unread updates',
          data?.unread,
          Bell,
          'Notifications',
          'Keep up with your academy',
          'lavender',
        ],
      ];
  const upcoming = (data?.sessions || [])
    .filter((s) => new Date(s.start_at) >= new Date())
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
    .slice(0, 3);

  if (admin) {
    return (
      <AdminCommandDashboard
        actor={actor}
        data={data}
        error={error}
        retry={load}
        go={go}
        upcoming={upcoming}
      />
    );
  }
  return (
    <div className="academy-dashboard">
      <section className={'academy-hero' + (student ? ' student-quote-banner' : '')}>
        <div className="academy-hero-copy">
          <span className="academy-kicker">
            <span className="academy-live-dot" />
            {admin
              ? 'YOUR ACADEMY, CONNECTED'
              : student
                ? 'A LITTLE INSPIRATION FOR TODAY'
                : 'YOUR NEXT CHAPTER'}
          </span>
          <h2>
            {admin ? (
              <>
                Great learning starts
                <br />
                with a great academy.
              </>
            ) : student ? (
              <>
                Every skill starts with a step.
                <br />
                <span>Make yours today.</span>
              </>
            ) : (
              <>
                A little progress.
                <br />A world of possibilities.
              </>
            )}
          </h2>
          <p>
            {admin
              ? 'Bring your people, courses and classrooms together. Everything you need to shape what comes next.'
              : student
                ? 'Stay curious. Keep showing up. The future you want is built one lesson at a time.'
                : 'Your courses, classes and updates. One thoughtful space to keep moving forward.'}
          </p>
          {student && (
            <div className="student-quote-footer">
              <span /> YOUR JOURNEY. YOUR PACE. YOUR POTENTIAL.
            </div>
          )}
          {!student && (
            <div className="academy-hero-actions">
              <button
                className="btn academy-gold-button"
                onClick={() =>
                  go(admin ? 'Courses' : role === 'Student' ? 'My Courses' : 'Courses')
                }
              >
                <Plus size={16} />
                {admin ? 'Manage courses' : 'Explore my courses'}
                <ArrowUpRight size={16} />
              </button>
              {admin && (
                <button className="academy-hero-link" onClick={() => go('Batches')}>
                  View batches <ArrowRight size={16} />
                </button>
              )}
            </div>
          )}
        </div>
        {!student && !admin && (
          <div className="academy-hero-art" aria-hidden="true">
            <div className="academy-orbit orbit-one" />
            <div className="academy-orbit orbit-two" />
            <div className="academy-art-tile tile-book">
              <BookOpen size={35} />
            </div>
            <div className="academy-art-tile tile-people">
              <Users size={25} />
            </div>
            <div className="academy-art-tile tile-spark">
              <Sparkles size={22} />
            </div>
            <div className="academy-art-label">
              <span className="academy-live-dot" />
              Built for brighter futures
            </div>
            <div className="academy-art-caption">LEARN. CONNECT. GROW.</div>
          </div>
        )}
      </section>
      {error && (
        <div className="academy-error" role="alert">
          {error}
          <button onClick={load}>Try again</button>
        </div>
      )}
      <div className="academy-metrics">
        {metrics.map(([label, value, Icon, page, caption, color]) => (
          <button key={label} className="academy-metric" onClick={() => go(page)}>
            <div className="academy-metric-top">
              <span className={'academy-icon ' + color}>
                <Icon size={21} />
              </span>
              <ArrowUpRight size={17} />
            </div>
            <span className="academy-metric-value">{data ? value : '—'}</span>
            <strong>{label}</strong>
            <span className="academy-muted">{caption}</span>
          </button>
        ))}
      </div>
      <div className="academy-dashboard-columns">
        <section className="academy-panel">
          <div className="academy-panel-heading">
            <div>
              <span className="academy-overline">THE LEARNING LIBRARY</span>
              <h2>{admin ? 'Your courses' : 'Continue your journey'}</h2>
            </div>
            <button
              className="academy-text-button"
              onClick={() => go(admin ? 'Courses' : role === 'Student' ? 'My Courses' : 'Courses')}
            >
              View all <ArrowUpRight size={15} />
            </button>
          </div>
          {data?.courses.length ? (
            <div className="academy-course-list">
              {data.courses.slice(0, 3).map((c, i) => (
                <button
                  key={c.id}
                  className="academy-course-row"
                  onClick={() =>
                    go(admin ? 'Courses' : role === 'Student' ? 'My Courses' : 'Courses')
                  }
                >
                  <span className={'academy-icon ' + ['sage', 'sand', 'lavender'][i % 3]}>
                    <BookOpen size={22} />
                  </span>
                  <span>
                    <strong>{c.title}</strong>
                    <small>
                      {c.category || 'Course'} &middot; {c.status.toLowerCase()}
                    </small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          ) : (
            <div className="academy-empty">
              <span className="academy-empty-illustration">
                <BookOpen size={33} />
                <span>
                  <Plus size={13} />
                </span>
              </span>
              <h3>{data ? 'Your next great course starts here' : 'Getting your library ready'}</h3>
              <p>
                {admin
                  ? 'Turn your expertise into a learning experience. Create your first course to begin.'
                  : 'Your assigned courses will appear here when your academy adds them.'}
              </p>
              {admin && (
                <button className="btn" onClick={() => go('Courses')}>
                  <Plus size={15} /> Create your first course
                </button>
              )}
            </div>
          )}
        </section>
        <section className="academy-panel">
          <div className="academy-panel-heading">
            <div>
              <span className="academy-overline">MAKE ROOM FOR LEARNING</span>
              <h2>Class schedule</h2>
            </div>
            <CalendarDays size={20} />
          </div>
          {upcoming.length ? (
            <div>
              {upcoming.map((s) => (
                <div className="academy-course-row" key={s.id}>
                  <span className="academy-date-tile">
                    <small>
                      {new Intl.DateTimeFormat('en', {
                        month: 'short',
                        timeZone: 'Asia/Kolkata',
                      }).format(new Date(s.start_at))}
                    </small>
                    {new Intl.DateTimeFormat('en', {
                      day: '2-digit',
                      timeZone: 'Asia/Kolkata',
                    }).format(new Date(s.start_at))}
                  </span>
                  <div>
                    <strong>{s.title}</strong>
                    <small>
                      {s.batches.name} &middot;{' '}
                      {new Intl.DateTimeFormat('en', {
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: 'Asia/Kolkata',
                      }).format(new Date(s.start_at))}{' '}
                      IST
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="academy-empty compact">
              <span className="academy-icon sand">
                <CalendarDays size={25} />
              </span>
              <h3>A little room to plan ahead</h3>
              <p>No upcoming classes yet. Your next scheduled session will appear right here.</p>
            </div>
          )}
          <button className="academy-panel-footer" onClick={() => go('Classes')}>
            {admin ? 'Plan your next class' : 'View class schedule'}
            <ArrowRight size={16} />
          </button>
        </section>
      </div>
      {admin && (
        <div className="academy-dashboard-columns academy-bottom-columns">
          <section className="academy-panel">
            <div className="academy-panel-heading">
              <div>
                <span className="academy-overline">BUILD YOUR ACADEMY</span>
                <h2>A thoughtful start</h2>
              </div>
              <Sparkles size={20} />
            </div>
            {[
              [
                'Connect your people',
                'Activate Student and Mentor accounts.',
                'Students',
                data?.people.some((p) => p.role === 'STUDENT' || p.role === 'MENTOR'),
              ],
              [
                'Create a course',
                'Give your expertise a place to grow.',
                'Courses',
                !!data?.courses.length,
              ],
              [
                'Bring a batch together',
                'Connect a course, mentor and learners.',
                'Batches',
                !!data?.batches.length,
              ],
            ].map(([title, description, page, done], i) => (
              <button className="academy-setup-step" key={title} onClick={() => go(page)}>
                <span className={done ? 'academy-step-number done' : 'academy-step-number'}>
                  {done ? <Check size={15} /> : String(i + 1).padStart(2, '0')}
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </section>
          <AccountMapping />
        </div>
      )}
    </div>
  );
}

function AdminCommandDashboard({ actor, data, error, retry, go, upcoming }) {
  const people = data?.people || [];
  const metrics = [
    {
      label: 'Total Courses',
      value: data?.courses?.length,
      detail: 'Academy course library',
      icon: BookOpen,
      page: 'Courses',
      tone: 'violet',
    },
    {
      label: 'Total Teachers',
      value: people.filter((person) => person.role === 'MENTOR').length,
      detail: 'Assigned mentor accounts',
      icon: GraduationCap,
      page: 'Mentors',
      tone: 'blue',
    },
    {
      label: 'Total Students',
      value: people.filter((person) => person.role === 'STUDENT').length,
      detail: 'Active academy learners',
      icon: Users,
      page: 'Students',
      tone: 'green',
    },
    {
      label: 'Offline Enrollment Requests',
      value: data?.approvalCount,
      detail: 'Awaiting academy review',
      icon: Bell,
      page: 'Account Approvals',
      tone: 'amber',
    },
  ];
  const notifications = (data?.notifications || []).slice(0, 4);

  return (
    <div className="admin-command-dashboard">
      <section className="admin-command-welcome">
        <div>
          <span className="admin-command-overline">Academy control centre</span>
          <h2>👋 Welcome, {actor?.full_name || 'CodeEmy Admin'}</h2>
          <p>Keep your courses, people, classes and academy activity in one place.</p>
        </div>
        <div className="admin-command-institute">
          <span>Institute name</span>
          <strong>CodeEmy Technologies</strong>
        </div>
      </section>

      {error ? (
        <div className="academy-error admin-command-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={retry}>Try again</button>
        </div>
      ) : null}

      <section className="admin-command-metrics" aria-label="Academy totals">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <button
              className={`admin-command-metric ${metric.tone}`}
              key={metric.label}
              type="button"
              onClick={() => go(metric.page)}
            >
              <span className="admin-command-metric-icon"><Icon size={21} /></span>
              <span className="admin-command-metric-label">{metric.label}</span>
              <strong>{data ? (metric.value ?? 0) : '—'}</strong>
              <span className="admin-command-metric-detail">{metric.detail}</span>
              <ArrowUpRight className="admin-command-metric-arrow" size={18} />
            </button>
          );
        })}
      </section>

      <section className="admin-command-grid">
        <div className="admin-command-left">
          <section className="admin-command-panel">
            <div className="admin-command-panel-head">
              <div>
                <span className="admin-command-overline">Teaching calendar</span>
                <h2>Live & upcoming classes</h2>
                <p>Your next batch sessions appear here.</p>
              </div>
              <button className="admin-command-action" type="button" onClick={() => go('Live Classes')}>
                <Plus size={17} /> Schedule class
              </button>
            </div>
            <div className="admin-command-list">
              {upcoming.length ? upcoming.map((session) => (
                <button className="admin-command-session" type="button" key={session.id} onClick={() => go('Live Classes')}>
                  <span className="admin-command-date-tile">
                    <b>{sessionDatePart(session.start_at, 'day')}</b>
                    <small>{sessionDatePart(session.start_at, 'month')}</small>
                  </span>
                  <span className="admin-command-session-info">
                    <strong>{session.title || 'Live class'}</strong>
                    <span>{session.batches?.name || 'Academy batch'} · {formatSessionDate(session.start_at)}</span>
                  </span>
                  <ChevronRight size={19} />
                </button>
              )) : (
                <div className="admin-command-empty">
                  <CalendarDays size={25} />
                  <strong>No live classes scheduled yet</strong>
                  <span>Schedule a batch session when your next class is ready.</span>
                </div>
              )}
            </div>
          </section>

          <section className="admin-command-panel admin-command-quick-panel">
            <div className="admin-command-panel-head compact">
              <div>
                <span className="admin-command-overline">Quick actions</span>
                <h2>Manage your academy</h2>
              </div>
            </div>
            <div className="admin-command-quick-actions">
              <button type="button" onClick={() => go('Courses')}><BookOpen size={19} /><span><b>Create or manage courses</b><small>Update the learning library</small></span><ChevronRight size={18} /></button>
              <button type="button" onClick={() => go('Live Classes')}><CalendarDays size={19} /><span><b>Schedule a live class</b><small>Create a Zoom session for a batch</small></span><ChevronRight size={18} /></button>
              <button type="button" onClick={() => go('Account Approvals')}><Users size={19} /><span><b>Review access requests</b><small>Approve learners and mentors</small></span><ChevronRight size={18} /></button>
            </div>
          </section>
        </div>

        <section className="admin-command-panel admin-command-notifications">
          <div className="admin-command-panel-head compact">
            <div>
              <span className="admin-command-overline">Activity centre</span>
              <h2>Notifications</h2>
            </div>
            <button className="admin-command-text-link" type="button" onClick={() => go('Notifications')}>View all <ArrowRight size={16} /></button>
          </div>
          <div className="admin-command-notification-list">
            {notifications.length ? notifications.map((notification) => (
              <button className="admin-command-notification" type="button" key={notification.id} onClick={() => go('Notifications')}>
                <span className={`admin-command-notification-icon ${notification.is_read ? 'read' : ''}`}><Bell size={18} /></span>
                <span>
                  <b>{notification.title || 'Academy update'} {!notification.is_read ? <em>New</em> : null}</b>
                  <span>{notification.message || 'A new update is available in your workspace.'}</span>
                  <small>{formatRelativeTime(notification.created_at)}</small>
                </span>
              </button>
            )) : (
              <div className="admin-command-empty notification-empty">
                <Bell size={25} />
                <strong>All caught up</strong>
                <span>New academy activity will appear here.</span>
              </div>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}

function sessionDatePart(value, part) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return part === 'day' ? '—' : '';
  return new Intl.DateTimeFormat('en-IN', {
    day: part === 'day' ? '2-digit' : undefined,
    month: part === 'month' ? 'short' : undefined,
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

function formatSessionDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return 'To be scheduled';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

function formatRelativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - date.valueOf()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
