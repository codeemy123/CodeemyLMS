'use client';
import { useEffect, useState } from 'react';
import { api } from '@/features/database/api';
export default function AdminInsights({ audit = false }) {
  const [data, setData] = useState(null),
    [error, setError] = useState('');
  useEffect(() => {
    api(audit ? '/api/admin/audit' : '/api/admin/overview')
      .then(setData)
      .catch((e) => setError(e.message));
  }, [audit]);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p>Loading database records...</p>;
  return audit ? (
    <section className="academy-panel admin-audit">
      <h2>Audit history</h2>
      <p>Recent recorded actions. History is kept read-only.</p>
      {data.events.map((event) => (
        <div className="task-row" key={event.id}>
          <div>
            <strong>{event.action.replaceAll('_', ' ')}</strong>
            <p>
              {event.users?.full_name || 'System'} &middot; {event.entity_type || 'Workspace'}{' '}
              &middot;{' '}
              {new Date(event.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
            </p>
          </div>
        </div>
      ))}
      {!data.events.length && <p>No recorded actions yet.</p>}
    </section>
  ) : (
    <section className="academy-panel admin-audit">
      <div className="section-head">
        <h2>Academy report</h2>
        <button
          className="btn secondary"
          onClick={() => {
            const rows = [
              'Metric,Count',
              ...Object.entries(data.counts).map(([label, value]) => label + ',' + value),
            ];
            const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'codeemy-academy-report.csv';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export CSV
        </button>
      </div>
      <div className="academy-metrics">
        {Object.entries(data.counts).map(([label, value]) => (
          <div className="academy-metric" key={label}>
            <span className="academy-metric-value">{value}</span>
            <strong>{label[0].toUpperCase() + label.slice(1)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
