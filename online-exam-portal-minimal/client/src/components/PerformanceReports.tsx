import { useEffect, useState } from 'react';

type Report = {
  id: string;
  student: {
    name: string;
    email: string;
  };
  exam: {
    title: string;
    totalMarks: number;
  };
  score: number;
  totalMarks: number;
  percentage: number;
  submittedAt: string;
};

export default function PerformanceReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadReports() {
      try {
        const response = await fetch('/api/admin/reports/performance');

        if (!response.ok) {
          throw new Error('Unable to load reports');
        }

        setReports(await response.json());
      } catch {
        setError('Could not load student performance reports.');
      }
    }

    loadReports();
  }, []);

  return (
    <section className="panel">
      <h2>Student Performance Reports</h2>

      {error && <p role="alert">{error}</p>}

      {!error && reports.length === 0 && (
        <p>No student performance records are available.</p>
      )}

      {reports.length > 0 && (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Examination</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{report.student.name}</td>
                  <td>{report.student.email}</td>
                  <td>{report.exam.title}</td>
                  <td>
                    {report.score}/{report.totalMarks}
                  </td>
                  <td>{report.percentage}%</td>
                  <td>
                    {new Date(report.submittedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
