'use client';

import { Play, Download, Check, FileText, Activity } from 'lucide-react';
import { Badge, Progress, Button } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';

export default function CourseDetail() {
  const {
    role,
    detail,
    tab,
    setTab,
    current,
    setModal,
    lesson,
    setLesson,
    completed,
    setCompleted,
    notify,
    go,
    download,
    courses,
  } = useWorkspace();
  const c = courses.find((c) => c.title === detail.title) || courses[0];
  return (
    <div className="detail-grid">
      <div className="card">
        <Badge>{c.category}</Badge>
        <h2 style={{ marginTop: 16 }}>{c.title}</h2>
        <p style={{ marginTop: 12 }}>
          Build practical skills through guided lessons, hands-on assignments, and a real-world
          capstone project.
        </p>
        <div className="meta">
          Mentor: {c.mentor} · {c.batch} · Sep 01 – Dec 15, 2026
        </div>
        <div className="video">
          <button
            className="play"
            aria-label="Preview lesson"
            onClick={() => notify('Video placeholder — course video integration comes later')}
          >
            <Play />
          </button>
          <span>
            Lesson {lesson + 1}:{' '}
            {
              [
                'Introduction & learning goals',
                'Components and props',
                'State and events',
                'Building your first application',
              ][lesson]
            }
          </span>
        </div>
        <div className="tabs">
          {['Overview', 'Materials', 'Activity'].map((t) => (
            <button className={tab === t ? 'selected' : ''} key={t} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
        {tab === 'Materials' ? (
          <div className="task-row">
            <FileText />
            <span>Lesson workbook · Mock learning material</span>
            <Button
              secondary
              onClick={() =>
                download(
                  'Lesson workbook',
                  'CodeEmy mock lesson workbook\nPractice: build a reusable React component with props.',
                )
              }
            >
              Download
            </Button>
          </div>
        ) : tab === 'Activity' ? (
          <>
            <p>Practice: create a reusable profile card with props.</p>
            <Button onClick={() => go('Assignments', { title: 'Build a responsive portfolio' })}>
              Open assignment
            </Button>
          </>
        ) : (
          <p>
            In this lesson, discover the foundations of modern development and apply what you learn
            in a practical activity.
          </p>
        )}
        <div className="form-actions">
          <Button secondary onClick={() => setLesson((l) => Math.max(0, l - 1))}>
            Previous
          </Button>
          <Button
            onClick={() => {
              setCompleted((v) => [...new Set([...v, lesson])]);
              notify('Lesson marked complete');
            }}
          >
            <Check size={14} />
            Mark complete
          </Button>
          <Button secondary onClick={() => setLesson((l) => Math.min(3, l + 1))}>
            Next lesson
          </Button>
        </div>
        {role === 'Admin' && (
          <div className="form-actions">
            <Button onClick={() => setModal('Edit course')}>Edit course</Button>
            <Button secondary onClick={() => setModal('Add lesson')}>
              Add lesson / material
            </Button>
          </div>
        )}
      </div>
      <aside className="card">
        <h2>Course content</h2>
        <div className="meta">{completed.length} / 4 demo lessons complete</div>
        <Progress value={completed.length * 25} />
        {[
          'Introduction & learning goals',
          'Components and props',
          'State and events',
          'Building your first application',
        ].map((l, i) => (
          <button
            className={'lesson ' + (lesson === i ? 'current' : '')}
            style={{
              width: '100%',
              textAlign: 'left',
              background: lesson === i ? '#eaf3ed' : 'white',
            }}
            key={l}
            onClick={() => setLesson(i)}
          >
            {completed.includes(i) ? '✓' : '○'} Module {i + 1}
            <br />
            {l}
          </button>
        ))}
      </aside>
    </div>
  );
}
