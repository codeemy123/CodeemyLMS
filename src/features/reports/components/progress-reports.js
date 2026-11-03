'use client';
import { Progress } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import ReportCenter from '@/features/workflows/components/report-center';
import { reportScope } from '@/lib/report-scope';

export default function ProgressReports() {
  const {
    role,
    courses,
    workflows: allWorkflows,
    records: allRecords,
    stats,
    baseRows,
  } = useWorkspace();
  const { workflows, records } = reportScope(role, allWorkflows, baseRows, allRecords);
  const results = workflows.assessmentResults.filter(
    (r) => role !== 'Student' || r.student === 'Kavin Raj',
  );
  const assessments = results.length
    ? Math.round(results.reduce((sum, r) => sum + (r.score / r.total) * 100, 0) / results.length)
    : null;
  const submissions = workflows.submissions.filter(
    (s) => role !== 'Student' || s.student === 'Kavin Raj',
  );
  const attendance = Object.entries(records)
    .filter(([key]) => key.startsWith('attendance:'))
    .flatMap(([, value]) =>
      Object.entries(value)
        .filter(
          ([name, status]) =>
            (role !== 'Student' || name === 'Kavin Raj') && status !== 'Not marked',
        )
        .map(([, status]) => status),
    );
  const average = Math.round(
    courses.reduce((sum, c) => sum + c.progress, 0) / Math.max(1, courses.length),
  );
  return (
    <>
      {stats([
        ['Overall completion', `${average}%`, 'Across current courses'],
        [
          'Attendance',
          attendance.length
            ? `${Math.round((attendance.filter((s) => ['Present', 'Late'].includes(s)).length / attendance.length) * 100)}%`
            : '—',
          `${attendance.length} marked sessions`,
        ],
        [
          'Assessment score',
          assessments === null ? '—' : `${assessments}%`,
          `${results.length} attempts`,
        ],
        [
          'Approved submissions',
          String(
            submissions.filter(
              (s) => (workflows.evaluations[s.id] || []).at(-1)?.decision === 'Approved',
            ).length,
          ),
          `${submissions.length} revisions submitted`,
        ],
      ])}
      <div className="card">
        <h2>Course completion</h2>
        {courses.map((c) => (
          <div className="activity" key={c.title}>
            <div className="progress-label">
              <strong>{c.title}</strong>
              <span>{c.progress}%</span>
            </div>
            <Progress value={c.progress} />
            <p>
              {c.lessons} / {c.total} lessons complete
            </p>
          </div>
        ))}
      </div>
      <div className="lower">
        <ReportCenter />
      </div>
    </>
  );
}
