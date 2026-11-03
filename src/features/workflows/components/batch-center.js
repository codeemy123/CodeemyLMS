'use client';
import { Button } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
export default function BatchCenter() {
  const { detail, courses, students, mentors, workflows, setWorkflows, notify, role } =
    useWorkspace();
  const title = detail.title;
  const batch = workflows.batches[title] || {
    course: detail.row?.[1] || courses[0].title,
    mentor: mentors[0],
    students: [],
  };
  return (
    <div className="detail-grid">
      <div className="card">
        <h2>{title}</h2>
        <p>
          {batch.course} · Mentor: {batch.mentor}
        </p>
        <h3 style={{ marginTop: 20 }}>Enrolled students · {batch.students.length}</h3>
        {batch.students.map((name) => (
          <div className="task-row" key={name}>
            {name}
          </div>
        ))}
        {!batch.students.length && <p>No students assigned yet.</p>}
      </div>
      <form
        className="card"
        key={title + JSON.stringify(batch)}
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          setWorkflows((w) => ({
            ...w,
            batches: {
              ...w.batches,
              [title]: {
                course: d.get('course'),
                mentor: d.get('mentor'),
                students: d.getAll('students'),
              },
            },
          }));
          notify('Batch course, mentor and student assignments saved');
        }}
      >
        <h2>Manage batch assignments</h2>
        <label className="field">
          Course
          <select name="course" aria-label="Course" defaultValue={batch.course}>
            {courses.map((c) => (
              <option key={c.title}>{c.title}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Mentor
          <select name="mentor" aria-label="Mentor" defaultValue={batch.mentor}>
            {mentors.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Assign students</legend>
          {students.map((name) => (
            <label className="choice" key={name}>
              <input
                type="checkbox"
                name="students"
                value={name}
                defaultChecked={batch.students.includes(name)}
              />{' '}
              {name}
            </label>
          ))}
        </fieldset>
        <div className="form-actions">
          <Button type="submit">Save assignments</Button>
        </div>
      </form>
    </div>
  );
}
