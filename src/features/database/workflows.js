'use client';
import { useEffect, useState } from 'react';
import { api } from './api';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import AnnouncementPoster from '@/components/ui/announcement-poster';

export default function DatabaseWorkflows({ kind, title, description }) {
  const { role } = useWorkspace();
  const [lessonId, setLessonId] = useState('');
  const [data, setData] = useState({ records: [] }),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      const result = await api('/api/workflows/' + kind);
      setData(result);
      if (kind === 'progress')
        setLessonId(
          (previous) =>
            previous ||
            new URLSearchParams(window.location.search).get('lesson') ||
            result.records[0]?.id ||
            '',
        );
    } catch (e) {
      setMessage(e.message);
    }
  }
  useEffect(() => {
    refresh();
    if (kind === 'announcements') {
      const timer = setInterval(refresh, 30000);
      return () => clearInterval(timer);
    }
  }, [kind]);
  async function send(body) {
    setBusy(true);
    try {
      await api('/api/workflows/' + kind, { method: 'POST', body: JSON.stringify(body) });
      await refresh();
      setMessage('Saved successfully.');
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="database-workflows">
      {title && (
        <section className="card workflow-card workflow-intro">
          <h2>{title}</h2>
          <p>{description}</p>
        </section>
      )}
      {message && <p role="status">{message}</p>}
      {kind === 'queries' && role === 'Student' && (
        <section className="card workflow-card">
          <h2>{title || 'Ask your mentor'}</h2>
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              send(Object.fromEntries(new FormData(e.currentTarget)));
            }}
          >
            <label>
              Course
              <select name="courseId" required>
                <option value="">Select your course</option>
                {data.courses?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subject
              <input name="subject" required maxLength={255} />
            </label>
            <label>
              Batch
              <select name="batchId">
                <option value="">Use my only batch / course mentor</option>
                {data.batches?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Question
              <textarea name="message" required maxLength={10000} />
            </label>
            <button disabled={busy}>Send to mentor</button>
          </form>
        </section>
      )}
      {kind === 'progress' && (
        <section className="card workflow-card">
          <h2>Your learning progress</h2>
          <p>
            {data.records.filter((r) => r.lesson_progress?.some((p) => p.is_completed)).length} of{' '}
            {data.records.length} published lessons completed
          </p>
          <label>
            Choose a lesson
            <select value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
              {data.records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.course_modules.title} / {r.title}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      {data.records
        .filter((r) => kind !== 'progress' || r.id === lessonId)
        .map((r) => (
          <article
            className={
              'card workflow-card' + (kind === 'announcements' ? ' announcement-card' : '')
            }
            key={r.id}
          >
            <h2>{r.title || r.subject}</h2>
            {kind === 'performance' && (
              <>
                <p>{r.batch}</p>
                <p>
                  Lessons: {r.completed} / {r.lessons}
                </p>
                <p>Attendance: {r.attendance === null ? 'Not marked yet' : r.attendance + '%'}</p>
                <p>Evaluated submissions: {r.evaluated}</p>
              </>
            )}
            <p>{r.description || r.message}</p>
            {kind === 'announcements' && (
              <>
                <AnnouncementPoster record={r} />
                <p className="announcement-published">
                  {r.published_at
                    ? new Date(r.published_at).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                      }) + ' IST'
                    : ''}
                </p>
              </>
            )}
            {kind === 'materials' && (
              <a href={r.file_url} target="_blank" rel="noreferrer">
                Open learning material
              </a>
            )}
            {kind === 'progress' && (
              <>
                <p>{r.course_modules.title}</p>
                {r.video_url && (
                  <video
                    controls
                    preload="metadata"
                    src={r.video_url}
                    onLoadedMetadata={(e) => {
                      e.currentTarget.currentTime =
                        r.lesson_progress?.[0]?.last_position_seconds || 0;
                    }}
                    onPause={(e) =>
                      role === 'Student' &&
                      send({ id: r.id, position: e.currentTarget.currentTime })
                    }
                    onEnded={() => role === 'Student' && send({ id: r.id, completed: true })}
                  />
                )}
                <p style={{ whiteSpace: 'pre-wrap' }}>{r.content}</p>
                {r.resource_url && (
                  <a href={r.resource_url} target="_blank" rel="noreferrer">
                    Lesson resource
                  </a>
                )}
                {role === 'Student' && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      send({ id: r.id, completed: !r.lesson_progress?.[0]?.is_completed })
                    }
                  >
                    {r.lesson_progress?.[0]?.is_completed ? 'Mark incomplete' : 'Mark complete'}
                  </button>
                )}
              </>
            )}
            {kind === 'queries' && (
              <>
                <p>
                  {r.users?.full_name} · {r.status}
                </p>
                {r.query_replies.map((reply) => (
                  <blockquote key={reply.id}>
                    <strong>{reply.users.full_name}</strong>
                    <p>{reply.message}</p>
                  </blockquote>
                ))}
                <form
                  className="auth-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    send({
                      action: 'reply',
                      id: r.id,
                      message: f.get('message'),
                      resolve: f.get('resolve') === 'on',
                    });
                  }}
                >
                  <label>
                    Reply
                    <textarea name="message" required maxLength={10000} />
                  </label>
                  {role !== 'Student' && (
                    <label>
                      <input type="checkbox" name="resolve" /> Mark resolved
                    </label>
                  )}
                  <button disabled={busy}>Send reply</button>
                </form>
              </>
            )}
            {kind === 'projects' && (
              <>
                <p style={{ whiteSpace: 'pre-wrap' }}>{r.instructions}</p>
                <p>Due: {r.due_date ? new Date(r.due_date).toLocaleString() : 'No deadline'}</p>
                {role === 'Student' && !r.project_submissions.length && (
                  <form
                    className="auth-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      send({ id: r.id, ...Object.fromEntries(new FormData(e.currentTarget)) });
                    }}
                  >
                    <label>
                      Repository URL
                      <input name="repositoryUrl" type="url" pattern="https://.*" />
                    </label>
                    <label>
                      Live URL
                      <input name="liveUrl" type="url" pattern="https://.*" />
                    </label>
                    <label>
                      Your work
                      <textarea name="description" required maxLength={20000} />
                    </label>
                    <button disabled={busy}>Submit project</button>
                  </form>
                )}
                {r.project_submissions.map((s) => (
                  <section key={s.id}>
                    <h3>{s.users.full_name}</h3>
                    <p>{s.description}</p>
                    {s.repository_url && (
                      <a href={s.repository_url} target="_blank" rel="noreferrer">
                        Repository
                      </a>
                    )}{' '}
                    {s.live_url && (
                      <a href={s.live_url} target="_blank" rel="noreferrer">
                        Live project
                      </a>
                    )}
                    <p>Score: {s.marks_awarded ?? 'Awaiting review'} / 100</p>
                    <p>{s.feedback}</p>
                    {role !== 'Student' && (
                      <form
                        className="auth-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          send({
                            action: 'evaluate',
                            id: s.id,
                            marks: Number(f.get('marks')),
                            feedback: f.get('feedback'),
                          });
                        }}
                      >
                        <label>
                          Marks
                          <input
                            name="marks"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            required
                            defaultValue={s.marks_awarded ?? ''}
                          />
                        </label>
                        <label>
                          Feedback
                          <textarea name="feedback" defaultValue={s.feedback || ''} />
                        </label>
                        <button disabled={busy}>Save evaluation</button>
                      </form>
                    )}
                  </section>
                ))}
              </>
            )}
          </article>
        ))}
      {!data.records.length && (
        <section className="card empty">
          <h2>No records yet</h2>
          <p>Your assigned content will appear here when it is published.</p>
        </section>
      )}
    </div>
  );
}
