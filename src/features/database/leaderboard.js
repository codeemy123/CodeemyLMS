'use client';
import { useEffect, useState } from 'react';
import { api } from './api';
export default function DatabaseLeaderboard() {
  const [assessments, setAssessments] = useState([]),
    [batches, setBatches] = useState([]),
    [data, setData] = useState(null),
    [message, setMessage] = useState('');
  useEffect(() => {
    Promise.all([api('/api/assessments'), api('/api/batches')])
      .then(([a, b]) => {
        setAssessments(a.assessments);
        setBatches(b.batches);
      })
      .catch((e) => setMessage(e.message));
  }, []);
  return (
    <section className="card workflow-card">
      <h2>Batch leaderboard</h2>
      <form
        className="auth-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            setData(
              await api('/api/leaderboard?' + new URLSearchParams(new FormData(e.currentTarget))),
            );
            setMessage('');
          } catch (err) {
            setMessage(err.message);
            setData(null);
          }
        }}
      >
        <label>
          Assessment
          <select name="assessmentId" required>
            {assessments.map((a) => (
              <option value={a.id} key={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Batch
          <select name="batchId" required>
            {batches.map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <button>Show results</button>
      </form>
      <p role="status">{message}</p>
      {data && (
        <>
          <h3>{data.batch}</h3>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {data.records.map((r, i) => (
                <tr key={i}>
                  <td>{r.rank}</td>
                  <td>{r.name}</td>
                  <td>{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.records.length && <p>No evaluated attempts yet.</p>}
        </>
      )}
    </section>
  );
}
