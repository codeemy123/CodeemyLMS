'use client';
import { useEffect, useState } from 'react';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import { api } from './api';
export default function DatabaseCourses() {
  const { role } = useWorkspace();
  const [courses, setCourses] = useState([]),
    [message, setMessage] = useState(''),
    [loaded, setLoaded] = useState(false),
    [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      setCourses((await api('/api/courses')).courses);
      setLoaded(true);
    } catch (e) {
      setMessage(e.message);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  return (
    <>
      <p role="status">{message}</p>
      {role === 'Admin' && (
        <section className="card" style={{ padding: 24 }}>
          <h2>{editing ? 'Edit course' : 'Create course'}</h2>
          <form
            className="auth-form"
            key={editing?.id || 'new'}
            onSubmit={async (event) => {
              event.preventDefault();
              const data = Object.fromEntries(new FormData(event.currentTarget));
              setBusy(true);
              try {
                await api('/api/courses' + (editing ? '/' + editing.id : ''), {
                  method: editing ? 'PATCH' : 'POST',
                  body: JSON.stringify(data),
                });
                setEditing(null);
                await refresh();
                setMessage('Course saved to database.');
              } catch (e) {
                setMessage(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Title
              <input name="title" defaultValue={editing?.title} required maxLength={255} />
            </label>
            <label>
              Category
              <input name="category" defaultValue={editing?.category || ''} maxLength={150} />
            </label>
            <label>
              Description
              <textarea name="description" defaultValue={editing?.description || ''} />
            </label>
            <label>
              Status
              <select name="status" defaultValue={editing?.status || 'DRAFT'}>
                <option>DRAFT</option>
                <option>PUBLISHED</option>
                <option>ARCHIVED</option>
              </select>
            </label>
            <button disabled={busy}>Save course</button>
            {editing && (
              <button type="button" onClick={() => setEditing(null)}>
                Cancel edit
              </button>
            )}
          </form>
        </section>
      )}
      <div className="courses">
        {courses.map((course) => (
          <article className="card" style={{ padding: 24 }} key={course.id}>
            <h2>{course.title}</h2>
            <p>
              {course.category} ? {course.status}
            </p>
            <p>{course.description}</p>
            <p>Mentor: {course.users?.full_name || 'Not assigned'}</p>
            {course.batches.map((batch) => (
              <p key={batch.id}>{batch.name}</p>
            ))}
            {course.course_modules.map((module) => (
              <section key={module.id}>
                <h3>{module.title}</h3>
                {module.lessons.map((lesson) => (
                  <p key={lesson.id}>{lesson.title}</p>
                ))}
              </section>
            ))}
            {role === 'Admin' && <button onClick={() => setEditing(course)}>Edit course</button>}
          </article>
        ))}
      </div>
      {loaded && !courses.length && (
        <div className="card empty">
          <h2>No courses yet</h2>
          <p>
            {role === 'Admin'
              ? 'Create a course to get started.'
              : 'Your assigned courses will appear here.'}
          </p>
        </div>
      )}
    </>
  );
}
