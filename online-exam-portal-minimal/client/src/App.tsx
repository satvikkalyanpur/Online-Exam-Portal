export default function App() {
  return (
    <main className="page">
      <header>
        <p className="eyebrow">ONLINE EXAMINATION SYSTEM</p>
        <h1>Online Exam Portal</h1>
      </header>

      <section className="panel">
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
