
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
import { useState } from 'react';
import { exams } from './data/exams';
import type { Exam } from './types';
import ExamList from './components/Examlist';
import ExamAttempt from './components/Examattempt';

export default function App() {
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  return (
    <main className="page">
      <header>
        <p className="eyebrow">ONLINE EXAMINATION SYSTEM</p>
        <h1>Online Exam Portal</h1>
        {!selectedExam && (
          <p className="intro">
            View your available examinations and complete them online.
          </p>
        )}
      </header>

      {selectedExam ? (
        // key forces a completely fresh attempt (answers, timer) per exam start
        <ExamAttempt
          key={selectedExam.id}
          exam={selectedExam}
          onExit={() => setSelectedExam(null)}
        />
      ) : (
        <ExamList exams={exams} onStart={setSelectedExam} />
      )}
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
        <h2>Project skeleton</h2>
        <p>
          
import { useEffect, useState, type FormEvent } from 'react';
import './styles.css';

type Exam = {
  id: string;
  title: string;
};

type Question = {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  marks: number;
  examLinks: { exam: Exam }[];
};

const API = 'http://localhost:4000/api';

export default function App() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [text, setText] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctOption, setCorrectOption] = useState('A');
  const [marks, setMarks] = useState('1');
  const [examId, setExamId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadData() {
    try {
      const [examResponse, questionResponse] = await Promise.all([
        fetch(`${API}/exams`),
        fetch(`${API}/questions`),
      ]);

      if (!examResponse.ok || !questionResponse.ok) {
        throw new Error('Could not load the question bank.');
      }

      setExams(await examResponse.json());
      setQuestions(await questionResponse.json());
    } catch {
      setError('Could not load data. Check that the backend and database are available.');
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    setSaving(true);

    try {
      const response = await fetch(`${API}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          optionA,
          optionB,
          optionC,
          optionD,
          correctOption,
          marks: Number(marks),
          ...(examId ? { examId } : {}),
import { useState } from "react";
import "./styles.css";

export default function App() {
  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [totalMarks, setTotalMarks] = useState("100");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (new Date(endAt) <= new Date(startAt)) {
      setError("End time must be after start time.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          durationMinutes: Number(durationMinutes),
          totalMarks: Number(totalMarks),
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Could not save the question.');
      }

      setMessage('Question added successfully.');
      setText('');
      setOptionA('');
      setOptionB('');
      setOptionC('');
      setOptionD('');
      setCorrectOption('A');
      setMarks('1');
      setExamId('');
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save the question.'
        throw new Error(result.error || "Could not create examination.");
      }

      setMessage("Examination created successfully.");
      setTitle("");
      setDurationMinutes("60");
      setTotalMarks("100");
      setStartAt("");
      setEndAt("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create examination."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <header>
        <p className="eyebrow">ONLINE EXAMINATION SYSTEM</p>
        <h1>Question Bank</h1>
        <p>Add and manage questions for use in examinations.</p>
      </header>

      <section className="panel">
        <h2>Add a question</h2>

        <form className="question-form" onSubmit={handleSubmit}>
          <label htmlFor="question-text">Question</label>
          <textarea
            id="question-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={10000}
            required
          />

          <label htmlFor="option-a">Option A</label>
          <input id="option-a" value={optionA} onChange={(e) => setOptionA(e.target.value)} maxLength={1000} required />

          <label htmlFor="option-b">Option B</label>
          <input id="option-b" value={optionB} onChange={(e) => setOptionB(e.target.value)} maxLength={1000} required />

          <label htmlFor="option-c">Option C</label>
          <input id="option-c" value={optionC} onChange={(e) => setOptionC(e.target.value)} maxLength={1000} required />

          <label htmlFor="option-d">Option D</label>
          <input id="option-d" value={optionD} onChange={(e) => setOptionD(e.target.value)} maxLength={1000} required />

          <label htmlFor="correct-option">Correct answer</label>
          <select
            id="correct-option"
            value={correctOption}
            onChange={(e) => setCorrectOption(e.target.value)}
          >
            <option value="A">Option A</option>
            <option value="B">Option B</option>
            <option value="C">Option C</option>
            <option value="D">Option D</option>
          </select>

          <label htmlFor="marks">Marks</label>
    <main className="exam-page">
      <section className="exam-card">
        <h1>Create Examination</h1>
        <p>Enter the examination details below.</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="title">Examination title</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={150}
            required
          />

          <label htmlFor="duration">Duration (minutes)</label>
          <input
            id="duration"
            type="number"
            min="1"
            max="1440"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            required
          />

          <label htmlFor="marks">Total marks</label>
          <input
            id="marks"
            type="number"
            min="1"
            max="1000"
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            required
          />

          <label htmlFor="exam">Associate with examination (optional)</label>
          <select
            id="exam"
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
          >
            <option value="">Keep in question bank for future use</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.title}
              </option>
            ))}
          </select>

          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Add Question'}
            max="100000"
            value={totalMarks}
            onChange={(e) => setTotalMarks(e.target.value)}
            required
          />

          <label htmlFor="startAt">Start date and time</label>
          <input
            id="startAt"
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            required
          />

          <label htmlFor="endAt">End date and time</label>
          <input
            id="endAt"
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            required
          />

          <button type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create Examination"}
          </button>
        </form>

        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </section>

      <section className="panel question-list">
        <h2>Saved questions ({questions.length})</h2>

        {questions.length === 0 ? (
          <p>No questions have been added yet.</p>
        ) : (
          questions.map((question) => (
            <article className="question-item" key={question.id}>
              <h3>{question.text}</h3>
              <p>A. {question.optionA}</p>
              <p>B. {question.optionB}</p>
              <p>C. {question.optionC}</p>
              <p>D. {question.optionD}</p>
              <p>
                Correct answer: {question.correctOption} · {question.marks} mark(s)
              </p>
              <p>
                Exams:{' '}
                {question.examLinks.length
                  ? question.examLinks.map((link) => link.exam.title).join(', ')
                  : 'Available in the question bank'}
              </p>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

        </p>
        <ul>
          <li>Authentication and role-based access</li>
          <li>Exam scheduling and question bank</li>
          <li>Timed attempts, autosave, and review</li>
          <li>Automatic evaluation and results</li>
          <li>Reports and activity logs</li>
        </ul>
      </section>
    </main>
  );
}