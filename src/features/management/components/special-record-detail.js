'use client';
import { Badge, Button } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';

export default function SpecialRecordDetail() {
  const { page, detail, records, setModal } = useWorkspace();
  const saved = records[detail.title] || {};
  const row = detail.row || [];
  return (
    <div className="card detail-copy">
      <Badge>{saved.Status || row[3] || 'Active'}</Badge>
      <h2 style={{ marginTop: 20 }}>{detail.title}</h2>
      {page === 'Announcements' && (
        <>
          <p>
            Audience: {row[1]} · Published: {row[2]}
          </p>
          <h3>Announcement</h3>
          <p>
            {saved.Instructions ||
              'The October assessment schedule is available. Check your assessment section for instructions and timings. Contact your mentor if you need help preparing.'}
          </p>
          <Button onClick={() => setModal('Edit announcement')}>Edit announcement</Button>
        </>
      )}
      {page === 'Question Bank' && (
        <>
          <p>
            Question type: {saved['Question type'] || 'Single-choice MCQ'} · {row[4]}
          </p>
          <h3>Question and options</h3>
          <p>
            {saved.Title ||
              'Which JavaScript method creates a new array by transforming every element?'}
          </p>
          {['map()', 'push()', 'pop()'].map((option, i) => (
            <div className="choice" key={option}>
              {saved['Option ' + String.fromCharCode(65 + i)] || option}
              {i === 0 && <Badge>Correct answer</Badge>}
            </div>
          ))}
          <Button onClick={() => setModal('Edit question')}>Edit question</Button>
        </>
      )}
      {page === 'Audit Log' && (
        <>
          <p>
            Actor: {row[1]} · Time: {row[2]}
          </p>
          <h3>Activity details</h3>
          <p>Category: {row[4]}. This is a read-only mock record of an academy action.</p>
          <div className="notice">Audit records cannot be edited from this preview.</div>
        </>
      )}
      {page === 'Feedback' && (
        <>
          <p>
            Course: {row[1]} · Reviewed: {row[2]} · Marks: {row[4]}
          </p>
          <h3>Mentor feedback</h3>
          <p>
            {saved.Feedback ||
              'Strong progress on your portfolio. Review keyboard navigation and add clear labels to each form control before your next submission.'}
          </p>
          <Button onClick={() => setModal('Evaluate feedback')}>Update feedback</Button>
        </>
      )}
    </div>
  );
}
