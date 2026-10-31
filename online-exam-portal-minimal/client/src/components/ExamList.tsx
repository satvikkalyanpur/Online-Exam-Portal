import { useEffect, useState } from 'react';
import type { Exam } from '../types';
import { hasSavedAttempt } from '../storage/attemptStorage';

interface ExamListProps {
  exams: Exam[];
  onStart: (exam: Exam) => void;
}

/** Opening time in milliseconds, or null when the exam has no schedule. */
function startTime(exam: Exam): number | null {
  if (!exam.startAt) return null;
  const time = new Date(exam.startAt).getTime();
  return Number.isNaN(time) ? null : time;
}

function isOpen(exam: Exam, now: number) {
  const start = startTime(exam);
  return start === null || now >= start;
}

function formatCountdown(milliseconds: number) {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const clock = [hours, minutes, seconds]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
  return days > 0 ? `${days}d ${clock}` : clock;
}

export default function ExamList({ exams, onStart }: ExamListProps) {
  const [now, setNow] = useState(() => Date.now());

  // Re-check the schedule every second while any exam is still locked, so
  // an exam becomes available as soon as its start time is reached.
  const anyLocked = exams.some((exam) => !isOpen(exam, now));
  useEffect(() => {
    if (!anyLocked) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [anyLocked]);

  // The schedule is checked again at the moment of starting, so a locked
  // exam can never be opened early.
  function handleStart(exam: Exam) {
    if (!isOpen(exam, Date.now())) return;
    onStart(exam);
  }

  return (
    <section className="panel">
      <h2>Available Examinations</h2>
      <p>Select an examination to view its questions and begin.</p>

      <div className="exam-list">
        {exams.map((exam) => {
          // An exam whose questions were all deleted can't be started.
          const hasQuestions = exam.questions.length > 0;
          // An exam with auto-saved answers can be resumed.
          const inProgress = hasQuestions && hasSavedAttempt(exam.id);

          const open = isOpen(exam, now);
          const start = startTime(exam);
          const canStart = hasQuestions && open;

          return (
            <article className="exam-card" key={exam.id}>
              <div>
                <span className={`status ${canStart ? '' : 'status-unavailable'}`}>
                  {!hasQuestions
                    ? 'Unavailable'
                    : !open
                      ? 'Not yet open'
                      : inProgress
                        ? 'In progress'
                        : 'Available'}
                </span>
                <h3>{exam.title}</h3>
                <p>{exam.subject}</p>
                <p>
                  {hasQuestions
                    ? `${exam.questions.length} questions · ${exam.duration} minutes`
                    : 'No questions available'}
                </p>
                {!open && start !== null && (
                  <p role="status">
                    This examination opens on {new Date(start).toLocaleString()}{' '}
                    (in {formatCountdown(start - now)}).
                  </p>
                )}
              </div>

              <button
                className="submit-button"
                disabled={!canStart}
                onClick={() => handleStart(exam)}
              >
                {!open
                  ? 'Not yet available'
                  : inProgress
                    ? 'Resume examination'
                    : 'Start examination'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}