'use client';
import { useState } from 'react';
import { Button, Badge } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import { certificatePdf, saveDownload } from '@/lib/exports';

export default function CertificateCenter() {
  const { role, detail, workflows, setWorkflows, notify } = useWorkspace();
  const title = detail.title;
  const cert = workflows.certificates[title] || {
    name: 'Kavin Raj',
    number: 'CE-DEMO-' + title.slice(0, 6).toUpperCase(),
    date: new Date().toISOString().slice(0, 10),
    status: 'Not issued',
    events: [],
  };
  const [verification, setVerification] = useState(''),
    [reason, setReason] = useState('');
  function transition(action) {
    if (action === 'Revoked' && !reason.trim()) {
      notify('Enter a revocation reason');
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    setWorkflows((w) => ({
      ...w,
      certificates: {
        ...w.certificates,
        [title]: {
          ...cert,
          status: action === 'Reissued' ? 'Issued' : action,
          date,
          number:
            action === 'Reissued' ? cert.number + '-R' + (cert.events.length + 1) : cert.number,
          events: [...cert.events, { action, date, reason, number: cert.number }],
        },
      },
    }));
    notify('Certificate ' + action.toLowerCase());
  }
  return (
    <div className="card">
      <div className="certificate">
        <span className="tag">CODEEMY EDUTECH</span>
        <h2>Certificate of Completion</h2>
        <p>This recognizes</p>
        <h1>{cert.name}</h1>
        <p>for successfully completing</p>
        <h3>{title}</h3>
        <p>
          {cert.number} · {cert.date}
        </p>
        <Badge>{cert.status}</Badge>
        <p>Frontend credential preview</p>
      </div>
      <div className="form-actions">
        <Button
          onClick={() =>
            saveDownload(
              cert.number + '.pdf',
              certificatePdf({ ...cert, course: title }),
              'application/pdf',
            )
          }
        >
          Download PDF certificate
        </Button>
        <Button secondary onClick={() => window.print()}>
          Print / preview
        </Button>
      </div>
      <form
        className="toolbar lower"
        onSubmit={(e) => {
          e.preventDefault();
          const code = new FormData(e.currentTarget).get('code');
          const found = Object.values(workflows.certificates).find((c) => c.number === code);
          const superseded = Object.values(workflows.certificates).find((c) =>
            c.events.some((event) => event.number === code && event.action === 'Reissued'),
          );
          setVerification(
            found
              ? `${found.status} · ${found.name} · ${found.date}`
              : superseded
                ? `Superseded · ${superseded.name} · Reissued with a new ID`
                : 'Certificate not found',
          );
        }}
      >
        <input
          className="input"
          name="code"
          aria-label="Certificate verification ID"
          placeholder="Enter certificate ID"
          required
        />
        <Button type="submit">Verify certificate</Button>
      </form>
      {verification && (
        <div role="status" className="notice">
          {verification}
        </div>
      )}
      {role === 'Admin' && (
        <>
          <label className="field">
            Reason
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="form-actions">
            <Button secondary onClick={() => transition('Revoked')}>
              Revoke certificate
            </Button>
            <Button
              onClick={() => transition(cert.status === 'Not issued' ? 'Issued' : 'Reissued')}
            >
              {cert.status === 'Not issued' ? 'Issue certificate' : 'Reissue certificate'}
            </Button>
          </div>
          <h3 style={{ marginTop: 20 }}>Lifecycle history</h3>
          {cert.events.map((event, i) => (
            <div className="activity" key={i}>
              {event.action} · {event.date}
              <p>{event.reason}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
