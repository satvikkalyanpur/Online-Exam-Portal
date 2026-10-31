import { useEffect, useRef, useState } from 'react';
import type { Answers, Exam } from '../types';
import {
  clearAttempt,
  restoreAttempt,
  saveAttempt,
} from '../storage/attemptStorage';
import { submitAttempt } from '../api/submissions';

interface ExamAttemptProps {
  exam: Exam;
  onExit: () => void;
}

type StoreStatus = 'idle' | 'saving' | 'saved' | 'failed';

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function ExamAttempt({ exam, onExit }: ExamAttemptProps) {
  // Restore saved progress (answers, position, deadline) or start fresh.
  const [initial] = useState(() => restoreAttempt(exam));

  const [answers, setAnswers] = useState<Answers>(initial.answers);
  const [currentIndex, setCurrentIndex] = useState(initial.currentIndex);
  const [submitted, setSubmitted] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [storeStatus, setStoreStatus] = useState<StoreStatus>('idle');
  const [timeLeft, setTimeLeft] = useState(() =>
    Math.max(0, Math.ceil((initial.deadline - Date.now()) / 1000))
  );
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  // Fixed deadline: the countdown stays accurate even if the browser
  // throttles timers in a background tab, and survives a page refresh.
  const deadline = useRef(initial.deadline);
  // Set once the exam is finished so nothing is saved or submitted again.
  const finished = useRef(false);
  // The timer is set up once, so it reads the latest answers from here.
  const answersRef = useRef<Answers>(initial.answers);
  // Whether the exam was submitted by the timer rather than the student.
  const autoSubmitted = useRef(false);

  async function storeSubmission() {
    setStoreStatus('saving');
    const ok = await submitAttempt(
      exam,
      answersRef.current,
      autoSubmitted.current
    );
    setStoreStatus(ok ? 'saved' : 'failed');
  }

  function finish(auto: boolean) {
    // A manual and an automatic submit must never both go through.
    if (finished.current) return;
    finished.current = true;
    autoSubmitted.current = auto;
    clearAttempt(exam.id);
    setSubmitted(true);
    void storeSubmission();
  }

  // Keep the ref in step with the answers (declared before the timer effect).
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Auto-save: runs on start and every time an answer or the current
  // question changes. (Declared before the timer effect on purpose, so an
  // already-expired attempt is cleared after, not before, this save.)
  useEffect(() => {
    if (submitted || finished.current) return;

    const ok = saveAttempt(exam.id, {
      answers,
      deadline: deadline.current,
      currentIndex,
    });
    setSaveFailed(!ok);
    if (ok) setLastSaved(new Date());
  }, [answers, currentIndex, submitted, exam.id]);

  // Countdown timer – runs only while the exam is in progress.
  useEffect(() => {
    if (submitted) return;

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((deadline.current - Date.now()) / 1000)
      );
      setTimeLeft(remaining);

      // Automatically submit when the time limit is reached.
      if (remaining === 0) {
        finish(true);
      }
    };

    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const answeredCount = Object.keys(answers).length;
  const total = exam.questions.length;
  const unansweredCount = total - answeredCount;
  const question = exam.questions[currentIndex];

  function selectAnswer(questionId: number, option: string) {
    setAnswers((previous) => ({ ...previous, [questionId]: option }));
  }

  function goTo(index: number) {
    setCurrentIndex(Math.min(Math.max(index, 0), total - 1));
  }

  // Jump to a question from the review screen and go back to answering.
  function goToFromReview(index: number) {
    goTo(index);
    setReviewing(false);
  }

  // Called from the review screen, which has already shown any unanswered
  // questions, so no second confirmation is needed here.
  function submitExam() {
    // Freeze the displayed time at the moment of submission.
    setTimeLeft(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    finish(false);
  }

  function cancelExam() {
    if (
      window.confirm(
        'Leave this examination? Your saved answers will be discarded.'
      )
    ) {
      finished.current = true;
      clearAttempt(exam.id);
      onExit();
    }
  }

  return (
    <section className="panel">
      <div className="exam-header">
        <div>
          <p className="eyebrow">{exam.subject}</p>
          <h2>{exam.title}</h2>
          <p>
            {total} questions · {exam.duration} minutes allowed
          </p>
        </div>

        <div
          className={`timer ${!submitted && timeLeft <= 30 ? 'timer-warning' : ''}`}
          role="timer"
          aria-live="off"
        >
          <span>Time remaining</span>
          <strong>{formatTime(timeLeft)}</strong>
        </div>
      </div>

      {submitted ? (
        <div className="result" role="status">
          <h2>Examination submitted</h2>
          <p>
            You answered {answeredCount} of {total} questions.
          </p>
          <p>
            {timeLeft === 0
              ? 'Time is up. Your examination has been submitted automatically.'
              : 'Your responses have been submitted.'}
          </p>
          <p>
            {storeStatus === 'saving' && 'Saving your submission...'}
            {storeStatus === 'saved' && 'Your submission has been stored.'}
            {storeStatus === 'failed' &&
              'Your submission could not be stored on the server. Check that you are logged in and the server is running.'}
          </p>
          {storeStatus === 'failed' && (
            <button className="secondary" onClick={() => void storeSubmission()}>
              Retry
            </button>
          )}
          <button className="submit-button" onClick={onExit}>
            Back to examinations
          </button>
        </div>
      ) : reviewing ? (
        <div className="review" aria-label="Review answers">
          <h3>Review your answers</h3>
          <p>
            Answered {answeredCount} of {total} questions
          </p>

          <ul style={{ listStyle: 'none', padding: 0 }}>
            {exam.questions.map((item, index) => {
              const answered = answers[item.id] !== undefined;
              return (
                <li key={item.id} style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => goToFromReview(index)}
                  >
                    Question {index + 1}
                  </button>{' '}
                  {answered ? 'Answered' : 'Not answered'}
                </li>
              );
            })}
          </ul>

          {unansweredCount > 0 && (
            <p role="alert">
              You have {unansweredCount} unanswered question
              {unansweredCount > 1 ? 's' : ''}.
            </p>
          )}

          <div className="submission">
            <button className="submit-button" onClick={submitExam}>
              Confirm and submit
            </button>
            <button className="secondary" onClick={() => setReviewing(false)}>
              Back to questions
            </button>
          </div>
        </div>
      ) : (
        <>
          {initial.resumed && (
            <div className="notice" role="status">
              Your saved progress has been restored.
            </div>
          )}

          <p className="instruction">Choose one answer for each question.</p>

          <div className="palette" role="group" aria-label="Question navigator">
            {exam.questions.map((item, index) => {
              const answered = answers[item.id] !== undefined;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`palette-btn ${answered ? 'palette-answered' : ''} ${index === currentIndex ? 'palette-current' : ''}`}
                  aria-label={`Question ${index + 1}, ${answered ? 'answered' : 'not answered'}`}
                  aria-current={index === currentIndex ? 'step' : undefined}
                  onClick={() => goTo(index)}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          <fieldset className="question" key={question.id}>
            <legend>
              {currentIndex + 1}. {question.text}
            </legend>

            {question.options.map((option) => (
              <label className="option" key={option}>
                <input
                  type="radio"
                  name={`question-${exam.id}-${question.id}`}
                  value={option}
                  checked={answers[question.id] === option}
                  onChange={() => selectAnswer(question.id, option)}
                />
                {option}
              </label>
            ))}
          </fieldset>

          <div className="question-nav">
            <button
              className="secondary"
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
            >
              Previous
            </button>
            <span>
              Question {currentIndex + 1} of {total}
            </span>
            <button
              className="secondary"
              onClick={() => goTo(currentIndex + 1)}
              disabled={currentIndex === total - 1}
            >
              Next
            </button>
          </div>

          <p
            className={`save-status ${saveFailed ? 'save-error' : ''}`}
            role="status"
          >
            {saveFailed
              ? 'Could not save your answers on this device. Keep this page open.'
              : lastSaved
                ? `✓ Answers saved automatically (${lastSaved.toLocaleTimeString()})`
                : 'Answers are saved automatically.'}
          </p>

          <div className="submission">
            <p>
              Answered {answeredCount} of {total} questions
            </p>

            <button className="submit-button" onClick={() => setReviewing(true)}>
              Review and submit
            </button>

            <button className="secondary" onClick={cancelExam}>
              Cancel
            </button>
          </div>
        </>
      )}
    </section>
  );
}