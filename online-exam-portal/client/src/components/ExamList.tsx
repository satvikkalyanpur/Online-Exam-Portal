// US03 view available exams, US12 "not open yet" until the scheduled start.
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { AvailableExam } from '../types';
import { formatDate, formatDateTime, formatDuration, formatSchedule, formatWait, plural } from '../format';

interface ExamListProps {
  onStart: (examId: string) => void;
  onViewResult: (attemptId: string) => void;
}

type CardState = 'upcoming' | 'open' | 'in-progress' | 'submitted' | 'closed' | 'empty';

function cardState(exam: AvailableExam, now: number): CardState {
  if (exam.attempt?.status === 'SUBMITTED') return 'submitted';
  if (exam.attempt?.status === 'IN_PROGRESS') return 'in-progress';
  if (now < new Date(exam.startAt).getTime()) return 'upcoming';
  if (now >= new Date(exam.endAt).getTime()) return 'closed';
  if (exam.questionCount === 0) return 'empty';
  return 'open';
}

const BADGE: Record<CardState, { text: string; className: string }> = {
  upcoming: { text: 'Not open yet', className: 'status-muted' },
  open: { text: 'Open', className: '' },
  'in-progress': { text: 'In progress', className: 'status-progress' },
  submitted: { text: 'Submitted', className: 'status-done' },
  closed: { text: 'Closed', className: 'status-muted' },
  empty: { text: 'No questions yet', className: 'status-muted' },
};

export default function ExamList({ onStart, onViewResult }: ExamListProps) {
  const [exams, setExams] = useState<AvailableExam[] | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  // Difference between the server's clock and this computer's clock.
  const clockOffset = useRef(0);

  useEffect(() => {
    api<{ serverTime: string; exams: AvailableExam[] }>('/exams/available')
      .then((data) => {
        clockOffset.current = new Date(data.serverTime).getTime() - Date.now();
        setNow(Date.now() + clockOffset.current);
        setExams(data.exams);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  // Tick every second while an exam is waiting to open, so it unlocks on time.
  const waiting = exams?.some((exam) => cardState(exam, now) === 'upcoming');
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => setNow(Date.now() + clockOffset.current), 1000);
    return () => window.clearInterval(timer);
  }, [waiting]);

  return (
    <section>
      <div className="section-head">
        <div>
          <h1>Examinations</h1>
          <p className="muted">Your scheduled examinations.</p>
        </div>
      </div>

      {error && <div className="notice notice-error">{error}</div>}
      {!exams && !error && <p className="muted">Loading examinations…</p>}
      {exams?.length === 0 && <div className="empty">No examinations are scheduled right now.</div>}

      <div className="exam-list">
        {exams?.map((exam) => {
          const state = cardState(exam, now);
          const badge = BADGE[state];
          const attempt = exam.attempt;

          return (
            <article className="panel exam-card" key={exam.id}>
              <div className="exam-card-main">
                <div className="exam-card-top">
                  <span className="subject">{exam.subject}</span>
                  <span className={`status ${badge.className}`}>{badge.text}</span>
                </div>
                <h2>{exam.title}</h2>
                {exam.description && <p className="muted">{exam.description}</p>}

                <dl className="facts">
                  <div>
                    <dt>Date</dt>
                    <dd>{formatDate(exam.startAt)}</dd>
                  </div>
                  <div>
                    <dt>Duration</dt>
                    <dd>{formatDuration(exam.durationMinutes)}</dd>
                  </div>
                  <div>
                    <dt>Questions</dt>
                    <dd>{exam.questionCount}</dd>
                  </div>
                  <div>
                    <dt>Total marks</dt>
                    <dd>{exam.totalMarks}</dd>
                  </div>
                </dl>
                <p className="schedule">
                  <strong>Schedule:</strong> {formatSchedule(exam.startAt, exam.endAt)}
                </p>

                {state === 'upcoming' && (
                  <p className="opens-in" role="status">
                    Opens on {formatDateTime(exam.startAt)} — in {formatWait(new Date(exam.startAt).getTime() - now)}
                  </p>
                )}
                {state === 'in-progress' && attempt && (
                  <p className="opens-in">Your attempt is running. The timer ends at {formatDateTime(attempt.expiresAt)}.</p>
                )}
              </div>

              <div className="exam-card-action">
                {state === 'submitted' && attempt ? (
                  <>
                    <p className="score-line">
                      {attempt.score}/{attempt.maxScore} <span className="muted">({attempt.percentage}%)</span>
                    </p>
                    <button className="secondary" onClick={() => onViewResult(attempt.id)}>
                      View result
                    </button>
                  </>
                ) : state === 'in-progress' ? (
                  <button className="primary" onClick={() => onStart(exam.id)}>
                    Resume examination
                  </button>
                ) : state === 'open' ? (
                  <>
                    <button className="primary" onClick={() => onStart(exam.id)}>
                      Start examination
                    </button>
                    <span className="muted small-text">
                      {plural(exam.questionCount, 'question')} · {formatDuration(exam.durationMinutes)}
                    </span>
                  </>
                ) : (
                  <button className="secondary" disabled>
                    {state === 'upcoming' ? 'Not yet available' : state === 'closed' ? 'Closed' : 'Unavailable'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
