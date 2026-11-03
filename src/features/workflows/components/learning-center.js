'use client';
import { useState } from 'react';
import { Button, Progress } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import { defaultLessons } from '@/data/mock/workflows';
import { uploadFile, downloadFileUrl, deleteStoredFile } from '@/lib/uploads';
import { validateExternalUrl } from '@/lib/urls';

export default function LearningCenter() {
  const {
    role,
    detail,
    courses,
    setCourses,
    records,
    workflows,
    setWorkflows,
    completed,
    setCompleted,
    notify,
    go,
    setModal,
  } = useWorkspace();
  const title = detail.title;
  const staff = role !== 'Student';
  const initial = (
    title.includes('Design')
      ? [
          'Design foundations',
          'User research and personas',
          'Wireframes and visual hierarchy',
          'Prototyping and usability testing',
        ]
      : defaultLessons
  ).map((name, i) => ({
    id: 'lesson-' + i,
    module: i < 2 ? 'Foundations' : 'Practice',
    title: name,
    description:
      'Learn the concepts, review the provided materials, then complete a hands-on activity.',
  }));
  const lessons = workflows.courseContent[title] || initial;
  const [active, setActive] = useState(lessons[0]?.id),
    [editing, setEditing] = useState(null),
    [preview, setPreview] = useState(null),
    [error, setError] = useState('');
  const [resourceUploading, setResourceUploading] = useState(false),
    [lessonUploading, setLessonUploading] = useState(false);
  const selected = lessons.find((l) => l.id === active) || lessons[0];
  const index = lessons.findIndex((l) => l.id === selected?.id);
  const resources = workflows.resources.filter(
    (r) => r.course === title && r.lesson === selected?.id,
  );
  function update(next) {
    setWorkflows((w) => ({ ...w, courseContent: { ...w.courseContent, [title]: next } }));
    const count = completed.filter((id) => next.some((l) => l.id === id)).length;
    setCourses((list) =>
      list.map((course) =>
        course.title === title
          ? {
              ...course,
              total: next.length,
              lessons: count,
              progress: next.length ? Math.round((count / next.length) * 100) : 0,
            }
          : course,
      ),
    );
  }
  async function resource(e) {
    e.preventDefault();
    setError('');
    if (resourceUploading) return;
    setResourceUploading(true);
    const form = e.currentTarget,
      d = new FormData(form);
    try {
      const url = validateExternalUrl(d.get('url'));
      const file = await uploadFile(d.get('file'));
      if (!file && !d.get('url')) throw new Error('Choose a file or enter a resource URL');
      setWorkflows((w) => ({
        ...w,
        resources: [
          ...w.resources,
          {
            id: crypto.randomUUID(),
            course: title,
            lesson: selected.id,
            title: d.get('title'),
            file,
            url,
          },
        ],
      }));
      form.reset();
      notify('Resource added');
    } catch (err) {
      setError(err.message);
    } finally {
      setResourceUploading(false);
    }
  }
  return (
    <div className="detail-grid">
      <div className="card">
        <h2>{title}</h2>
        <p>{courses.find((c) => c.title === title)?.mentor} · Course learning workspace</p>
        <p>{courses.find((c) => c.title === title)?.description}</p>
        {selected ? (
          <>
            <h3 style={{ marginTop: 22 }}>
              {selected.module} / {selected.title}
            </h3>
            <p>{selected.description}</p>
            {selected.videoFile?.data || selected.video ? (
              <video
                controls
                className="lesson-video"
                src={selected.videoFile?.data || selected.video}
              />
            ) : (
              <div className="video">
                <strong>{selected.title}</strong>
                <span>Add a lesson video or open a learning resource below.</span>
              </div>
            )}
            <div className="form-actions">
              <Button secondary onClick={() => setActive(lessons[Math.max(0, index - 1)].id)}>
                Previous
              </Button>
              {!staff && (
                <Button
                  onClick={() => {
                    const next = [...new Set([...completed, selected.id])];
                    setCompleted(next);
                    setCourses((list) =>
                      list.map((course) =>
                        course.title === title
                          ? {
                              ...course,
                              progress: Math.round(
                                (next.filter((id) => lessons.some((l) => l.id === id)).length /
                                  lessons.length) *
                                  100,
                              ),
                              lessons: next.length,
                              total: lessons.length,
                            }
                          : course,
                      ),
                    );
                    notify('Lesson complete');
                  }}
                >
                  Mark complete
                </Button>
              )}
              <Button
                secondary
                onClick={() => setActive(lessons[Math.min(lessons.length - 1, index + 1)].id)}
              >
                Next lesson
              </Button>
            </div>
            <h3 style={{ marginTop: 25 }}>Learning materials</h3>
            {resources.length ? (
              resources.map((r) => (
                <div className="task-row" key={r.id}>
                  <div className="task-info">
                    <strong>{r.title}</strong>
                    <p>{r.file?.name || r.url}</p>
                  </div>
                  {r.file ? (
                    <>
                      <Button secondary onClick={() => setPreview(r)}>
                        Preview
                      </Button>
                      <a className="btn" href={downloadFileUrl(r.file)} download={r.file.name}>
                        Download
                      </a>
                    </>
                  ) : (
                    <a className="btn" href={r.url} target="_blank" rel="noreferrer">
                      Open resource
                    </a>
                  )}
                  {staff && (
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
                        } catch (err) {
                          setError(err.message);
                        }
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <p>No resources attached to this lesson yet.</p>
            )}
            <Button secondary onClick={() => go('Assignments')}>
              Open course activities
            </Button>
            {staff && (
              <form className="lower" onSubmit={resource}>
                <h3>Add resource</h3>
                <div className="form-grid">
                  <label className="field">
                    Resource title
                    <input className="input" name="title" required />
                  </label>
                  <label className="field">
                    External resource URL
                    <input className="input" name="url" type="url" />
                  </label>
                  <label className="field">
                    Resource file · 20 MB; video · 100 MB
                    <input type="file" name="file" />
                  </label>
                </div>
                {error && <p role="alert">{error}</p>}
                <div className="form-actions">
                  <Button type="submit" disabled={resourceUploading}>
                    {resourceUploading ? 'Uploading…' : 'Add resource'}
                  </Button>
                </div>
              </form>
            )}
          </>
        ) : (
          <p>Add a lesson to begin.</p>
        )}
        {staff && (
          <form
            key={editing?.id || 'new'}
            className="lower"
            onSubmit={async (e) => {
              e.preventDefault();
              if (lessonUploading) return;
              const form = e.currentTarget,
                d = new FormData(form);
              setLessonUploading(true);
              setError('');
              let video, videoFile;
              try {
                const source = d.get('videoFile');
                if (source?.size && !/\.(mp4|webm|mov)$/i.test(source.name))
                  throw new Error('Choose an MP4, WebM or MOV lesson video.');
                video = source?.size ? '' : validateExternalUrl(d.get('video'));
                videoFile = source?.size
                  ? await uploadFile(source)
                  : video
                    ? undefined
                    : editing?.videoFile;
              } catch (err) {
                setError(err.message);
                setLessonUploading(false);
                return;
              }
              const item = {
                id: editing?.id || crypto.randomUUID(),
                module: d.get('module'),
                title: d.get('title'),
                description: d.get('description'),
                video,
                videoFile,
              };
              update(
                editing ? lessons.map((l) => (l.id === editing.id ? item : l)) : [...lessons, item],
              );
              setEditing(null);
              form.reset();
              setLessonUploading(false);
              notify('Course content saved');
            }}
          >
            <h3>{editing ? 'Edit lesson' : 'Add module / lesson'}</h3>
            <div className="form-grid">
              <label className="field">
                Module
                <input className="input" name="module" required defaultValue={editing?.module} />
              </label>
              <label className="field">
                Lesson title
                <input className="input" name="title" required defaultValue={editing?.title} />
              </label>
              <label className="field full">
                Lesson description
                <textarea name="description" required defaultValue={editing?.description} />
              </label>
              <label className="field full">
                Direct video URL
                <input
                  className="input"
                  name="video"
                  type="url"
                  defaultValue={editing?.videoFile ? '' : editing?.video}
                />
              </label>
              <label className="field full">
                Upload lesson video · maximum 100 MB
                <input name="videoFile" type="file" accept=".mp4,.webm,.mov" />
                {editing?.videoFile && (
                  <small>Current video: {editing.videoFile.name}. Leave empty to keep it.</small>
                )}
              </label>
            </div>
            <div className="form-actions">
              <Button type="submit" disabled={lessonUploading}>
                {lessonUploading ? 'Uploading video…' : 'Save lesson'}
              </Button>
              {editing && (
                <Button secondary onClick={() => setEditing(null)}>
                  Cancel editing
                </Button>
              )}
              <Button secondary onClick={() => setModal('Edit course')}>
                Edit course details
              </Button>
            </div>
          </form>
        )}
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
        {preview && (
          <div className="choice">
            <div className="section-head">
              <h3>{preview.title}</h3>
              <Button secondary onClick={() => setPreview(null)}>
                Close preview
              </Button>
            </div>
            {preview.file.type === 'application/pdf' ? (
              <iframe
                className="resource-preview"
                title={preview.title}
                sandbox
                src={preview.file.data}
              />
            ) : preview.file.type.startsWith('video/') ? (
              <video controls className="lesson-video" src={preview.file.data} />
            ) : preview.file.type.startsWith('image/') ? (
              <img className="resource-image" alt={preview.title} src={preview.file.data} />
            ) : (
              <p>Preview is unavailable for this format. Download the original file to open it.</p>
            )}
          </div>
        )}
      </div>
      <aside className="card">
        <h2>Modules & lessons</h2>
        <p>
          {completed.filter((id) => lessons.some((l) => l.id === id)).length} / {lessons.length}{' '}
          complete
        </p>
        <Progress
          value={
            lessons.length
              ? (completed.filter((id) => lessons.some((l) => l.id === id)).length /
                  lessons.length) *
                100
              : 0
          }
        />
        {lessons.map((l, i) => (
          <div className="activity" key={l.id}>
            <button
              className={'lesson ' + (selected?.id === l.id ? 'current' : '')}
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => setActive(l.id)}
            >
              {completed.includes(l.id) ? '✓' : '○'} {l.module}
              <br />
              {l.title}
            </button>
            {staff && (
              <div className="form-actions">
                <Button secondary onClick={() => setEditing(l)}>
                  Edit
                </Button>
                <Button
                  secondary
                  onClick={() => {
                    if (i) {
                      const next = [...lessons];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      update(next);
                    }
                  }}
                >
                  Move up
                </Button>
                <Button
                  secondary
                  onClick={() => update(lessons.filter((item) => item.id !== l.id))}
                >
                  Remove lesson
                </Button>
              </div>
            )}
          </div>
        ))}
      </aside>
    </div>
  );
}
