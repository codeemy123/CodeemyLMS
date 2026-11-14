'use client';
import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { adminResources } from '@/config/admin-resources';
import { api } from '@/features/database/api';
import AdminRecordActions, { AdminRecordForm } from './admin-record-editor';
import AnnouncementPoster from '@/components/ui/announcement-poster';
export default function AdminCollection({ entity }) {
  const config = adminResources[entity];
  const [records, setRecords] = useState([]),
    [message, setMessage] = useState(''),
    [query, setQuery] = useState(''),
    [creating, setCreating] = useState(false),
    [loaded, setLoaded] = useState(false);
  async function refresh() {
    try {
      setRecords((await api('/api/admin/records/' + entity)).records);
      setLoaded(true);
    } catch (e) {
      setMessage(e.message);
    }
  }
  useEffect(() => {
    setRecords([]);
    setLoaded(false);
    setCreating(false);
    setQuery('');
    refresh();
  }, [entity]);
  const visible = records.filter((r) =>
    String(r.title || r.name || r.question_text || r.option_text || r.certificate_number || '')
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="admin-collection">
      <div className="toolbar">
        <label className="approval-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={'Search ' + config.label.toLowerCase()}
            aria-label={'Search ' + config.label.toLowerCase()}
          />
        </label>
        <button className="btn" onClick={() => setCreating((v) => !v)}>
          <Plus size={16} />
          Create {config.label.toLowerCase()}
        </button>
      </div>
      {message && <p role="alert">{message}</p>}
      {creating && (
        <section className="academy-panel admin-collection-editor">
          <h2>Create {config.label.toLowerCase()}</h2>
          <AdminRecordForm
            entity={entity}
            onSaved={async () => {
              await refresh();
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        </section>
      )}
      {visible.map((record) => (
        <article className="academy-panel admin-collection-item" key={record.id}>
          <div>
            <h2>
              {record.title ||
                record.name ||
                record.question_text ||
                record.option_text ||
                record.certificate_number}
            </h2>
            <p>{record.description || record.message || record.instructions || ''}</p>
            {entity === 'announcements' && <AnnouncementPoster record={record} />}
            {record.status && <span className="badge">{record.status}</span>}
            {record.question_type && <span className="badge">{record.question_type}</span>}
            {entity === 'options' && (
              <p>{record.is_correct ? 'Correct answer' : 'Answer option'}</p>
            )}
            {record.created_at && (
              <small>
                {new Date(record.created_at).toLocaleDateString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                })}
              </small>
            )}
          </div>
          <AdminRecordActions entity={entity} record={record} onSaved={refresh} />
        </article>
      ))}
      {loaded && !visible.length && (
        <div className="academy-panel academy-empty">
          <h3>No {config.label.toLowerCase()} records yet</h3>
          <p>Create your first record to get started.</p>
        </div>
      )}
    </div>
  );
}
