import { useEffect, useState } from 'react';

type ExamResult = {
  id: string;
  examId: string;
  score: number;
  evaluated: boolean;
  evaluatedAt: string;
  exam: {
    id: string;
    title: string;
    totalMarks: number;
  };
};

export default function Results() {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      setError('Please log in to view your results.');
      setLoading(false);
      return;
    }

    fetch('/api/results/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load examination results.');
        }
        return response.json();
      })
      .then(setResults)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading results...</p>;
  if (error) return <p role="alert">{error}</p>;

  return (
    <main>
      <h1>My Examination Results</h1>
      {results.length === 0 ? (
        <p>No evaluated results are available yet.</p>
      ) : (
        <ul>
          {results.map((result) => (
            <li key={result.id}>
              <h2>{result.exam.title}</h2>
              <p>Score: {result.score} / {result.exam.totalMarks}</p>
              <p>Evaluated: {new Date(result.evaluatedAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
