import { useEffect, useState } from 'react';

interface ExaminationStatistics {
  exam: {
    id: string;
    title: string;
    totalMarks: number;
  };
  totalAttempts: number;
  totalScore: number;
  highestScore: number;
  lowestScore: number;
  averageScore: number;
  averagePercentage: number;
}

interface StatisticsResponse {
  totalExams: number;
  totalAttempts: number;
  examinations: ExaminationStatistics[];
}

export default function AdminStatistics() {
  const [statistics, setStatistics] =
    useState<StatisticsResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadStatistics() {
      try {
        const token = localStorage.getItem('token');

        const response = await fetch('/api/admin/statistics', {
          headers: {
            Authorization: `Bearer ${token ?? ''}`,
          },
        });

        if (!response.ok) {
          throw new Error(
            response.status === 403
              ? 'Administrator access required.'
              : 'Unable to load examination statistics.',
          );
        }

        setStatistics(await response.json());
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load examination statistics.',
        );
      }
    }

    loadStatistics();
  }, []);

  if (error) {
    return <p role="alert">{error}</p>;
  }

  if (!statistics) {
    return <p>Loading examination statistics...</p>;
  }

  return (
    <section>
      <h2>Examination Statistics</h2>

      <div className="statistics-summary">
        <p>Total examinations: {statistics.totalExams}</p>
        <p>Total attempts: {statistics.totalAttempts}</p>
      </div>

      {statistics.examinations.length === 0 ? (
        <p>No examination results are available yet.</p>
      ) : (
        statistics.examinations.map((item) => (
          <article key={item.exam.id}>
            <h3>{item.exam.title}</h3>
            <p>Total attempts: {item.totalAttempts}</p>
            <p>Average score: {item.averageScore}</p>
            <p>
              Average percentage: {item.averagePercentage}%
            </p>
            <p>Highest score: {item.highestScore}</p>
            <p>Lowest score: {item.lowestScore}</p>
            <p>Total marks: {item.exam.totalMarks}</p>
          </article>
        ))
      )}
    </section>
  );
}
