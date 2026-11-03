'use client';
import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import { studentBatches, batchLeaderboard } from '@/lib/leaderboard';

export default function Leaderboard() {
  const { workflows, baseRows, records } = useWorkspace();
  const [batchChoice, setBatchChoice] = useState('');
  const [assessmentChoice, setAssessmentChoice] = useState('');
  const batches = studentBatches(workflows);
  const batchName = batches.some(([name]) => name === batchChoice) ? batchChoice : batches[0]?.[0];
  const batch = workflows.batches[batchName];
  const assessments = (baseRows.Assessments || []).filter((row) => row[1] === batch?.course);
  const assessment = assessments.some((row) => row[0] === assessmentChoice)
    ? assessmentChoice
    : assessments[0]?.[0];
  const ranking = batchLeaderboard(workflows, batchName, assessment);
  return (
    <div className="card leaderboard">
      <div className="section-head">
        <div>
          <h2>
            <Trophy size={22} aria-hidden="true" /> Batch leaderboard
          </h2>
          <p>Celebrate progress with your classmates.</p>
        </div>
      </div>
      {!batches.length ? (
        <p>No batch assigned yet. Your leaderboard will appear after enrollment.</p>
      ) : (
        <>
          <div className="form-grid">
            <label className="field">
              Batch
              <select
                aria-label="Leaderboard batch"
                value={batchName}
                onChange={(e) => {
                  setBatchChoice(e.target.value);
                  setAssessmentChoice('');
                }}
              >
                {batches.map(([name, b]) => (
                  <option key={name} value={name}>
                    {name} — {b.course}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Assessment
              <select
                aria-label="Leaderboard assessment"
                value={assessment || ''}
                onChange={(e) => setAssessmentChoice(e.target.value)}
                disabled={!assessments.length}
              >
                {!assessments.length && <option value="">No assessments yet</option>}
                {assessments.map((row) => (
                  <option key={row[0]}>{row[0]}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="leaderboard-summary">
            <strong>{batchName}</strong>
            <span>{batch.course}</span>
            <span>
              {ranking.length} ranked students · {batch.students.length} enrolled
            </span>
          </div>
          <p className="leaderboard-policy">
            Best completed attempt per student, ranked by score percentage. Equal scores share a
            rank. Interrupted attempts are excluded.
          </p>
          {!ranking.length ? (
            <div className="empty">
              <Trophy size={32} aria-hidden="true" />
              <h3>No scores published yet</h3>
              <p>Completed assessment scores for this batch will appear here.</p>
            </div>
          ) : (
            <>
              <div className="leaderboard-podium">
                {ranking
                  .filter((r) => r.rank <= 3)
                  .slice(0, 3)
                  .map((r) => (
                    <div className="leaderboard-performer" key={r.student}>
                      <span className="leaderboard-rank">
                        <Trophy size={17} aria-hidden="true" /> #{r.rank}
                      </span>
                      <strong>
                        {records[r.student]?.Name || r.student}
                        {r.student === 'Kavin Raj' ? ' (You)' : ''}
                      </strong>
                      <span>
                        {r.score} / {r.total} · {r.percent}%
                      </span>
                    </div>
                  ))}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Student</th>
                      <th>Score</th>
                      <th>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((r) => (
                      <tr
                        key={r.student}
                        className={r.student === 'Kavin Raj' ? 'leaderboard-current' : ''}
                      >
                        <td>#{r.rank}</td>
                        <td>
                          {records[r.student]?.Name || r.student}
                          {r.student === 'Kavin Raj' ? ' (You)' : ''}
                        </td>
                        <td>
                          {r.score} / {r.total}
                        </td>
                        <td>{r.percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
