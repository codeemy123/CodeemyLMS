'use client';
import { Button } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import AssessmentScreen from '@/features/assessments/components/assessment-screen';
import SpecialRecordDetail from './special-record-detail';
import LearningCenter from '@/features/workflows/components/learning-center';
import SubmissionCenter from '@/features/workflows/components/submission-center';
import CertificateCenter from '@/features/workflows/components/certificate-center';
import BatchCenter from '@/features/workflows/components/batch-center';
import OpportunityCenter from '@/features/workflows/components/opportunity-center';
import ResourceLibrary from '@/features/workflows/components/resource-library';
import PersonCenter from '@/features/workflows/components/person-center';
import AnnouncementCenter from '@/features/workflows/components/announcement-center';
import QuestionEditor from '@/features/workflows/components/question-editor';
export default function RecordDetail() {
  const { page, role, detail, records, go, setModal, notify, courses, rows, students } =
    useWorkspace();
  if (!detail || detail.missing)
    return (
      <div className="card empty">
        <h2>Record not found</h2>
        <Button onClick={() => go(page)}>Back to list</Button>
      </div>
    );
  if (
    role !== 'Admin' &&
    ((['My Courses', 'Courses'].includes(page) && !courses.some((c) => c.title === detail.title)) ||
      (['Assignments', 'Projects', 'Classes', 'Assessments', 'Students', 'Certificates'].includes(
        page,
      ) &&
        !(page === 'Students'
          ? students.includes(detail.title)
          : rows.some((row) => row[0] === detail.title))))
  )
    return (
      <div className="card empty">
        <h2>Not assigned to this workspace</h2>
        <p>Review the course and batch assignments with your administrator.</p>
        <Button onClick={() => go(page)}>Back to list</Button>
      </div>
    );
  if (['My Courses', 'Courses'].includes(page)) return <LearningCenter />;
  if (['Assignments', 'Projects'].includes(page)) return <SubmissionCenter />;
  if (page === 'Assessments') return <AssessmentScreen />;
  if (page === 'Certificates') return <CertificateCenter />;
  if (page === 'Batches') return <BatchCenter />;
  if (page === 'Career') return <OpportunityCenter />;
  if (['Content', 'Learning Materials'].includes(page)) return <ResourceLibrary />;
  if (['Students', 'Mentors'].includes(page)) return <PersonCenter />;
  if (page === 'Announcements') return <AnnouncementCenter />;
  if (page === 'Question Bank') return <QuestionEditor bank />;
  if (page === 'Classes') {
    const info = records[detail.title] || {};
    return (
      <div className="card detail-copy">
        <h2>{detail.title}</h2>
        <p>
          {info.Course || detail.row?.[1]} · {info.Deadline || detail.row?.[2]} ·{' '}
          {info.Time || '6:00–7:30 PM IST'}
        </p>
        <p>
          Mentor: {info.Mentor || detail.row?.[4]} ·{' '}
          {info.Instructions || 'Guided class activity and mentor questions.'}
        </p>
        {info['Meeting URL'] ? (
          <a className="btn" href={info['Meeting URL']} target="_blank" rel="noreferrer">
            Join class
          </a>
        ) : (
          <p>Meeting link has not been added yet.</p>
        )}
        {role !== 'Student' && (
          <div className="form-actions">
            <Button onClick={() => setModal('Edit class')}>Manage class</Button>
            <Button secondary onClick={() => go('Attendance')}>
              Take attendance
            </Button>
          </div>
        )}
      </div>
    );
  }
  return <SpecialRecordDetail />;
}
