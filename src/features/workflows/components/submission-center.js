'use client';
import { useState } from 'react';
import { Button, Badge } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import { validateExternalUrl } from '@/lib/urls';
import { uploadFile, downloadFileUrl } from '@/lib/uploads';

export default function SubmissionCenter() {
  const {
    role,
    page,
    detail,
    records,
    workflows,
    setWorkflows,
    setRecords,
    students,
    notify,
    setModal,
  } = useWorkspace();
  const [selected, setSelected] = useState(null),
    [error, setError] = useState(''),
    [uploading, setUploading] = useState(false);
  const title = detail.title,
    project = page === 'Projects';
  const maxMarks = Number(records[title]?.['Max marks']) || 100;
  const actual = workflows.submissions.filter(
    (s) =>
      s.title === title && s.kind === page && (role !== 'Mentor' || students.includes(s.student)),
  );
  const seeded = students
    .slice(0, 3)
    .filter((name) => !actual.some((s) => s.student === name))
    .map((student) => ({
      id: `${page}:${title}:${student}:sample`,
      title,
      kind: page,
      student,
      revision: 1,
      notes: 'Sample submission for review.',
      files: [],
      status: 'Submitted',
      date: '2026-09-29',
    }));
  const list =
    role === 'Student' ? actual.filter((s) => s.student === 'Kavin Raj') : [...actual, ...seeded];
  const current = selected
    ? [...actual, ...seeded].find((s) => s.id === selected)
    : role === 'Student'
      ? list.at(-1)
      : actual.at(-1) || list[0];
  const evaluations = current ? workflows.evaluations[current.id] || [] : [];
  async function submit(e) {
    e.preventDefault();
    setError('');
    if (uploading) return;
    setUploading(true);
    const form = e.currentTarget,
      data = new FormData(form);
    try {
      const github = validateExternalUrl(data.get('github'));
      const demo = validateExternalUrl(data.get('demo'));
      const file = await uploadFile(data.get('file'));
      if (!file && !github) throw new Error('Attach a file or enter a GitHub URL.');
      const revision = actual.filter((s) => s.student === 'Kavin Raj').length + 1;
      const item = {
        id: crypto.randomUUID(),
        title,
        kind: page,
        course: detail.row?.[1],
        student: 'Kavin Raj',
        revision,
        notes: data.get('notes'),
        github,
        demo,
        files: file ? [file] : [],
        date: new Date().toISOString(),
        status: 'Submitted',
      };
      setWorkflows((w) => ({ ...w, submissions: [...w.submissions, item] }));
      setRecords((r) => ({ ...r, [title]: { ...r[title], submitted: true } }));
      form.reset();
      notify(`Revision ${revision} submitted`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="detail-grid">
      <div className="card detail-copy">
        <Badge>
          {evaluations.at(-1)?.decision || current?.status || detail.row?.[3] || 'Pending'}
        </Badge>
        <h2>{title}</h2>
        <p>
          Course: {detail.row?.[1] || 'Full Stack Web Development'} · Due:{' '}
          {records[title]?.Deadline || detail.row?.[2] || 'Oct 15, 2026'}
        </p>
        <h3>Instructions and objectives</h3>
        <p>
          {records[title]?.Instructions ||
            records[title]?.Guidelines ||
            (project
              ? 'Build a responsive e-commerce storefront with accessible navigation, product filtering, and reusable React components.'
              : 'Create a responsive portfolio with semantic HTML, reusable components, keyboard navigation and a README.')}
        </p>
        <p>
          Skills: React · JavaScript · HTML · CSS. Submit original work, source code and a
          description of your implementation.
        </p>
        {role === 'Student' ? (
          <form onSubmit={submit}>
            <div className="upload">
              <label className="field">
                Submission file · maximum 20 MB
                <input name="file" type="file" accept=".pdf,.zip,.txt,.doc,.docx,.png,.jpg" />
              </label>
            </div>
            {project && (
              <div className="form-grid">
                <label className="field">
                  GitHub URL
                  <input className="input" name="github" type="url" />
                </label>
                <label className="field">
                  Demo URL
                  <input className="input" name="demo" type="url" />
                </label>
              </div>
            )}
            <label className="field">
              Submission notes
              <textarea name="notes" required />
            </label>
            {error && (
              <div role="alert" className="notice">
                {error}
              </div>
            )}
            <div className="form-actions">
              <Button type="submit" disabled={uploading}>
                {uploading ? 'Uploading…' : `Submit ${project ? 'project' : 'assignment'}`}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <Button onClick={() => setModal('Edit ' + (project ? 'Project' : 'Assignment'))}>
              Edit brief
            </Button>
            <h3 style={{ marginTop: 24 }}>Student submissions</h3>
            {list.map((s) => (
              <div className="task-row" key={s.id}>
                <div className="task-info">
                  <strong>{s.student}</strong>
                  <p>
                    Revision {s.revision} ·{' '}
                    {(workflows.evaluations[s.id] || []).at(-1)?.decision || s.status}
                  </p>
                </div>
                <Button secondary onClick={() => setSelected(s.id)}>
                  Review {s.student}
                </Button>
              </div>
            ))}
          </>
        )}
        <h3 style={{ marginTop: 25 }}>Submission revisions</h3>
        {list.map((s) => (
          <div className="activity" key={s.id}>
            <strong>
              {s.student} · Revision {s.revision}
            </strong>
            <p>{s.notes}</p>
            {s.files.map((file) => (
              <a
                className="text-link"
                href={downloadFileUrl(file)}
                download={file.name}
                key={file.name}
              >
                {file.name} · Download
              </a>
            ))}
            {s.github && (
              <p>
                <a href={s.github} target="_blank" rel="noreferrer">
                  GitHub repository ↗
                </a>
              </p>
            )}
            {s.demo && (
              <p>
                <a href={s.demo} target="_blank" rel="noreferrer">
                  Demo ↗
                </a>
              </p>
            )}
            {(workflows.evaluations[s.id] || []).map((v, i) => (
              <div className="choice" key={i}>
                <Badge>{v.decision}</Badge> {v.marks}/{v.total || 100}
                <p>{v.feedback}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
      <aside className="card">
        <h2>{role === 'Student' ? 'Mentor feedback' : 'Evaluate selected submission'}</h2>
        {current ? (
          <>
            <p>
              {current.student} · Revision {current.revision}
            </p>
            {evaluations.map((v, i) => (
              <div className="activity" key={i}>
                {v.marks}/{v.total || 100} · {v.decision}
                <p>{v.feedback}</p>
              </div>
            ))}
            {role !== 'Student' && (
              <form
                key={current.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  const evaluation = {
                    marks: Number(data.get('marks')),
                    total: maxMarks,
                    feedback: data.get('feedback'),
                    decision: data.get('decision'),
                    date: new Date().toISOString(),
                  };
                  setWorkflows((w) => ({
                    ...w,
                    evaluations: {
                      ...w.evaluations,
                      [current.id]: [...(w.evaluations[current.id] || []), evaluation],
                    },
                  }));
                  notify('Evaluation saved for ' + current.student);
                }}
              >
                <label className="field">
                  Marks / {maxMarks}
                  <input
                    className="input"
                    name="marks"
                    type="number"
                    min="0"
                    max={maxMarks}
                    required
                  />
                </label>
                <label className="field">
                  Feedback
                  <textarea name="feedback" required />
                </label>
                <label className="field">
                  Decision
                  <select name="decision">
                    {(project
                      ? ['Approved', 'Rework']
                      : ['Approved', 'Rejected', 'Resubmission']
                    ).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <div className="form-actions">
                  <Button type="submit">Save evaluation</Button>
                </div>
              </form>
            )}
            {!evaluations.length && role === 'Student' && (
              <p>Feedback appears after mentor review.</p>
            )}
          </>
        ) : (
          <p>Submit work to see its review history.</p>
        )}
      </aside>
    </div>
  );
}
