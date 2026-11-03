'use client';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import { uploadFile, downloadFileUrl, deleteStoredFile } from '@/lib/uploads';
import { saveDownload } from '@/lib/exports';
import { defaultLessons } from '@/data/mock/workflows';
import { validateExternalUrl } from '@/lib/urls';
export default function ResourceLibrary() {
  const { role, detail, courses, workflows, setWorkflows, notify } = useWorkspace();
  const [error, setError] = useState(''),
    [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [course, setCourse] = useState(courses[0]?.title || '');
  const lessons =
    workflows.courseContent[course] ||
    defaultLessons.map((title, i) => ({ id: 'lesson-' + i, title }));
  const resources = workflows.resources.filter(
    (r) =>
      (role === 'Admin' || courses.some((c) => c.title === r.course)) &&
      (!detail || r.title === detail.title),
  );
  async function upload(e) {
    e.preventDefault();
    if (uploading) return;
    setUploading(true);
    setError('');
    const form = e.currentTarget,
      d = new FormData(form);
    try {
      const url = validateExternalUrl(d.get('url'));
      if (!courses.some((c) => c.title === d.get('course')))
        throw new Error('Select an assigned course');
      const file = (await uploadFile(d.get('file'))) || editing?.file || null;
      if (!file && !url) throw new Error('Attach a file or resource URL');
      const item = {
        id: editing?.id || crypto.randomUUID(),
        title: d.get('title').trim(),
        course: d.get('course'),
        lesson: d.get('lesson'),
        file,
        url,
      };
      if (!item.title) throw new Error('Enter a resource title');
      setWorkflows((w) => ({
        ...w,
        resources: editing
          ? w.resources.map((r) => (r.id === editing.id ? item : r))
          : [...w.resources, item],
      }));
      setEditing(null);
      setPreview(null);
      form.reset();
      setError('');
      notify('Resource saved to library');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="card">
      <h2>{detail?.title || 'Learning resource library'}</h2>
      {detail && !resources.length && (
        <>
          <p>
            Practice reusable components, semantic markup, accessible navigation and responsive
            layouts. Complete the exercises and review the examples with your mentor.
          </p>
          <Button
            secondary
            onClick={() =>
              saveDownload(
                detail.title + '.txt',
                'CodeEmy learning worksheet\n1. Build a reusable component.\n2. Add keyboard navigation.\n3. Test mobile layout.',
                'text/plain',
              )
            }
          >
            Download sample worksheet
          </Button>
        </>
      )}
      {resources.map((r) => (
        <div className="task-row" key={r.id}>
          <div className="task-info">
            <strong>{r.title}</strong>
            <p>
              {r.course} · {r.file?.name || r.url}
            </p>
          </div>
          {r.file ? (
            <>
              <Button secondary onClick={() => setPreview(r)}>
                Preview
              </Button>
              <a className="btn" href={downloadFileUrl(r.file)} download={r.file.name}>
                Download file
              </a>
            </>
          ) : (
            <a className="btn" href={r.url} target="_blank" rel="noreferrer">
              Open resource
            </a>
          )}
          {role !== 'Student' && (
            <Button
              secondary
              disabled={uploading}
              onClick={() => {
                setEditing(r);
                setCourse(r.course);
                setError('');
              }}
            >
              Edit resource
            </Button>
          )}
          {role !== 'Student' && (
            <Button
              secondary
              onClick={async () => {
                try {
                  await deleteStoredFile(r.file);
                  setWorkflows((w) => ({
                    ...w,
                    resources: w.resources.filter((item) => item.id !== r.id),
                  }));
                  if (preview?.id === r.id) setPreview(null);
                  if (editing?.id === r.id) setEditing(null);
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              Remove resource
            </Button>
          )}
        </div>
      ))}
      {preview && (
        <div className="choice">
          <Button secondary onClick={() => setPreview(null)}>
            Close preview
          </Button>
          {preview.file.type === 'application/pdf' ? (
            <iframe
              className="resource-preview"
              title={preview.title}
              sandbox
              src={preview.file.data}
            />
          ) : preview.file.type.startsWith('image/') ? (
            <img className="resource-image" src={preview.file.data} alt={preview.title} />
          ) : preview.file.type.startsWith('video/') ? (
            <video controls className="lesson-video" src={preview.file.data} />
          ) : (
            <p>Download the original file to open this format.</p>
          )}
        </div>
      )}
      {role !== 'Student' && (
        <form className="lower" onSubmit={upload} key={editing?.id || 'new'}>
          <h3>{editing ? 'Edit learning content' : 'Upload learning content'}</h3>
          <div className="form-grid">
            <label className="field">
              Resource title
              <input
                className="input"
                name="title"
                required
                defaultValue={editing?.title || detail?.title}
              />
            </label>
            <label className="field">
              Course
              <select name="course" value={course} onChange={(e) => setCourse(e.target.value)}>
                {courses.map((c) => (
                  <option key={c.title}>{c.title}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Module / lesson
              <select
                name="lesson"
                key={course}
                required
                defaultValue={editing?.course === course ? editing.lesson : undefined}
              >
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              External URL
              <input className="input" name="url" type="url" defaultValue={editing?.url || ''} />
            </label>
            <label className="field full">
              File · 20 MB; video · 100 MB
              <input type="file" name="file" />
            </label>
          </div>
          {error && <p role="alert">{error}</p>}
          <div className="form-actions">
            {editing && (
              <Button secondary disabled={uploading} onClick={() => setEditing(null)}>
                Cancel edit
              </Button>
            )}
            <Button type="submit" disabled={uploading}>
              {uploading ? 'Uploading…' : 'Save learning resource'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
