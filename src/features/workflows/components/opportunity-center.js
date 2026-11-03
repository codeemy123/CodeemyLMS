'use client';
import { useState } from 'react';
import { Button, Badge } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import { uploadFile, downloadFileUrl } from '@/lib/uploads';
export default function OpportunityCenter() {
  const { role, detail, workflows, setWorkflows, courses, setRecords, notify } = useWorkspace();
  const title = detail.title;
  const config = workflows.opportunities[title] || {
    minimum: 60,
    course: courses[0]?.title || 'Full Stack Web Development',
    deadline: '2026-10-18',
    description: 'Join a product team to create accessible, responsive experiences.',
    skills: 'HTML, CSS, JavaScript, React',
  };
  const eligible =
    (courses.find((c) => c.title === config.course)?.progress || 0) >= config.minimum &&
    new Date(config.deadline + 'T23:59:59') >= new Date();
  const apps = workflows.applications.filter((a) => a.title === title);
  const applied = apps.some((a) => a.student === 'Kavin Raj' && a.status !== 'Withdrawn');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  async function apply(e) {
    e.preventDefault();
    setError('');
    if (!eligible || applied) return;
    if (uploading) return;
    setUploading(true);
    const form = e.currentTarget,
      d = new FormData(form);
    try {
      const source = d.get('resume');
      if (source?.size && !/\.(pdf|doc|docx)$/i.test(source.name))
        throw new Error('Choose a PDF or Word resume');
      const resume = await uploadFile(source);
      if (!resume) throw new Error('Attach your resume');
      if (!/\.(pdf|doc|docx)$/i.test(resume.name)) throw new Error('Choose a PDF or Word resume');
      setWorkflows((w) => ({
        ...w,
        applications: [
          ...w.applications,
          {
            id: crypto.randomUUID(),
            title,
            student: 'Kavin Raj',
            resume,
            note: d.get('note'),
            status: 'Applied',
            date: new Date().toISOString(),
            history: [],
          },
        ],
      }));
      setRecords((r) => ({ ...r, [title]: { ...r[title], applied: true } }));
      notify('Application submitted');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="detail-grid">
      <div className="card detail-copy">
        <Badge>{detail.row?.[4] || 'Internship'}</Badge>
        <h2>{title}</h2>
        <p>
          {detail.row?.[1]} · Closing: {config.deadline}
        </p>
        <h3>About the opportunity</h3>
        <p>{config.description}</p>
        <h3>Skills and eligibility</h3>
        <p>
          {config.skills} · {config.course} · Minimum course completion: {config.minimum}%
        </p>
        {role === 'Student' && (
          <>
            <Badge>{eligible ? 'Eligible' : 'Not eligible / deadline closed'}</Badge>
            {!applied && eligible && (
              <form onSubmit={apply}>
                <label className="field">
                  Resume · PDF/DOC, maximum 20 MB
                  <input name="resume" type="file" accept=".pdf,.doc,.docx" required />
                </label>
                <label className="field">
                  Application note
                  <textarea name="note" required />
                </label>
                {error && <p role="alert">{error}</p>}
                <Button type="submit" disabled={uploading}>
                  {uploading ? 'Uploading…' : 'Submit application'}
                </Button>
              </form>
            )}
            <h3 style={{ marginTop: 20 }}>Application history</h3>
            {apps
              .filter((a) => a.student === 'Kavin Raj')
              .map((a) => (
                <div className="choice" key={a.id}>
                  <Badge>{a.status}</Badge>
                  <p>{a.note}</p>
                  <a href={downloadFileUrl(a.resume)} download={a.resume.name}>
                    Download submitted resume
                  </a>
                  {a.history.map((h, i) => (
                    <p key={i}>
                      {h.status} · {h.date}
                    </p>
                  ))}
                  {!['Withdrawn', 'Selected', 'Rejected'].includes(a.status) && (
                    <Button
                      secondary
                      onClick={() =>
                        setWorkflows((w) => ({
                          ...w,
                          applications: w.applications.map((item) =>
                            item.id === a.id
                              ? {
                                  ...item,
                                  status: 'Withdrawn',
                                  history: [
                                    ...item.history,
                                    {
                                      status: 'Withdrawn',
                                      actorRole: 'Student',
                                      date: new Date().toISOString(),
                                    },
                                  ],
                                }
                              : item,
                          ),
                        }))
                      }
                    >
                      Withdraw application
                    </Button>
                  )}
                </div>
              ))}
          </>
        )}
      </div>
      {role !== 'Student' && (
        <div className="card">
          <form
            key={title + JSON.stringify(config)}
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              setWorkflows((w) => ({
                ...w,
                opportunities: {
                  ...w.opportunities,
                  [title]: {
                    minimum: Number(d.get('minimum')),
                    course: d.get('course'),
                    deadline: d.get('deadline'),
                    description: d.get('description'),
                    skills: d.get('skills'),
                  },
                },
              }));
              notify('Eligibility saved');
            }}
          >
            <h2>Eligibility management</h2>
            <label className="field">
              Eligible course
              <select name="course" defaultValue={config.course}>
                {courses.map((c) => (
                  <option key={c.title}>{c.title}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Minimum completion %
              <input
                className="input"
                name="minimum"
                type="number"
                min="0"
                max="100"
                required
                defaultValue={config.minimum}
              />
            </label>
            <label className="field">
              Application deadline
              <input
                className="input"
                name="deadline"
                type="date"
                required
                defaultValue={config.deadline}
              />
            </label>
            <label className="field">
              Description
              <textarea name="description" defaultValue={config.description} required />
            </label>
            <label className="field">
              Required skills
              <input className="input" name="skills" defaultValue={config.skills} required />
            </label>
            <div className="form-actions">
              <Button type="submit">Save eligibility</Button>
            </div>
          </form>
          <h3 style={{ marginTop: 25 }}>Applications · {apps.length}</h3>
          {apps.map((a) => (
            <form
              className="choice"
              key={a.id}
              onSubmit={(e) => {
                e.preventDefault();
                const status = new FormData(e.currentTarget).get('status');
                setWorkflows((w) => ({
                  ...w,
                  applications: w.applications.map((item) =>
                    item.id === a.id
                      ? {
                          ...item,
                          status,
                          history: [
                            ...item.history,
                            { status, actorRole: role, date: new Date().toISOString() },
                          ],
                        }
                      : item,
                  ),
                }));
                notify('Application status updated');
              }}
            >
              <strong>{a.student}</strong>
              <p>{a.note}</p>
              <a href={downloadFileUrl(a.resume)} download={a.resume.name}>
                Resume
              </a>
              <label className="field">
                Application status
                <select name="status" defaultValue={a.status}>
                  {[
                    'Applied',
                    'Under review',
                    'Shortlisted',
                    'Selected',
                    'Rejected',
                    'Withdrawn',
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <Button type="submit">Update application</Button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
