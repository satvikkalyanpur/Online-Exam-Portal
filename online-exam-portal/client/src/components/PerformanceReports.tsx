// US16: student performance reports for administrators.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { ExamSummary, PerformanceRow } from '../types';
import { formatDateTime } from '../format';

function average(values: number[]) {
  return values.length ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10 : 0;
}

function downloadCsv(rows: PerformanceRow[]) {
  const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const lines = [
    ['Student', 'Email', 'Examination', 'Subject', 'Score', 'Out of', 'Percentage', 'Submitted', 'Submitted automatically'],
    ...rows.map((r) => [
      r.student.name,
      r.student.email,
      r.exam.title,
      r.exam.subject,
      r.score,
      r.maxScore,
      r.percentage,
      new Date(r.submittedAt).toLocaleString(),
      r.autoSubmitted ? 'Yes' : 'No',
    ]),
  ].map((line) => line.map(quote).join(','));

  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `performance-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function PerformanceReports() {
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [examId, setExamId] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<PerformanceRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<ExamSummary[]>('/exams')
      .then(setExams)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setRows(null);
    api<PerformanceRow[]>(`/reports/performance${examId ? `?examId=${encodeURIComponent(examId)}` : ''}`)
      .then(setRows)
      .catch((err: Error) => setError(err.message));
  }, [examId]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!rows || !term) return rows ?? [];
    return rows.filter((r) => `${r.student.name} ${r.student.email}`.toLowerCase().includes(term));
  }, [rows, search]);

  // One line per student: how many exams, average, best and lowest.
  const students = useMemo(() => {
    const byStudent = new Map<string, { name: string; email: string; percents: number[] }>();
    for (const r of visible) {
      const entry = byStudent.get(r.student.id) ?? { name: r.student.name, email: r.student.email, percents: [] };
      entry.percents.push(r.percentage);
      byStudent.set(r.student.id, entry);
    }
    return [...byStudent.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [visible]);

  return (
    <section>
      <div className="section-head">
        <div>
          <h1>Student performance</h1>
          <p className="muted">Results of every submitted examination.</p>
        </div>
        <button className="secondary" onClick={() => downloadCsv(visible)} disabled={!visible.length}>
          Download CSV
        </button>
      </div>

      <div className="toolbar">
        <label className="field field-inline">
          <span>Examination</span>
          <select value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">All examinations</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field field-inline">
          <span>Student</span>
          <input type="search" placeholder="Name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>

      {error && <div className="notice notice-error">{error}</div>}
      {!rows && !error && <p className="muted">Loading report…</p>}
      {rows && visible.length === 0 && <div className="empty">No submitted examinations match.</div>}

      {students.length > 0 && (
        <>
          <h2 className="table-title">By student</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th className="num">Exams taken</th>
                  <th className="num">Average</th>
                  <th className="num">Highest</th>
                  <th className="num">Lowest</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.email}>
                    <td>
                      {s.name}
                      <div className="muted small-text">{s.email}</div>
                    </td>
                    <td className="num">{s.percents.length}</td>
                    <td className="num">{average(s.percents)}%</td>
                    <td className="num">{Math.max(...s.percents)}%</td>
                    <td className="num">{Math.min(...s.percents)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="table-title">All results</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Examination</th>
                  <th className="num">Score</th>
                  <th className="num">%</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.student.name}
                      <div className="muted small-text">{r.student.email}</div>
                    </td>
                    <td>
                      {r.exam.title}
                      <div className="muted small-text">{r.exam.subject}</div>
                    </td>
                    <td className="num">
                      {r.score}/{r.maxScore}
                    </td>
                    <td className="num">{r.percentage}%</td>
                    <td>
                      {formatDateTime(r.submittedAt)}
                      {r.autoSubmitted && <div className="muted small-text">automatically</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
