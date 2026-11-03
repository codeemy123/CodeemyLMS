'use client';

import { Upload } from 'lucide-react';
import { Button } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';

export default function WorkspaceDialog() {
  const {
    detail,
    modal,
    setModal,
    setRecords,
    lesson,
    question,
    answers,
    review,
    notify,
    save,
    formFields,
    questions,
    finishAssessment,
  } = useWorkspace();
  if (modal === 'Submit assessment')
    return (
      <>
        <h2>Ready to submit?</h2>
        <p style={{ margin: '20px 0' }}>
          {Object.keys(answers).length} of {questions.length} answered. {review.length} marked for
          review. Your answers will be evaluated when you submit.
        </p>
        <Button
          onClick={() => {
            finishAssessment('submitted');
          }}
        >
          Confirm submission
        </Button>
      </>
    );
  if (modal === 'Apply for opportunity')
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setRecords((r) => ({ ...r, [detail.title]: { applied: true } }));
          setModal(null);
          notify('Mock application submitted');
        }}
      >
        <h2>{modal}</h2>
        <div style={{ marginTop: 20 }}>
          {formFields(['Name', 'Email'])}
          <label className="field" style={{ marginTop: 20 }}>
            Resume
            <input type="file" accept=".pdf,.doc,.docx" required />
          </label>
        </div>
        <div className="form-actions">
          <Button type="submit">Submit application</Button>
        </div>
      </form>
    );
  const normalized = modal.toLowerCase();
  let fields = normalized.includes('announcement')
    ? ['Title', 'Course', 'Instructions', 'Deadline']
    : normalized.includes('assignment')
      ? ['Title', 'Course', 'Instructions', 'Deadline', 'Max marks']
      : normalized.includes('certificate')
        ? ['Title', 'Name', 'Certificate ID', 'Issue date']
        : modal.includes('Evaluate')
          ? ['Marks', 'Feedback', 'Status']
          : modal.includes('certificate')
            ? ['Certificate ID', 'Status', 'Instructions']
            : modal.includes('Assign')
              ? ['Name', 'Course', 'Batch']
              : normalized.includes('question')
                ? [
                    'Title',
                    'Question type',
                    'Option A',
                    'Option B',
                    'Option C',
                    'Correct answer',
                    'Marks',
                  ]
                : modal.toLowerCase().includes('student') || modal.toLowerCase().includes('mentor')
                  ? ['Name', 'Email', 'Status']
                  : modal.toLowerCase().includes('assessment')
                    ? ['Title', 'Course', 'Duration', 'Pass marks', 'Attempts', 'Instructions']
                    : modal.toLowerCase().includes('course')
                      ? ['Title', 'Description', 'Mentor', 'Start date', 'End date', 'Status']
                      : modal.toLowerCase().includes('project')
                        ? ['Title', 'Course', 'Objectives', 'Guidelines', 'Deadline']
                        : modal.toLowerCase().includes('class')
                          ? ['Title', 'Course', 'Deadline', 'Time', 'Meeting URL']
                          : modal.toLowerCase().includes('batch')
                            ? ['Title', 'Course', 'Mentor', 'Start date', 'End date', 'Status']
                            : ['Title', 'Course', 'Instructions', 'Deadline'];
  return (
    <form onSubmit={save}>
      <h2 style={{ marginBottom: 25 }}>{modal}</h2>
      {formFields(fields)}
      {modal.toLowerCase().includes('material') || modal.toLowerCase().includes('lesson') ? (
        <label className="field" style={{ marginTop: 20 }}>
          Upload resource
          <input type="file" />
        </label>
      ) : null}
      <div className="form-actions">
        <Button type="submit">Save</Button>
        <Button secondary onClick={() => setModal(null)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
