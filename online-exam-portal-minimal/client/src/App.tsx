
import React, { useEffect, useState } from 'react';

const EXAM_DURATION = 5*60;

const questions = [
  {
    id: 1,
    question: 'Which data structure follows FIFO?',
    options: ['Stack', 'Queue', 'Tree', 'Graph'],
    answer: 'Queue',
  },
  {
    id: 2,
    question: 'Which language runs natively in a web browser?',
    options: ['C', 'Java', 'JavaScript', 'SQL'],
    answer: 'JavaScript',
  },
  {
    id: 3,
    question: 'What does HTTP stand for?',
    options: [
      'Hypertext Transfer Protocol',
      'High Transfer Text Program',
      'Hyper Transfer Technology Process',
      'Host Text Transfer Protocol',
    ],
    answer: 'Hypertext Transfer Protocol',
  },
];

export default function App() {
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted) return;

    const timer = window.setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          window.clearInterval(timer);
          setSubmitted(true);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [submitted]);

  function submitExam() {
    setSubmitted(true);
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <main className="page">
      <header>
        <p className="eyebrow">ONLINE EXAMINATION SYSTEM</p>
        <h1>Online Exam Portal</h1>
      </header>

      <section className="panel">
        <div className="exam-header">
          <div>
            <h2>Sample Online Examination</h2>
            <p>Select one answer for each question.</p>
          </div>

          <div
            className={`timer ${timeLeft <= 30 ? 'timer-warning' : ''}`}
            role="timer"
            aria-live="off"
          >
            <span>Time remaining</span>
            <strong>
              {String(minutes).padStart(2, '0')}:
              {String(seconds).padStart(2, '0')}
            </strong>
          </div>
        </div>

        {submitted ? (
          <div className="result" role="status">
            <h2>Examination submitted</h2>
            <p>
              You answered {Object.keys(answers).length} of {questions.length}{' '}
              questions.
            </p>
            <p>
              {timeLeft === 0
                ? 'The time limit was reached.'
                : 'You submitted your examination.'}
            </p>
          </div>
        ) : (
          <>
            {questions.map((question, index) => (
              <fieldset className="question" key={question.id}>
                <legend>
                  {index + 1}. {question.question}
                </legend>

                {question.options.map((option) => (
                  <label className="option" key={option}>
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option}
                      checked={answers[question.id] === option}
                      onChange={() =>
                        setAnswers((previous) => ({
                          ...previous,
                          [question.id]: option,
                        }))
                      }
                    />
                    {option}
                  </label>
                ))}
              </fieldset>
            ))}

            <button className="submit-button" onClick={submitExam}>
              Submit examination
            </button>
          </>
        )}
      </section>
    </main>
  );
}
