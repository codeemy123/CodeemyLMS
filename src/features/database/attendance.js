'use client';
import { useEffect, useState } from 'react';
import { api } from './api';
import { ClipboardCheck, CalendarDays } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
export default function DatabaseAttendance() {
  const { role, go } = useWorkspace();
  const [loading, setLoading] = useState(true),
    [rosterLoading, setRosterLoading] = useState(false);
  const [sessions, setSessions] = useState([]),
    [selected, setSelected] = useState(''),
    [students, setStudents] = useState([]),
    [marks, setMarks] = useState({}),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api('/api/class-sessions')
      .then((data) => setSessions(data.sessions))
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    let active = true;
    setStudents([]);
    setMarks({});
    setRosterLoading(Boolean(selected));
    setMessage('');
    if (selected)
      api('/api/attendance?sessionId=' + selected)
        .then((data) => {
          if (!active) return;
          setStudents(data.students);
          setMarks(Object.fromEntries(data.attendance.map((a) => [a.student_id, a.status])));
        })
        .catch((e) => {
          if (active) setMessage(e.message);
        })
        .finally(() => {
          if (active) setRosterLoading(false);
        });
    return () => {
      active = false;
    };
  }, [selected]);
  return (
    <section className="card class-management attendance-management">
      <div className="class-section-heading">
        <span className="class-heading-icon">
          <ClipboardCheck size={25} />
        </span>
        <div>
          <h2>Class attendance</h2>
          <p>Select a class to review and update its student attendance.</p>
        </div>
      </div>
      {loading && <p role="status">Loading classes…</p>}
      {sessions.length > 0 && (
        <label className="attendance-selection">
          Class
          <select
            aria-label="Class"
            value={selected}
            disabled={busy}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose a class</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title} · {session.batches.name} ·{' '}
                {new Date(session.start_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}{' '}
                IST
              </option>
            ))}
          </select>
        </label>
      )}
      {rosterLoading && <p role="status">Loading student attendance…</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api('/api/attendance', {
              method: 'POST',
              body: JSON.stringify({
                sessionId: selected,
                marks: students
                  .filter((s) => marks[s.id])
                  .map((s) => ({ studentId: s.id, status: marks[s.id] })),
              }),
            });
            setMessage('Attendance saved. Students have been notified of changes.');
          } catch (error) {
            setMessage(error.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="attendance-roster">
          {students.map((student) => (
            <label className="attendance-student" key={student.id}>
              <strong>{student.full_name}</strong>
              <select
                required
                disabled={busy}
                value={marks[student.id] || ''}
                onChange={(e) => setMarks({ ...marks, [student.id]: e.target.value })}
              >
                <option value="">Not marked</option>
                {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0) + status.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {students.length > 0 && (
          <div className="class-form-actions">
            <p>Attendance updates are saved to academy records.</p>
            <button
              className="btn"
              disabled={busy || rosterLoading || !selected || !students.length}
              type="submit"
            >
              {busy ? 'Saving…' : 'Save attendance'}
            </button>
          </div>
        )}
      </form>
      {message && (
        <p className="class-notice" role="status">
          {message}
        </p>
      )}
      {!loading && !sessions.length && !message && (
        <div className="class-empty">
          <CalendarDays size={32} />
          <h3>No classes available yet</h3>
          <p>
            {role === 'Admin'
              ? 'Schedule a class for a batch first. Its students will appear here.'
              : 'Your assigned classes will appear here when the academy schedules them.'}
          </p>
          {role === 'Admin' && (
            <button className="btn" onClick={() => go('Classes')}>
              Schedule a class
            </button>
          )}
        </div>
      )}
      {!loading && sessions.length > 0 && !selected && (
        <div className="class-empty compact">
          <ClipboardCheck size={28} />
          <h3>Choose a class above</h3>
          <p>The batch roster and saved attendance will appear here.</p>
        </div>
      )}
      {selected && !rosterLoading && !students.length && !message && (
        <div className="class-empty compact">
          <h3>No students assigned to this batch</h3>
          <p>Add batch members before marking attendance.</p>
        </div>
      )}
    </section>
  );
}
