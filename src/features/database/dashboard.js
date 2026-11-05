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
      const [c, s, n, people, batches] = await Promise.all([
        api('/api/courses'),
        api('/api/class-sessions'),
        api('/api/notifications'),
        role === 'Admin' ? api('/api/people') : Promise.resolve({ users: [] }),
        role === 'Admin' ? api('/api/batches') : Promise.resolve({ batches: [] }),
      ]);
      setData({
        courses: c.courses,
        sessions: s.sessions,
        unread: n.unreadCount,
        people: people.users,
        batches: batches.batches,
      });
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [role]);
  const admin = role === 'Admin';
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
  return (
    <div className="academy-dashboard">
      <section className="academy-hero">
        <div className="academy-hero-copy">
          <span className="academy-kicker">
            <span className="academy-live-dot" />
            {admin ? 'YOUR ACADEMY, CONNECTED' : 'YOUR NEXT CHAPTER'}
          </span>
          <h2>
            {admin ? (
              <>
                Great learning starts
                <br />
                with a great academy.
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
              : 'Your courses, classes and updates. One thoughtful space to keep moving forward.'}
          </p>
          <div className="academy-hero-actions">
            <button
              className="btn academy-gold-button"
              onClick={() => go(admin ? 'Courses' : role === 'Student' ? 'My Courses' : 'Courses')}
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
        </div>
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
