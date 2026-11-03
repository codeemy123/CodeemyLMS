'use client';
import { Button, Badge } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
export default function AnnouncementCenter() {
  const { detail, role, records, workflows, setWorkflows, notify } = useWorkspace();
  const title = detail.title;
  const value = workflows.announcements[title] || {
    body:
      records[title]?.Instructions ||
      'Please review your class schedule and assessment instructions before the next session.',
    audience: detail.row?.[1] || 'All students',
    status: 'Published',
    history: [],
  };
  return (
    <div className="card">
      <h2>{title}</h2>
      <Badge>{value.status}</Badge>
      <p>Audience: {value.audience}</p>
      <p>{value.body}</p>
      {role !== 'Student' && (
        <form
          className="lower"
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            setWorkflows((w) => ({
              ...w,
              announcements: {
                ...w.announcements,
                [title]: {
                  body: d.get('body'),
                  audience: d.get('audience'),
                  status: d.get('status'),
                  history: [
                    ...value.history,
                    {
                      author: role,
                      actorName: role === 'Mentor' ? 'Arjun Kumar' : 'Academy Admin',
                      date: new Date().toISOString(),
                      status: d.get('status'),
                    },
                  ],
                },
              },
            }));
            notify('Announcement published to selected audience');
          }}
        >
          <label className="field">
            Audience
            <select name="audience" aria-label="Audience" defaultValue={value.audience}>
              <option>All students</option>
              <option>All mentors</option>
              <option>All admins</option>
              {Object.keys(workflows.batches).map((batch) => (
                <option key={batch}>{batch}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Announcement message
            <textarea name="body" defaultValue={value.body} required />
          </label>
          <label className="field">
            Publication status
            <select name="status" defaultValue={value.status}>
              <option>Draft</option>
              <option>Published</option>
              <option>Archived</option>
            </select>
          </label>
          <div className="form-actions">
            <Button type="submit">Save announcement</Button>
          </div>
          <h3 style={{ marginTop: 20 }}>Publication history</h3>
          {value.history.map((h, i) => (
            <p key={i}>
              {h.status} · {h.author} · {h.date}
            </p>
          ))}
        </form>
      )}
    </div>
  );
}
