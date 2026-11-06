'use client';
import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Clock3,
  CheckCircle2,
  XCircle,
  Search,
  ArrowRight,
  RefreshCw,
  Mail,
  Phone,
  GraduationCap,
} from 'lucide-react';
import { api } from '@/features/database/api';
export default function AccountApprovals() {
  const [requests, setRequests] = useState([]),
    [filter, setFilter] = useState('PENDING'),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState(null),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState('');
  async function load() {
    try {
      setRequests((await api('/api/admin/approvals')).requests);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);
  const current = requests.find((r) => r.id === selected);
  const visible = requests.filter(
    (r) =>
      (filter === 'ALL' || r.status === filter) &&
      [r.user.full_name, r.user.email, r.user.role]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function decide(decision) {
    if (decision === 'REJECTED' && !reason.trim()) {
      setMessage('Enter a reason before rejecting this request.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await api('/api/admin/approvals/' + current.id, {
        method: 'POST',
        body: JSON.stringify({ decision, reason }),
      });
      setMessage(
        decision === 'APPROVED'
          ? 'Account approved. The applicant can now sign in.'
          : 'Request rejected. The reason is visible when the applicant signs in.',
      );
      await load();
      setSelected(null);
      setReason('');
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="approval-workspace">
      <section className="approval-banner">
        <span className="academy-icon sand">
          <ShieldCheck size={25} />
        </span>
        <div>
          <h2>A trusted start for every account.</h2>
          <p>Review new Student and Mentor registrations. You decide who joins your academy.</p>
        </div>
      </section>
      <div className="approval-summary">
        {[
          ['PENDING', 'Waiting for review', Clock3],
          ['APPROVED', 'Approved', CheckCircle2],
          ['REJECTED', 'Rejected', XCircle],
        ].map(([status, label, Icon]) => (
          <button
            key={status}
            className={filter === status ? 'selected' : ''}
            onClick={() => setFilter(status)}
          >
            <Icon size={21} />
            <span>
              <strong>{requests.filter((r) => r.status === status).length}</strong>
              <small>{label}</small>
            </span>
          </button>
        ))}
      </div>
      <section className="academy-panel">
        <div className="approval-toolbar">
          <div className="tabs">
            {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((status) => (
              <button
                key={status}
                className={filter === status ? 'selected' : ''}
                onClick={() => setFilter(status)}
              >
                {status === 'ALL' ? 'All requests' : status[0] + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <label className="approval-search">
            <Search size={16} />
            <input
              aria-label="Search registrations"
              placeholder="Search name, email or role"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button className="academy-text-button" onClick={load} aria-label="Refresh requests">
            <RefreshCw size={17} />
          </button>
        </div>
        {message && (
          <p role="status" className="approval-message">
            {message}
          </p>
        )}
        {loading ? (
          <p className="approval-message">Loading registration requests...</p>
        ) : visible.length ? (
          <div className="approval-rows">
            {visible.map((r) => (
              <article className="approval-row" key={r.id}>
                <span className="approval-avatar">
                  {r.user.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <div className="approval-person">
                  <strong>{r.user.full_name}</strong>
                  <small>{r.user.email}</small>
                </div>
                <span className="approval-role">
                  {r.user.role === 'STUDENT' ? 'Student' : 'Mentor'}
                </span>
                <span className={'approval-status ' + r.status.toLowerCase()}>
                  {r.status === 'PENDING'
                    ? 'Pending review'
                    : r.status === 'APPROVED'
                      ? 'Approved'
                      : 'Rejected'}
                </span>
                <small className="approval-date">
                  {new Intl.DateTimeFormat('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'Asia/Kolkata',
                  }).format(new Date(r.submittedAt))}
                </small>
                <button
                  className="btn secondary"
                  onClick={() => {
                    setSelected(r.id);
                    setReason('');
                    setMessage('');
                  }}
                >
                  {r.status === 'PENDING' ? 'Review' : 'View details'}
                  <ArrowRight size={14} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="academy-empty">
            <span className="academy-icon sage">
              <ShieldCheck size={30} />
            </span>
            <h3>{filter === 'PENDING' ? 'All caught up' : 'No matching requests'}</h3>
            <p>
              {filter === 'PENDING'
                ? 'New registrations will appear here for your review.'
                : 'Try another filter or search term.'}
            </p>
          </div>
        )}
      </section>
      {current && (
        <section className="academy-panel approval-detail" aria-label="Registration details">
          <div className="academy-panel-heading">
            <div>
              <span className="academy-overline">REGISTRATION REVIEW</span>
              <h2>{current.user.full_name}</h2>
            </div>
            <button className="academy-text-button" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <dl className="approval-details-grid">
            <div>
              <dt>Email</dt>
              <dd>{current.user.email}</dd>
            </div>
            <div>
              <dt>Requested role</dt>
              <dd>{current.user.role}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{current.user.phone || 'Not provided'}</dd>
            </div>
            <div>
              <dt>
                {current.user.role === 'STUDENT'
                  ? 'College / institution'
                  : 'Qualification / expertise'}
              </dt>
              <dd>
                {(current.user.role === 'STUDENT'
                  ? current.details?.college
                  : current.details?.qualification) || 'Not provided'}
              </dd>
            </div>
            <div>
              <dt>Email ownership at registration</dt>
              <dd>
                {current.details?.emailVerified
                  ? 'Verified by Firebase'
                  : 'Not yet verified; verify applicant contact details'}
              </dd>
            </div>
            <div>
              <dt>Applicant note</dt>
              <dd>{current.details?.message || 'No note provided'}</dd>
            </div>
          </dl>
          {current.status === 'PENDING' ? (
            <div className="approval-decision">
              <label>
                Review note / rejection reason
                <textarea
                  value={reason}
                  maxLength={2000}
                  rows={3}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Required when rejecting; optional when approving"
                />
              </label>
              <p>
                Check the applicant details before approving. Approval activates only the requested
                Student or Mentor role.
              </p>
              <div className="approval-actions">
                <button className="btn" disabled={busy} onClick={() => decide('APPROVED')}>
                  <CheckCircle2 size={17} />
                  Approve account
                </button>
                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => decide('REJECTED')}
                >
                  <XCircle size={17} />
                  Reject request
                </button>
              </div>
            </div>
          ) : (
            <div className="approval-decision">
              <p>
                <strong>{current.status === 'APPROVED' ? 'Approved' : 'Rejected'}</strong> by{' '}
                {current.reviewedBy || 'an administrator'}
              </p>
              <p>{current.reason || 'No review note.'}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
