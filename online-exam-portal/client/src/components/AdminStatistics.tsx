// US17: examination statistics for administrators.
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { StatisticsResponse } from '../types';
import { formatDate, formatPercent } from '../format';

export default function AdminStatistics() {
  const [stats, setStats] = useState<StatisticsResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<StatisticsResponse>('/reports/statistics')
      .then(setStats)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <div className="notice notice-error">{error}</div>;
  if (!stats) return <p className="muted">Loading statistics…</p>;

  const { summary } = stats;

  return (
    <section>
      <div className="section-head">
        <div>
          <h1>Examination statistics</h1>
          <p className="muted">Worked out from the marked results. A score of 40% or more counts as a pass.</p>
        </div>
      </div>

      <div className="stat-cards">
        <div className="panel stat-card">
          <span className="stat-value">{summary.examCount}</span>
          <span className="stat-label">Examinations</span>
        </div>
        <div className="panel stat-card">
          <span className="stat-value">{summary.submittedCount}</span>
          <span className="stat-label">Submissions</span>
        </div>
        <div className="panel stat-card">
          <span className="stat-value">{formatPercent(summary.averagePercentage)}</span>
          <span className="stat-label">Average score</span>
        </div>
        <div className="panel stat-card">
          <span className="stat-value">
            {summary.submittedCount ? `${Math.round((summary.passCount / summary.submittedCount) * 100)}%` : '–'}
          </span>
          <span className="stat-label">Pass rate</span>
        </div>
      </div>

      {stats.exams.length === 0 ? (
        <div className="empty">There are no published examinations yet.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Examination</th>
                <th className="num">Submitted</th>
                <th className="num">In progress</th>
                <th className="num">Average</th>
                <th className="num">Highest</th>
                <th className="num">Lowest</th>
                <th className="num">Passed</th>
              </tr>
            </thead>
            <tbody>
              {stats.exams.map((exam) => (
                <tr key={exam.id}>
                  <td>
                    {exam.title}
                    <div className="muted small-text">
                      {exam.subject} · {formatDate(exam.startAt)}
                      {exam.status !== 'PUBLISHED' && ' · draft'}
                    </div>
                  </td>
                  <td className="num">{exam.submittedCount}</td>
                  <td className="num">{exam.inProgressCount}</td>
                  <td className="num">{formatPercent(exam.averagePercentage)}</td>
                  <td className="num">{formatPercent(exam.highestPercentage)}</td>
                  <td className="num">{formatPercent(exam.lowestPercentage)}</td>
                  <td className="num">{exam.submittedCount ? `${exam.passCount} of ${exam.submittedCount}` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
