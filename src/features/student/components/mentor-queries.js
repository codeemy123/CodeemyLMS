'use client';

import { Button } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';

export default function MentorQueries() {
  const { detail, notify, formFields } = useWorkspace();
  return (
    <div className="detail-grid">
      <div className="card">
        <div className="user">
          <div className="avatar">AK</div>
          <div>
            <h2>Arjun Kumar</h2>
            <p>Senior full stack mentor</p>
          </div>
        </div>
        <div className="meta">8 years of experience · React · Node.js · JavaScript</div>
        <p>
          Your mentor for Full Stack Web Development. Office hours: Monday & Thursday, 5:00 – 6:00
          PM IST.
        </p>
        <h3 style={{ marginTop: 25 }}>Ask your mentor</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            notify('Query submitted in this demo session');
            e.currentTarget.reset();
          }}
        >
          {formFields(['Title', 'Message'])}
          <div className="form-actions">
            <Button type="submit">Send query</Button>
          </div>
        </form>
      </div>
      <div className="card">
        <h2>Your queries</h2>
        <div className="activity">
          How do I lift state between components?<span>Resolved · Sep 29, 2026</span>
          <p>Move shared state to the closest common parent and pass it through props.</p>
        </div>
        <div className="activity">
          Portfolio deployment guidance<span>Pending reply · Sep 30, 2026</span>
        </div>
      </div>
    </div>
  );
}
