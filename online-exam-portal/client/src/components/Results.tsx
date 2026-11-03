// US15: a student's examination results.
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ResultDetail, ResultSummary } from '../types';
import { formatDateTime, plural } from '../format';

interface ResultsProps {
  openId: string | null;
  onOpen: (attemptId: string | null) => void;
}

export default function Results({ openId, onOpen }: ResultsProps) {
  return openId ? <ResultView attemptId={openId} onBack={() => onOpen(null)} /> : <ResultList onOpen={onOpen} />;
}

function ResultList({ onOpen }: { onOpen: (attemptId: string) => void }) {
  const [results, setResults] = useState<ResultSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<ResultSummary[]>('/results')
      .then(setResults)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <section>
      <div className="section-head">
        <div>
          <h1>My results</h1>
          <p className="muted">Results appear here as soon as an examination is submitted and marked.</p>
        </div>
      </div>

      {error && <div className="notice notice-error">{error}</div>}
      {!results && !error && <p className="muted">Loading results…</p>}
      {results?.length === 0 && <div className="empty">You have no results yet.</div>}

      <div className="exam-list">
        {results?.map((r) => (
          <article className="panel exam-card" key={r.id}>
            <div className="exam-card-main">
              <span className="subject">{r.exam.subject}</span>
              <h2>{r.exam.title}</h2>
              <p className="muted small-text">
                Submitted {formatDateTime(r.submittedAt)}
                {r.autoSubmitted && ' · submitted automatically when time ran out'}
              </p>
            </div>
            <div className="exam-card-action">
              <p className="score-line">
                {r.score}/{r.maxScore} <span className="muted">({r.percentage}%)</span>
              </p>
              <button className="secondary" onClick={() => onOpen(r.id)}>
                View details
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ResultView({ attemptId, onBack }: { attemptId: string; onBack: () => void }) {
  const [result, setResult] = useState<ResultDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<ResultDetail>(`/results/${attemptId}`)
      .then(setResult)
      .catch((err: Error) => setError(err.message));
  }, [attemptId]);

  if (error) {
    return (
      <section>
        <div className="notice notice-error">{error}</div>
        <button className="secondary" onClick={onBack}>
          Back to results
        </button>
      </section>
    );
  }
  if (!result) return <p className="muted">Loading result…</p>;

  const correctCount = result.questions.filter((q) => q.isCorrect).length;
  const answeredCount = result.questions.filter((q) => q.selectedOption).length;

  return (
    <section>
      <button className="link-button" onClick={onBack}>
        ← All results
      </button>

      <div className="panel result-head">
        <div>
          <p className="eyebrow">{result.exam.subject}</p>
          <h1>{result.exam.title}</h1>
          <p className="muted small-text">
            Submitted {formatDateTime(result.submittedAt)}
            {result.autoSubmitted && ' · submitted automatically when time ran out'}
          </p>
        </div>
        <div className="score-box">
          <span className="score-big">
            {result.score} / {result.maxScore}
          </span>
          <span>{result.percentage}%</span>
        </div>
      </div>

      <p className="muted">
        {result.answersVisible
          ? `${correctCount} of ${plural(result.questions.length, 'question')} answered correctly.`
          : `You answered ${answeredCount} of ${plural(result.questions.length, 'question')}. Which answers were ` +
            `right will be shown here after the examination closes on ${formatDateTime(result.exam.endAt)}.`}
      </p>

      <ol className="question-list">
        {result.questions.map((q, i) => (
          <li
            key={q.id}
            className={`panel result-question ${q.isCorrect === null ? '' : q.isCorrect ? 'is-correct' : 'is-wrong'}`}
          >
            <div className="question-head">
              <span className="question-number">Question {i + 1}</span>
              {q.isCorrect === null ? (
                <span className="muted small-text">
                  {q.selectedOption ? 'Answered' : 'Not answered'} · {plural(q.marks, 'mark')}
                </span>
              ) : (
                <span className={q.isCorrect ? 'mark-correct' : 'mark-wrong'}>
                  {q.isCorrect
                    ? `Correct · ${plural(q.marks, 'mark')}`
                    : q.selectedOption
                      ? 'Incorrect · 0 marks'
                      : 'Not answered · 0 marks'}
                </span>
              )}
            </div>
            <p className="question-text">{q.text}</p>
            <ul className="bank-options">
              {q.options.map((o) => {
                const yours = o.key === q.selectedOption;
                const correct = o.key === q.correctOption;
                return (
                  <li key={o.key} className={correct ? 'bank-correct' : yours && q.isCorrect === false ? 'bank-wrong' : ''}>
                    <span className="option-key">{o.key}</span>
                    {o.text}
                    {yours && <span className="answer-tag">Your answer</span>}
                    {correct && <span className="correct-tag">Correct answer</span>}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
