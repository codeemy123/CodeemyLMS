'use client';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
export default function FormFields({ fields, values = {} }) {
  const { detail, courses, mentors, workflows, records, page } = useWorkspace();
  const course = courses.find((c) => c.title === detail?.title);
  const row = detail?.row || [];
  const batch = page === 'Batches' ? workflows.batches[detail?.title] : null;
  const deadline = (row[2] || '').split(' · ')[0];
  const parsedDeadline = Date.parse(deadline);
  const saved = {
    ...(detail
      ? {
          Course: batch?.course || (courses.some((c) => c.title === row[1]) ? row[1] : undefined),
          Mentor: batch?.mentor,
          Status: row[3],
          Deadline: Number.isFinite(parsedDeadline)
            ? new Date(parsedDeadline - new Date(parsedDeadline).getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 10)
            : undefined,
        }
      : {}),
    ...(course
      ? {
          Title: course.title,
          Mentor: course.mentor,
          Description: course.description || '',
          Status: course.status,
        }
      : {}),
    ...(detail ? records[detail.title] : {}),
    ...values,
  };
  const numeric = [
    'Marks',
    'Max marks',
    'Duration',
    'Pass marks',
    'Attempts',
    'Session timeout (minutes)',
    'Default batch size',
  ];
  return (
    <div className="form-grid">
      {fields.map((label) => (
        <label
          className={
            'field ' +
            ([
              'Instructions',
              'Feedback',
              'Description',
              'Message',
              'Objectives',
              'Guidelines',
            ].includes(label)
              ? 'full'
              : '')
          }
          key={label}
        >
          {label}
          {[
            'Instructions',
            'Feedback',
            'Description',
            'Message',
            'Objectives',
            'Guidelines',
          ].includes(label) ? (
            <textarea name={label} required defaultValue={saved[label] || ''} />
          ) : label === 'Course' ? (
            <select name={label} aria-label={label} defaultValue={saved[label]}>
              {courses.map((c) => (
                <option key={c.title}>{c.title}</option>
              ))}
            </select>
          ) : ['Mentor', 'Batch'].includes(label) ? (
            <select name={label} aria-label={label} defaultValue={saved[label]}>
              {(label === 'Mentor' ? mentors : Object.keys(workflows.batches)).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          ) : label === 'Status' ? (
            <select name={label} aria-label={label} defaultValue={saved[label]}>
              {[
                'Active',
                'Inactive',
                'Approved',
                'Rejected',
                'Resubmission',
                'Rework',
                'Completed',
                'Upcoming',
                'Draft',
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              name={label}
              type={
                label.toLowerCase().includes('email')
                  ? 'email'
                  : ['Deadline', 'Start date', 'End date', 'Issue date'].includes(label)
                    ? 'date'
                    : numeric.includes(label)
                      ? 'number'
                      : label.includes('URL')
                        ? 'url'
                        : 'text'
              }
              min={['Marks', 'Pass marks'].includes(label) ? 0 : 1}
              max={
                label === 'Marks' || label === 'Pass marks'
                  ? 100
                  : label === 'Duration'
                    ? 180
                    : label === 'Attempts'
                      ? 10
                      : undefined
              }
              required={label !== 'College name'}
              defaultValue={
                saved[label] ?? (['Name', 'Title'].includes(label) && detail ? detail.title : '')
              }
            />
          )}
        </label>
      ))}
    </div>
  );
}
