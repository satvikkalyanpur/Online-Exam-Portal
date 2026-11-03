// Taking an exam: US08 attend, US09 timer, US10 auto-save, US11 navigation and
// review, US13 auto-submit, US14 score on submission, US19 offline answers.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api } from '../api';
import type { AttemptState, OptionKey, SubmitResult } from '../types';
import { formatCountdown, formatDuration, plural } from '../format';
import { readUnsent, useAnswerSync } from '../useAnswerSync';
import ConfirmDialog from './ConfirmDialog';

interface ExamAttemptProps {
  examId: string;
  onExit: () => void;
  onViewResult: (attemptId: string) => void;
}

// Which question was open and which were marked for review, kept per attempt on this device.
type Progress = { index: number; marked: string[] };
const progressKey = (attemptId: string) => `exam-portal:progress:${attemptId}`;

function readProgress(attemptId: string): Progress {
  try {
    const saved = JSON.parse(localStorage.getItem(progressKey(attemptId)) ?? 'null');
    if (saved && Number.isInteger(saved.index) && Array.isArray(saved.marked)) return saved;
  } catch {
    // Ignore unreadable data and start at the first question.
  }
  return { index: 0, marked: [] };
}

function writeProgress(attemptId: string, progress: Progress | null) {
  try {
    if (progress) localStorage.setItem(progressKey(attemptId), JSON.stringify(progress));
    else localStorage.removeItem(progressKey(attemptId));
  } catch {
    // Not essential.
  }
}

