'use client';
import { ArrowRight } from 'lucide-react';
import { Progress } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
export default function CourseCard({ c }) {
  const { role, go } = useWorkspace();
  return (
    <article className="card course" key={c.title}>
      <div className={'course-art ' + c.color}>
        <span className="badge">{c.category}</span>
        <span className="art-symbol">{c.art}</span>
      </div>
      <div className="course-body">
        <h3>{c.title}</h3>
        <div className="meta">
          {c.mentor} · {c.batch}
        </div>
        <div className="progress-label">
          <span>Course progress</span>
          <strong>{c.progress}%</strong>
        </div>
        <Progress value={c.progress} />
        <div className="course-footer">
          <span>
            {c.lessons} / {c.total} lessons
          </span>
          <button
            className="btn light"
            onClick={() => go(role === 'Student' ? 'My Courses' : 'Courses', c)}
          >
            {role === 'Student' ? 'Continue learning' : 'Manage course'} <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </article>
  );
}
