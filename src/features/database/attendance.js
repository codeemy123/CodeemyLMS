'use client';
import { useEffect, useState } from 'react';
import { api } from './api';
export default function DatabaseAttendance() {
  const [sessions, setSessions] = useState([]),
    [selected, setSelected] = useState(''),
    [students, setStudents] = useState([]),
    [marks, setMarks] = useState({}),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api('/api/class-sessions')
      .then((data) => setSessions(data.sessions))
      .catch((e) => setMessage(e.message));
  }, []);
  useEffect(() => {
    let active = true;
    setStudents([]);
    setMarks({});
    if (selected)
      api('/api/attendance?sessionId=' + selected)
        .then((data) => {
          if (!active) return;
          setStudents(data.students);
          setMarks(Object.fromEntries(data.attendance.map((a) => [a.student_id, a.status])));
        })
        .catch((e) => {
          if (active) setMessage(e.message);
        });
    return () => {
      active = false;
    };
  }, [selected]);
  return (
    <section className="card" style={{ padding: 24 }}>
      <h2>Class attendance</h2>
      <label>
        Class
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Choose a class</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.title} ? {session.batches.name} ?{' '}
              {new Date(session.start_at).toLocaleString()}
            </option>
          ))}
        </select>
      </label>
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
        {students.map((student) => (
          <label className="task-row" key={student.id}>
            {student.full_name}
            <select
              required
              value={marks[student.id] || ''}
              onChange={(e) => setMarks({ ...marks, [student.id]: e.target.value })}
            >
              <option value="">Not marked</option>
              {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
        ))}
        <button disabled={busy || !selected || !students.length}>Save attendance</button>
      </form>
      <p role="status">{message}</p>
      {!sessions.length && <p>No assigned classes yet.</p>}
    </section>
  );
}
