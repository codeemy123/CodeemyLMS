'use client';
import AdminRecordActions from '@/features/management/components/admin-record-editor';

import { useState, useEffect } from 'react';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import { api } from './api';
import { uploadFile } from '@/lib/uploads';
export default function DatabaseAssignments({ label = 'Assignment' }) {
  const { role } = useWorkspace();
  const lowerLabel = label.toLowerCase();
  const pluralLabel = label === 'Quiz' ? 'quizzes' : label === 'Task' ? 'tasks' : 'assignments';
  const [rows, setRows] = useState([]),
    [courses, setCourses] = useState([]),
    [batches, setBatches] = useState([]),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      setRows((await api('/api/assignments')).assignments);
    } catch (e) {
      setMessage(e.message);
    }
  }
  useEffect(() => {
    refresh();
    if (role === 'Admin')
      Promise.all([api('/api/courses'), api('/api/batches')])
        .then(([c, b]) => {
          setCourses(c.courses);
          setBatches(b.batches);
        })
        .catch((e) => setMessage(e.message));
  }, [role]);
  return (
    <>
      <p role="status">{message}</p>
      {role === 'Admin' && (
        <section className="card" style={{ padding: 24 }}>
          <h2>Create {lowerLabel}</h2>
          <form
            className="auth-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              setBusy(true);
              try {
                const data = Object.fromEntries(new FormData(form));
                if (data.dueDate) data.dueDate = new Date(data.dueDate).toISOString();
                await api('/api/assignments', { method: 'POST', body: JSON.stringify(data) });
                form.reset();
                await refresh();
                setMessage(`${label} saved.`);
              } catch (e) {
                setMessage(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Title
              <input name="title" required />
            </label>
            <label>
              Description
              <textarea name="description" />
            </label>
            <label>
              Course
              <select name="courseId" required>
                <option value="">Choose course</option>
                {courses.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Batch
              <select name="batchId">
                <option value="">All course students</option>
                {batches.map((b) => (
                  <option value={b.id} key={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Total marks
              <input
                type="number"
                name="totalMarks"
                defaultValue={100}
                min={1}
                max={100000}
                required
              />
            </label>
            <label>
              Deadline
              <input type="datetime-local" name="dueDate" />
            </label>
            <button disabled={busy}>Create {lowerLabel}</button>
          </form>
        </section>
      )}
      {rows.map((work) => (
        <section className="card" key={work.id} style={{ padding: 24, marginTop: 20 }}>
          <h2>{work.title}</h2>
          <AdminRecordActions entity="assignments" record={work} onSaved={refresh} />
          <p>
            {work.courses?.title} &middot; {work.total_marks} marks
          </p>
          <p>{work.description}</p>
          {work.due_date && <p>Due {new Date(work.due_date).toLocaleString()}</p>}
          {role === 'Student' && !work.assignment_submissions.length && (
            <form
              className="auth-form"
              onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                try {
                  const data = new FormData(event.currentTarget);
                  const file = data.get('file');
                  const uploaded = file?.size ? await uploadFile(file) : null;
                  await api('/api/assignments/' + work.id + '/submission', {
                    method: 'POST',
                    body: JSON.stringify({
                      submissionText: data.get('submissionText'),
                      fileUrl: uploaded?.data,
                    }),
                  });
                  await refresh();
                  setMessage(`${label} submitted.`);
                } catch (e) {
                  setMessage(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Your submission
                <textarea name="submissionText" />
              </label>
              <label>
                Attachment
                <input name="file" type="file" />
              </label>
              <button disabled={busy}>Submit {lowerLabel}</button>
            </form>
          )}
          {work.assignment_submissions.map((sub) => (
            <article className="task-row" key={sub.id}>
              <div>
                <h3>{sub.users_assignment_submissions_student_idTousers.full_name}</h3>
                <p>{sub.submission_text}</p>
                {sub.file_url && <a href={sub.file_url}>Download submission</a>}
                <p>
                  {sub.status} &middot; {sub.marks_awarded ?? 'Not graded'}
                </p>
                <p>{sub.feedback}</p>
                {role !== 'Student' && (
                  <form
                    className="auth-form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const data = Object.fromEntries(new FormData(event.currentTarget));
                      setBusy(true);
                      try {
                        await api('/api/submissions/' + sub.id + '/evaluation', {
                          method: 'POST',
                          body: JSON.stringify({
                            marks: Number(data.marks),
                            feedback: data.feedback,
                          }),
                        });
                        await refresh();
                        setMessage('Evaluation saved and student notified.');
                      } catch (e) {
                        setMessage(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <label>
                      Marks
                      <input
                        name="marks"
                        type="number"
                        min={0}
                        max={Number(work.total_marks)}
                        defaultValue={sub.marks_awarded || 0}
                        required
                      />
                    </label>
                    <label>
                      Feedback
                      <textarea name="feedback" defaultValue={sub.feedback || ''} />
                    </label>
                    <button disabled={busy}>Save evaluation</button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </section>
      ))}
      {!rows.length && !message && <p>No {pluralLabel} yet.</p>}
    </>
  );
}
