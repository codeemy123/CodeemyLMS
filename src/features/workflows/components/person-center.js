'use client';
import { Button, Badge } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
export default function PersonCenter() {
  const {
    role,
    page,
    detail,
    workflows,
    setWorkflows,
    records,
    setRecords,
    baseRows,
    students,
    mentors,
    setModal,
    notify,
  } = useWorkspace();
  const name = detail.title;
  const assignments = Object.entries(workflows.batches).filter(([, batch]) =>
    page === 'Mentors' ? batch.mentor === name : batch.students.includes(name),
  );
  return (
    <div className="detail-grid">
      <div className="card">
        {records[name]?.photo && (
          <div className="avatar">
            <img
              className="profile-avatar-image"
              src={records[name].photo.data}
              alt={`${name} profile photo`}
            />
          </div>
        )}
        <h2>{name}</h2>
        <Badge>{records[name]?.status || 'Active'}</Badge>
        <p>
          {records[name]?.Email || name.toLowerCase().replaceAll(' ', '.') + '@codeemy.example'}
        </p>
        {records[name]?.Phone && <p>Phone: {records[name].Phone}</p>}
        {records[name]?.Location && <p>Location: {records[name].Location}</p>}
        {page === 'Students' && records[name]?.['College name'] && (
          <p>College: {records[name]['College name']}</p>
        )}
        <h3 style={{ marginTop: 20 }}>Course and batch assignments</h3>
        {assignments.map(([title, batch]) => (
          <div className="task-row" key={title}>
            <div>
              <strong>{title}</strong>
              <p>
                {batch.course} · Mentor: {batch.mentor}
              </p>
            </div>
          </div>
        ))}
        {!assignments.length && <p>No batch assigned yet.</p>}
        <h3 style={{ marginTop: 20 }}>Performance and submissions</h3>
        {workflows.submissions
          .filter((s) => s.student === name)
          .map((s) => (
            <div className="activity" key={s.id}>
              {s.title} · Revision {s.revision}
              <p>{(workflows.evaluations[s.id] || []).at(-1)?.feedback || 'Awaiting evaluation'}</p>
            </div>
          ))}
        {role === 'Admin' && (
          <div className="form-actions">
            <Button onClick={() => setModal('Edit ' + (page === 'Mentors' ? 'Mentor' : 'Student'))}>
              Edit details
            </Button>
            <Button
              secondary
              onClick={() => {
                setRecords((r) => ({
                  ...r,
                  [name]: {
                    ...r[name],
                    status: r[name]?.status === 'Inactive' ? 'Active' : 'Inactive',
                  },
                }));
                notify('Account status updated in demo');
              }}
            >
              Activate / deactivate
            </Button>
          </div>
        )}
      </div>
      {role === 'Admin' && (
        <form
          className="card"
          key={JSON.stringify(assignments)}
          onSubmit={(e) => {
            e.preventDefault();
            const selected = new FormData(e.currentTarget).getAll('batches');
            setWorkflows((w) => ({
              ...w,
              batches: Object.fromEntries(
                Object.entries(w.batches).map(([title, batch]) => [
                  title,
                  page === 'Mentors'
                    ? {
                        ...batch,
                        mentor: selected.includes(title)
                          ? name
                          : batch.mentor === name
                            ? mentors.find((n) => n !== name) || 'Unassigned'
                            : batch.mentor,
                      }
                    : {
                        ...batch,
                        students: selected.includes(title)
                          ? [...new Set([...batch.students, name])]
                          : batch.students.filter((n) => n !== name),
                      },
                ]),
              ),
            }));
            notify('Assignments saved');
          }}
        >
          <h2>Assign course / batch</h2>
          {Object.entries(workflows.batches).map(([title, batch]) => (
            <label className="choice" key={title}>
              <input
                type="checkbox"
                name="batches"
                value={title}
                defaultChecked={
                  page === 'Mentors' ? batch.mentor === name : batch.students.includes(name)
                }
              />{' '}
              {title} · {batch.course}
            </label>
          ))}
          <Button type="submit">Save person assignments</Button>
        </form>
      )}
    </div>
  );
}
