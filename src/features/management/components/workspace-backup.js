'use client';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import { saveDownload } from '@/lib/exports';
export default function WorkspaceBackup() {
  const { allCourses, students, mentors, baseRows, records, workflows, notify } = useWorkspace();
  return (
    <div className="card lower">
      <h2>Back up your workspace</h2>
      <p>
        Download your saved records and file links before moving your workspace. Your existing data
        stays in place.
      </p>
      <Button
        secondary
        onClick={() => {
          saveDownload(
            'codeemy-workspace-backup.json',
            JSON.stringify(
              {
                format: 'codeemy-workspace-backup',
                version: 1,
                exportedAt: new Date().toISOString(),
                workspace: { courses: allCourses, students, mentors, baseRows, records, workflows },
              },
              null,
              2,
            ),
            'application/json',
          );
          notify('Workspace backup downloaded');
        }}
      >
        <Download size={16} />
        Download workspace backup
      </Button>
    </div>
  );
}
