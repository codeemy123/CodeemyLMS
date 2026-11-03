'use client';

import { BookOpen, ClipboardList, ArrowRight, ChevronRight, Check, Activity } from 'lucide-react';
import { Badge, Progress, Button } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import RoleOperations from './role-operations';
import HeroVisual from './hero-visual';

export default function DashboardOverview() {
  const {
    role,
    go,
    courseCard,
    stats,
    courses,
    students,
    mentors,
    baseRows,
    questions,
    workflows,
  } = useWorkspace();
  const progress = Math.round(
    courses.reduce((total, course) => total + course.progress, 0) / Math.max(1, courses.length),
  );
  const active = courses.filter((c) => c.status === 'Active').length;
  const pending = workflows.submissions.filter(
    (s) => !(workflows.evaluations[s.id] || []).length,
  ).length;
  const issued = Object.values(workflows.certificates).filter((c) => c.status === 'Issued').length;
  return (
    <>
      <div className="banner">
        <div>
          <span className="tag">YOUR NEXT CHAPTER STARTS HERE</span>
          <h2>
            {role === 'Student'
              ? 'Small steps. Big possibilities.'
              : role === 'Mentor'
                ? 'Inspire learning. Create impact.'
                : 'A clearer view of your academy.'}
          </h2>
          <p>
            {role === 'Student'
              ? "You're making great progress, Kavin. Keep your momentum going and get a little closer to your goals today."
              : 'Everything you need to support your learners, keep classes on track, and celebrate progress.'}
          </p>
          <Button onClick={() => go(role === 'Student' ? 'My Courses' : 'Courses')}>
            {role === 'Student' ? 'Continue learning' : 'Explore courses'} <ArrowRight size={14} />
          </Button>
        </div>
        <HeroVisual />
      </div>
      {stats(
        role === 'Student'
          ? [
              ['Active courses', String(active), 'Current enrollment'],
              ['Overall progress', `${progress}%`, 'Across your courses'],
              [
                'Pending assignments',
                String(
                  baseRows.Assignments.filter(
                    (row) =>
                      row[3] === 'Pending' &&
                      !workflows.submissions.some((s) => s.title === row[0]),
                  ).length,
                ),
                'Ready for your next step',
              ],
              ['Certificates earned', String(issued), 'Learning milestones'],
            ]
          : role === 'Mentor'
            ? [
                ['Active courses', String(active), 'Current courses'],
                ['Scheduled classes', String(baseRows.Classes.length), 'Review the class schedule'],
                ['Pending evaluations', String(pending), 'Submitted work awaiting review'],
              ]
            : [
                ['Total students', String(students.length), 'Academy learners'],
                ['Total mentors', String(mentors.length), 'Academy mentors'],
                ['Active courses', String(active), 'Current courses'],
                ['Course completion', `${progress}%`, 'Demo learner average'],
              ],
      )}
      {role !== 'Student' && <RoleOperations />}
      <div className="columns">
        <div>
          <div className="section-head">
            <h2>{role === 'Student' ? 'Continue learning' : 'Your active courses'}</h2>
            <button
              className="text-link"
              onClick={() => go(role === 'Student' ? 'My Courses' : 'Courses')}
            >
              View all courses →
            </button>
          </div>
          <div className="courses">{courses.slice(0, 2).map(courseCard)}</div>
          <div className="card lower">
            <div className="section-head">
              <h2>{role === 'Student' ? 'Your upcoming tasks' : 'Learning operations'}</h2>
              <button className="text-link" onClick={() => go('Assignments')}>
                View all →
              </button>
            </div>
            {[
              [
                'Build a responsive portfolio',
                'Full Stack Web Development',
                'Oct 02',
                'Assignments',
              ],
              ['JavaScript fundamentals', `${questions.length} questions`, 'Oct 03', 'Assessments'],
              ['E-commerce storefront', 'Capstone project', 'Oct 15', 'Projects'],
            ].map(([title, sub, date, p]) => (
              <div className="task-row" key={title}>
                <span className="task-icon">
                  <ClipboardList size={17} />
                </span>
                <div className="task-info">
                  <h3>{title}</h3>
                  <p>{sub}</p>
                </div>
                <Badge>{date}</Badge>
                <button
                  className="text-link"
                  aria-label={'Open ' + title}
                  onClick={() => go(p, { title })}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            ))}
          </div>
          <div className="card lower">
            <div className="section-head">
              <h2>{role === 'Student' ? 'Your learning snapshot' : 'Academic overview'}</h2>
              <button
                className="text-link"
                onClick={() =>
                  go(
                    role === 'Student' ? 'Progress' : role === 'Mentor' ? 'Performance' : 'Reports',
                  )
                }
              >
                See insights →
              </button>
            </div>
            <div className="snapshot">
              {[
                ['Attendance', '92%'],
                ['Assessments', '88%'],
                ['Project completion', '50%'],
                ['Career applications', '01'],
              ].map(([l, v]) => (
                <div key={l}>
                  <strong>{v}</strong>
                  <p>{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <aside className="stack">
          <div className="card">
            <div className="section-head">
              <h2>Upcoming classes</h2>
              <button className="text-link" onClick={() => go('Classes')}>
                View all
              </button>
            </div>
            {baseRows.Classes.slice(0, 2).map((r, i) => (
              <div className="calendar" key={r[0]}>
                <div className="date">
                  {i ? '01' : '30'}
                  <small>{i ? 'OCT' : 'SEP'}</small>
                </div>
                <div>
                  <h3>{r[0]}</h3>
                  <p>
                    {i ? '5:00 – 6:00 PM' : '6:00 – 7:30 PM'} · {r[4]}
                  </p>
                  <button
                    className="text-link"
                    onClick={() => go('Classes', { title: r[0], row: r })}
                  >
                    <Badge>{i ? 'Tomorrow' : 'Today'}</Badge>
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="section-head">
              <h2>Learning streak</h2>
              <span>✦</span>
            </div>
            <div className="streak">
              <strong>7</strong>
              <span>days of showing up</span>
            </div>
            <div className="week">
              {'MTWTFSS'.split('').map((d, i) => (
                <div key={i}>
                  <span className={i < 5 ? 'done' : ''}>{i < 5 ? <Check size={12} /> : d}</span>
                  <small>{d}</small>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, marginTop: 14 }}>
              Consistency is your superpower. Keep it up!
            </p>
          </div>
          <div className="card">
            <div className="section-head">
              <h2>Recent activity</h2>
              <Activity size={15} />
            </div>
            <div className="activity">
              Completed “JavaScript functions”<span>2 hours ago · Full Stack Development</span>
            </div>
            <div className="activity">
              Assignment feedback received<span>Yesterday · 92 / 100 marks</span>
            </div>
            <div className="activity">
              Earned Git & GitHub certificate<span>Aug 30, 2026</span>
            </div>
            <button className="text-link" onClick={() => go('Notifications')}>
              See all notifications →
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
