'use client';
import { useEffect, useState } from 'react';
import { api } from './api';
export default function DatabaseBatches() {
  const [batches, setBatches] = useState([]),
    [courses, setCourses] = useState([]),
    [people, setPeople] = useState([]),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      const [b, c, p] = await Promise.all([
        api('/api/batches'),
        api('/api/courses'),
        api('/api/people'),
      ]);
      setBatches(b.batches);
      setCourses(c.courses);
      setPeople(p.users);
    } catch (e) {
      setMessage(e.message);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  return (
    <>
      <section className="card" style={{ padding: 24 }}>
        <h2>Create batch</h2>
        <form
          className="auth-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            setBusy(true);
            try {
              await api('/api/batches', {
                method: 'POST',
                body: JSON.stringify({
                  ...Object.fromEntries(data),
                  studentIds: data.getAll('studentIds'),
                }),
              });
              form.reset();
              await refresh();
              setMessage('Batch saved. Course access is now linked to these members.');
            } catch (e) {
              setMessage(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Batch name
            <input name="name" required maxLength={150} />
          </label>
          <label>
            Course
            <select name="courseId" required>
              <option value="">Choose course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mentor
            <select name="mentorId" required>
              <option value="">Choose mentor</option>
              {people
                .filter((p) => p.role === 'MENTOR' && p.status === 'ACTIVE')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
            </select>
          </label>
          <fieldset>
            <legend>Students</legend>
            {people
              .filter((p) => p.role === 'STUDENT' && p.status === 'ACTIVE')
              .map((p) => (
                <label key={p.id}>
                  <input type="checkbox" name="studentIds" value={p.id} />
                  {p.full_name}
                </label>
              ))}
          </fieldset>
          <button disabled={busy}>Create batch</button>
        </form>
        <p role="status">{message}</p>
      </section>
      {batches.map((batch) => (
        <section className="card" style={{ padding: 24 }} key={batch.id}>
          <h2>{batch.name}</h2>
          <p>
            {batch.courses?.title} ? {batch.users?.full_name}
          </p>
          {batch.batch_members.map((m) => (
            <p key={m.id}>{m.users.full_name}</p>
          ))}
        </section>
      ))}
    </>
  );
}
