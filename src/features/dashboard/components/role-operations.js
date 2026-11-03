'use client';
import { ArrowUpRight, ClipboardCheck, CalendarDays, Layers } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/context/workspace-context';

export default function RoleOperations() {
  const { role, baseRows, workflows, go } = useWorkspace();
  const cards =
    role === 'Student'
      ? [
          [
            'Upcoming assessments',
            baseRows.Assessments.filter((row) => row[3] === 'Upcoming').length,
            'Make room for your next milestone',
            'Assessments',
          ],
          [
            'Projects in progress',
            baseRows.Projects.filter((row) => row[3] !== 'Completed').length,
            'Build something you can be proud of',
            'Projects',
          ],
          [
            'Career opportunities',
            baseRows.Career.filter((row) => row[3] === 'Open').length,
            'Put your growing skills to work',
            'Career',
          ],
        ]
      : role === 'Mentor'
        ? [
            [
              'Upcoming assessments',
              baseRows.Assessments.filter((row) => row[3] === 'Upcoming').length,
              'Prepare questions and review results',
              'Assessments',
            ],
            [
              'Projects to guide',
              baseRows.Projects.length,
              'Support each learner’s next step',
              'Projects',
            ],
            ['Class attendance', '92%', 'Review attendance and participation', 'Attendance'],
          ]
        : [
            [
              'Active batches',
              baseRows.Batches.filter((row) => row[3] === 'Active').length,
              'Keep your academy moving together',
              'Batches',
            ],
            [
              'Issued certificates',
              Object.values(workflows.certificates).filter((c) => c.status === 'Issued').length,
              'Recognize learning milestones',
              'Certificates',
            ],
            [
              'Career applications',
              workflows.applications.filter((a) => a.status !== 'Withdrawn').length,
              'Track the journey from learning to work',
              'Career',
            ],
          ];
  return (
    <div className="operations-grid">
      {cards.map(([title, value, subtitle, page], index) => (
        <button className="card operation" key={title} onClick={() => go(page)}>
          <div className="section-head">
            <span>{title}</span>
            {index === 0 ? (
              <ClipboardCheck size={18} />
            ) : index === 1 ? (
              <Layers size={18} />
            ) : (
              <CalendarDays size={18} />
            )}
          </div>
          <strong>
            {value} <ArrowUpRight size={17} />
          </strong>
          <span>{subtitle}</span>
        </button>
      ))}
    </div>
  );
}
