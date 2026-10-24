import React, { useEffect, useState } from 'react';

const exams = [
  {
    id: 1,
    title: 'Computer Science Fundamentals',
    subject: 'Computer Science',
    duration: 30,
    questions: [
      {
        id: 1,
        text: 'Which data structure follows FIFO?',
        options: ['Stack', 'Queue', 'Tree', 'Graph'],
        answer: 'Queue',
      },
      {
        id: 2,
        text: 'Which language runs natively in a web browser?',
        options: ['C', 'Java', 'JavaScript', 'SQL'],
        answer: 'JavaScript',
      },
      {
        id: 3,
        text: 'What does HTTP stand for?',
        options: [
          'Hypertext Transfer Protocol',
          'High Transfer Text Program',
          'Hyper Transfer Technology Process',
          'Host Text Transfer Protocol',
        ],
        answer: 'Hypertext Transfer Protocol',
      },
    ],
  },
  {
    id: 2,
    title: 'Data Structures and Algorithms',
    subject: 'Computer Science',
    duration: 20,
    questions: [
      {
        id: 1,
        text: 'Which data structure uses LIFO?',
        options: ['Queue', 'Stack', 'Array', 'Graph'],
        answer: 'Stack',
      },
      {
        id: 2,
        text: 'What is the average time complexity of binary search?',
        options: ['O(n)', 'O(n²)', 'O(log n)', 'O(1)'],
        answer: 'O(log n)',
      },
    ],
  },
];

export default function App() {
  const [selectedExam, setSelectedExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  function startExam(exam) {
    setSelectedExam(exam);
    setAnswers({});
    setSubmitted(false);
    setTimeLeft(exam.duration * 60);
  }

  function submitExam() {
    setSubmitted(true);
  }

  function backToExams() {
    setSelectedExam(null);
    setAnswers({});
    setSubmitted(false);
    setTimeLeft(0);
  }

  // Countdown timer: decrease by one second while an exam is active.
  useEffect(() => {
    if (!selectedExam || submitted || timeLeft <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedExam, submitted, timeLeft > 0]);

  // Automatically submit when the timer reaches zero.
  useEffect(() => {
    if (selectedExam && !submitted && timeLeft === 0) {
      setSubmitted(true);
    }
  }, [selectedExam, submitted, timeLeft]);

  const answeredCount = Object.keys(answers).filter((key) =>
    key.startsWith(`${selectedExam?.id}-`)
  ).length;

  return (
    <main className="page">
      <header>
        <p className="eyebrow">ONLINE EXAMINATION SYSTEM</p>
        <h1>Online Exam Portal</h1>
        <p className="intro">
          View your available examinations and complete them online.
        </p>
      </header>

      {!selectedExam ? (
        <section className="panel">
          <h2>Available Examinations</h2>
          <p>Select an examination to view its questions and begin.</p>

          <div className="exam-list">
            {exams.map((exam) => (
              <article className="exam-card" key={exam.id}>
                <div>
                  <span className="status">Available</span>
                  <h3>{exam.title}</h3>
                  <p>{exam.subject}</p>
                  <p>
                    {exam.questions.length} questions · {exam.duration} minutes
                  </p>
                </div>

                <button onClick={() => startExam(exam)}>
                  Start examination
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="panel">
          <div className="exam-heading">
            <div>
              <p className="eyebrow">{selectedExam.subject}</p>
              <h2>{selectedExam.title}</h2>
              <p>
                {selectedExam.questions.length} questions ·{' '}
                {selectedExam.duration} minutes allowed
              </p>
            </div>

            <div className="timer">
              <span>Time remaining</span>
              <strong>
                {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:
                {String(timeLeft % 60).padStart(2, '0')}
              </strong>
            </div>
          </div>

          {submitted ? (
            <div className="result" role="status">
              <h2>Examination submitted</h2>
              <p>
                You answered {answeredCount} of{' '}
                {selectedExam.questions.length} questions.
              </p>
              <p>
                {timeLeft === 0
                  ? 'Time is up. Your examination has been submitted.'
                  : 'Your responses have been submitted in this session.'}
              </p>
              <button onClick={backToExams}>Back to examinations</button>
            </div>
          ) : (
            <>
              <p className="instruction">
                Choose one answer for each question.
              </p>

              {selectedExam.questions.map((question, index) => {
                const answerKey = `${selectedExam.id}-${question.id}`;

                return (
                  <fieldset className="question" key={question.id}>
                    <legend>
                      {index + 1}. {question.text}
                    </legend>

                    {question.options.map((option) => (
                      <label className="option" key={option}>
                        <input
                          type="radio"
                          name={`question-${answerKey}`}
                          value={option}
                          checked={answers[answerKey] === option}
                          onChange={() =>
                            setAnswers((previous) => ({
                              ...previous,
                              [answerKey]: option,
                            }))
                          }
                        />
                        {option}
                      </label>
                    ))}
                  </fieldset>
                );
              })}

              <div className="submission">
                <p>
                  Answered {answeredCount} of{' '}
                  {selectedExam.questions.length} questions
                </p>

                <button onClick={submitExam}>
                  Submit examination
                </button>

                <button className="secondary" onClick={backToExams}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}