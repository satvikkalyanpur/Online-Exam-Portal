import { useEffect, useRef, useState } from 'react';
import type { Answers, Exam } from '../types';

interface ExamAttemptProps {
  exam: Exam;
  onExit: () => void;
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function ExamAttempt({ exam, onExit }: ExamAttemptProps) {
  const totalSeconds = exam.duration * 60;

  const [answers, setAnswers] = useState<Answers>({});
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(totalSeconds);

  // Fixed deadline: the countdown stays accurate even if the browser
  // throttles timers in a background tab.
  const deadline = useRef(Date.now() + totalSeconds * 1000);

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
        setSubmitted(true);
      }
    };

    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [submitted]);

  const answeredCount = Object.keys(answers).length;
  const total = exam.questions.length;

  function selectAnswer(questionId: number, option: string) {
    setAnswers((previous) => ({ ...previous, [questionId]: option }));
  }

  function submitExam() {
    const unanswered = total - answeredCount;
    if (
      unanswered > 0 &&
      !window.confirm(
        `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Submit anyway?`
      )
    ) {
      return;
    }
    // Freeze the displayed time at the moment of submission.
    setTimeLeft(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    setSubmitted(true);
  }

  function cancelExam() {
    if (window.confirm('Leave this examination? Your answers will be lost.')) {
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
              ? 'Time is up. Your examination has been submitted.'
              : 'Your responses have been submitted in this session.'}
          </p>
          <button className="submit-button" onClick={onExit}>
            Back to examinations
          </button>
        </div>
      ) : (
        <>
          <p className="instruction">Choose one answer for each question.</p>

          {exam.questions.map((question, index) => (
            <fieldset className="question" key={question.id}>
              <legend>
                {index + 1}. {question.text}
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
          ))}

          <div className="submission">
            <p>
              Answered {answeredCount} of {total} questions
            </p>

            <button className="submit-button" onClick={submitExam}>
              Submit examination
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