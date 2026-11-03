'use client';
import { useState } from 'react';
import { Button, Badge } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import { queryAssignedToMentor } from '@/lib/notifications';

export default function QueryCenter() {
  const { role, workflows, setWorkflows, notify, courses } = useWorkspace();
  const student = role === 'Student';
  const [selectedCourse, setSelectedCourse] = useState('');
  const queryCourses = [
    ...new Set(
      Object.values(workflows.batches)
        .filter((b) => b.students.includes('Kavin Raj'))
        .map((b) => b.course),
    ),
  ];
  const currentCourse = queryCourses.includes(selectedCourse)
    ? selectedCourse
    : queryCourses[0] || '';
  const assignedMentor =
    Object.values(workflows.batches).find(
      (b) => b.course === currentCourse && b.students.includes('Kavin Raj'),
    )?.mentor || 'Not assigned';
  const queries = workflows.queries.filter((q) =>
    student ? q.student === 'Kavin Raj' : role === 'Admin' || queryAssignedToMentor(q, workflows),
  );
  function send(e) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setWorkflows((w) => ({
      ...w,
      queries: [
        ...w.queries,
        {
          id: crypto.randomUUID(),
          student: 'Kavin Raj',
          course: data.get('course'),
          title: data.get('title'),
          message: data.get('message'),
          status: 'Open',
          replies: [],
        },
      ],
    }));
    e.currentTarget.reset();
    notify('Query added to your history');
  }
  return (
    <div className="detail-grid">
      <div className="card">
        <h2>{student ? `My mentor · ${assignedMentor}` : 'Student query inbox'}</h2>
        <p>Full Stack Web Development · Office hours Monday & Thursday, 5–6 PM IST</p>
        {student && (
          <form onSubmit={send}>
            <label className="field">
              Course
              <select
                name="course"
                required
                aria-label="Query course"
                value={currentCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
              >
                {queryCourses.map((course) => (
                  <option key={course}>{course}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Subject
              <input className="input" name="title" required maxLength={160} />
            </label>
            <label className="field">
              Your question
              <textarea name="message" required />
            </label>
            <div className="form-actions">
              <Button type="submit" disabled={!queryCourses.length}>
                Send query
              </Button>
            </div>
          </form>
        )}
        <div className="notice" style={{ marginTop: 20 }}>
          Messages are saved in this browser demo. Live messaging connects in the backend phase.
        </div>
      </div>
      <div className="card">
        <h2>{student ? 'Your query history' : 'Queries and replies'}</h2>
        {queries.map((q) => (
          <article className="activity" key={q.id}>
            <div className="section-head">
              <h3>{q.title}</h3>
              <Badge>{q.status}</Badge>
            </div>
            <small>{q.student}</small>
            <p>{q.message}</p>
            {q.replies.map((reply, i) => (
              <div className="choice" key={i}>
                <strong>{reply.author}</strong>
                <p>{reply.message}</p>
              </div>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const message = new FormData(e.currentTarget).get('reply');
                setWorkflows((w) => ({
                  ...w,
                  queries: w.queries.map((item) =>
                    item.id === q.id
                      ? {
                          ...item,
                          status: student ? 'Open' : 'Answered',
                          replies: [
                            ...item.replies,
                            { author: student ? 'Kavin Raj' : 'Arjun Kumar', message },
                          ],
                        }
                      : item,
                  ),
                }));
                e.currentTarget.reset();
                notify('Reply saved');
              }}
            >
              <label className="field">
                Reply
                <textarea name="reply" required />
              </label>
              <div className="form-actions">
                <Button type="submit">Send reply</Button>
                <Button
                  secondary
                  onClick={() =>
                    setWorkflows((w) => ({
                      ...w,
                      queries: w.queries.map((item) =>
                        item.id === q.id
                          ? { ...item, status: item.status === 'Resolved' ? 'Open' : 'Resolved' }
                          : item,
                      ),
                    }))
                  }
                >
                  {q.status === 'Resolved' ? 'Reopen' : 'Resolve'}
                </Button>
              </div>
            </form>
          </article>
        ))}
      </div>
    </div>
  );
}