export default function ExamAttempt({ examId, onExit, onViewResult }: ExamAttemptProps) {
  const [data, setData] = useState<AttemptState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [index, setIndex] = useState(0);
  const [marked, setMarked] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [dialog, setDialog] = useState<'submit' | 'leave' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [rejected, setRejected] = useState('');
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [leaving, setLeaving] = useState(false);

  const attemptId = data?.attempt.id ?? null;
  const clockOffset = useRef(0);
  const started = useRef(false);
  const busy = useRef(false);

  const handleRejected = useCallback((_questionId: string, message: string) => setRejected(message), []);
  const sync = useAnswerSync(attemptId, handleRejected);

  // Start the exam, or carry on with an attempt already in progress.
  useEffect(() => {
    if (started.current) return; // React runs effects twice in development
    started.current = true;
    api<AttemptState>(`/exams/${examId}/attempt`, { method: 'POST' })
      .then((state) => {
        clockOffset.current = new Date(state.serverTime).getTime() - Date.now();
        const progress = readProgress(state.attempt.id);
        // Answers chosen offline before a refresh are newer than the server's copy.
        setAnswers({ ...state.answers, ...readUnsent(state.attempt.id) });
        setIndex(Math.min(progress.index, state.questions.length - 1));
        setMarked(progress.marked);
        setData(state);
      })
      .catch((error: Error) => setLoadError(error.message));
  }, [examId]);

  useEffect(() => {
    if (attemptId && !result) writeProgress(attemptId, { index, marked });
  }, [attemptId, index, marked, result]);

  // US09: count down to the deadline stored on the server.
  useEffect(() => {
    if (!data || result) return;
    const deadline = new Date(data.attempt.expiresAt).getTime();
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now() - clockOffset.current) / 1000)));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [data, result]);

  const timeUp = secondsLeft === 0;

  async function finish(auto: boolean) {
    if (!attemptId || busy.current) return;
    busy.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      const allSent = await sync.flush();
      if (!allSent && !auto) {
        setSubmitError(
          "You're offline, so your latest answers haven't reached the server yet. They are kept on this " +
            'device. Submit again once the connection is back.'
        );
        return;
      }
      const submitted = await api<SubmitResult>(`/attempts/${attemptId}/submit`, {
        method: 'POST',
        body: { auto },
      });
      sync.clear();
      writeProgress(attemptId, null);
      setDialog(null);
      setResult(submitted);
    } catch (error) {
      const offline = error instanceof ApiError && (error.status === 0 || error.status >= 500);
      setSubmitError(
        offline
          ? 'No connection. Your examination will be submitted as soon as the connection is back.'
          : error instanceof Error
            ? error.message
            : 'Could not submit.'
      );
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  // Send anything still waiting before leaving, so it isn't left behind on this device.
  async function leave() {
    setLeaving(true);
    const allSent = await sync.flush();
    setLeaving(false);
    if (allSent) onExit();
  }

  // US13: when the timer reaches zero, submit automatically, retrying until it gets through.
  useEffect(() => {
    if (!timeUp || result) return;
    const attempt = () => void finish(true);
    attempt();
    const timer = window.setInterval(attempt, 5000);
    window.addEventListener('online', attempt);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', attempt);
    };
    // Only re-run when the time runs out or the result arrives; finish() reads the latest state itself.
  }, [timeUp, result]);

  if (loadError) {
    return (
      <section className="panel">
        <h1>Unable to open the examination</h1>
        <div className="notice notice-error">{loadError}</div>
        <button className="secondary" onClick={onExit}>
          Back to examinations
        </button>
      </section>
    );
  }

  if (!data) return <p className="muted">Opening examination…</p>;

  const { exam, questions } = data;

  if (result) {
    return (
      <section className="panel result">
        <p className="eyebrow">{exam.subject}</p>
        <h1>Examination submitted</h1>
        <p>
          {result.autoSubmitted
            ? `Time ran out, so "${exam.title}" was submitted automatically with your saved answers.`
            : `"${exam.title}" has been submitted.`}
        </p>
        <div className="score-box">
          <span className="score-big">
            {result.score} / {result.maxScore}
          </span>
          <span>{result.percentage}%</span>
        </div>
        <p className="muted">
          You answered {result.answeredCount} of {plural(result.totalQuestions, 'question')}.
        </p>
        <div className="actions">
          <button className="primary" onClick={() => onViewResult(result.attemptId)}>
            View detailed result
          </button>
          <button className="secondary" onClick={onExit}>
            Back to examinations
          </button>
        </div>
      </section>
    );
  }

  if (questions.length === 0) {
    return (
      <section className="panel">
        <h1>{exam.title}</h1>
        <div className="notice notice-warning">
          This examination has no questions at the moment. Please contact your teacher.
        </div>
        <button className="secondary" onClick={onExit}>
          Back to examinations
        </button>
      </section>
    );
  }

  const question = questions[Math.min(Math.max(index, 0), questions.length - 1)];
  const answeredCount = questions.filter((q) => answers[q.id]).length;
  const unanswered = questions.length - answeredCount;
  const isLast = index === questions.length - 1;
  const locked = timeUp || submitting;

  function choose(option: OptionKey) {
    if (locked) return;
    setRejected('');
    setAnswers((previous) => ({ ...previous, [question.id]: option }));
    sync.saveAnswer(question.id, option);
  }

  function toggleMarked() {
    setMarked((list) => (list.includes(question.id) ? list.filter((id) => id !== question.id) : [...list, question.id]));
  }

  function goTo(i: number) {
    setIndex(i);
    setReviewing(false);
    window.scrollTo({ top: 0 });
  }

  const saveText = !answers[question.id]
    ? ''
    : sync.isUnsent(question.id)
      ? sync.offline
        ? 'Saved on this device. It will be sent when the connection is back.'
        : 'Saving…'
      : '✓ Answer saved';

  return (
    <section>
      <div className="exam-bar">
        <div className="exam-bar-title">
          <p className="eyebrow">{exam.subject}</p>
          <h1>{exam.title}</h1>
          <p className="muted">
            {plural(questions.length, 'question')} · {formatDuration(exam.durationMinutes)}
          </p>
        </div>
        <div
          className={`timer ${secondsLeft !== null && secondsLeft <= 60 ? 'timer-warning' : ''}`}
          role="timer"
          aria-label="Time remaining"
        >
          <span>Time remaining</span>
          <strong>{secondsLeft === null ? '--:--' : formatCountdown(secondsLeft)}</strong>
        </div>
      </div>

      {sync.offline && !timeUp && (
        <div className="notice notice-warning" role="alert">
          You are offline. Keep answering: your answers are saved on this device and will be sent when the
          connection is back.
        </div>
      )}
      {data.resumed && !timeUp && !sync.offline && (
        <div className="notice" role="status">
          Welcome back. Your saved answers have been restored and the timer has kept running.
        </div>
      )}
      {timeUp && (
        <div className="notice notice-warning" role="alert">
          Time is up. Your examination is being submitted with your saved answers…
          {submitError && <div className="small-text">{submitError}</div>}
        </div>
      )}
      {rejected && (
        <div className="notice notice-error" role="alert">
          {rejected}
        </div>
      )}

      <nav className="palette" aria-label="Questions">
        {questions.map((q, i) => {
          const classes = [
            'palette-btn',
            answers[q.id] ? 'palette-answered' : '',
            marked.includes(q.id) ? 'palette-marked' : '',
            i === index && !reviewing ? 'palette-current' : '',
          ].join(' ');
          return (
            <button
              key={q.id}
              className={classes}
              onClick={() => goTo(i)}
              aria-current={i === index && !reviewing ? 'step' : undefined}
              aria-label={`Question ${i + 1}${answers[q.id] ? ', answered' : ''}${marked.includes(q.id) ? ', marked for review' : ''}`}
            >
              {i + 1}
            </button>
          );
        })}
      </nav>
      <p className="palette-legend muted small-text">
        <span className="legend legend-answered" /> answered <span className="legend legend-marked" /> marked for review
      </p>

      {reviewing ? (
        <div className="panel review">
          <h2>Review your answers</h2>
          <p className="muted">
            Answered {answeredCount} of {questions.length}
            {marked.length > 0 && ` · ${plural(marked.length, 'question')} marked for review`}. Select a question to
            change it.
          </p>
          <ol className="review-list">
            {questions.map((q, i) => {
              const chosen = q.options.find((o) => o.key === answers[q.id]);
              return (
                <li key={q.id}>
                  <button className="review-row" onClick={() => goTo(i)}>
                    <span className="review-number">{i + 1}</span>
                    <span className="review-text">
                      <span className="review-question">{q.text}</span>
                      <span className={chosen ? 'review-answer' : 'review-missing'}>
                        {chosen ? `${chosen.key}. ${chosen.text}` : 'Not answered'}
                      </span>
                    </span>
                    {marked.includes(q.id) && <span className="flag">Marked</span>}
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="actions">
            <button className="secondary" onClick={() => goTo(index)}>
              Back to questions
            </button>
            <button className="primary" onClick={() => setDialog('submit')} disabled={locked}>
              Submit examination
            </button>
          </div>
        </div>
      ) : (
        <fieldset className="panel question" disabled={locked} key={question.id}>
          <legend className="sr-only">Question {index + 1}</legend>
          <div className="question-head">
            <span className="question-number">
              Question {index + 1} of {questions.length}
            </span>
            <span className="muted small-text">{plural(question.marks, 'mark')}</span>
          </div>
          <p className="question-text">{question.text}</p>

          <div className="options">
            {question.options.map((option) => (
              <label className={`option ${answers[question.id] === option.key ? 'option-selected' : ''}`} key={option.key}>
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={option.key}
                  checked={answers[question.id] === option.key}
                  onChange={() => choose(option.key)}
                />
                <span className="option-key">{option.key}</span>
                <span>{option.text}</span>
              </label>
            ))}
          </div>

          <div className="question-foot">
            <label className="checkbox mark-toggle">
              <input type="checkbox" checked={marked.includes(question.id)} onChange={toggleMarked} />
              <span>Mark for review</span>
            </label>
            <span className={`save-status ${sync.offline && sync.isUnsent(question.id) ? 'save-offline' : ''}`} aria-live="polite">
              {saveText}
            </span>
          </div>

          <div className="question-nav">
            <button className="secondary" onClick={() => goTo(index - 1)} disabled={index === 0}>
              ← Previous
            </button>
            {isLast ? (
              <button className="primary" onClick={() => setReviewing(true)}>
                Review answers
              </button>
            ) : (
              <button className="primary" onClick={() => goTo(index + 1)}>
                Next →
              </button>
            )}
          </div>
        </fieldset>
      )}

      <div className="attempt-footer">
        <span className="muted">
          Answered {answeredCount} of {questions.length}
        </span>
        <div className="actions">
          <button className="secondary small" onClick={() => setDialog('leave')}>
            Leave for now
          </button>
          {!reviewing && (
            <button className="secondary small" onClick={() => setReviewing(true)}>
              Review and submit
            </button>
          )}
        </div>
      </div>

      {dialog === 'submit' && (
        <ConfirmDialog
          title="Submit examination?"
          confirmLabel="Submit"
          busy={submitting}
          onConfirm={() => void finish(false)}
          onCancel={() => {
            setDialog(null);
            setSubmitError('');
          }}
        >
          {unanswered > 0 ? (
            <p>
              You have <strong>{plural(unanswered, 'unanswered question')}</strong>.
            </p>
          ) : (
            <p>You have answered every question.</p>
          )}
          {marked.length > 0 && <p>{plural(marked.length, 'question is', 'questions are')} still marked for review.</p>}
          <p>You cannot change your answers after submitting.</p>
          {submitError && <p className="form-error">{submitError}</p>}
        </ConfirmDialog>
      )}

      {dialog === 'leave' && (
        <ConfirmDialog
          title="Leave the examination?"
          confirmLabel={sync.unsentCount > 0 ? 'Leave anyway' : 'Leave'}
          busy={leaving}
          onConfirm={() => (sync.offline && sync.unsentCount > 0 ? onExit() : void leave())}
          onCancel={() => setDialog(null)}
        >
          {sync.unsentCount > 0 && sync.offline ? (
            <p className="form-error">
              {plural(sync.unsentCount, 'answer has', 'answers have')} not reached the server yet because there is
              no connection. They stay on this device and are sent when you come back to this exam, but if time
              runs out first they will not count.
            </p>
          ) : (
            <p>
              Your answers are saved and you can come back to it, but the timer keeps running. If time runs out
              while you are away, the examination is submitted automatically.
            </p>
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}
