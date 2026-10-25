import { useMemo, useState } from 'react';
import { examDefinitions } from './data/exams';
import { initialQuestionBank } from './data/questionBank';
import type { BankQuestion } from './data/questionBank';
import type { Exam } from './types';
import ExamList from './components/ExamList';
import ExamAttempt from './components/ExamAttempt';
import QuestionBank from './components/QuestionBank';

type View = 'student' | 'teacher';

export default function App() {
  const [view, setView] = useState<View>('student');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  // Question bank lives here so it is kept when switching between views.
  const [bank, setBank] = useState<BankQuestion[]>(initialQuestionBank);

  function deleteQuestion(questionId: number) {
    setBank((previous) => previous.filter((q) => q.id !== questionId));
  }

  // Exams are built from the question bank, so a question deleted by the
  // teacher no longer appears in any exam.
  const exams: Exam[] = useMemo(
    () =>
      examDefinitions.map(({ questionIds, ...exam }) => ({
        ...exam,
        questions: bank.filter((q) => questionIds.includes(q.id)),
      })),
    [bank]
  );

  const attemptingExam = view === 'student' && selectedExam !== null;

  return (
    <main className="page">
      <header>
        <p className="eyebrow">ONLINE EXAMINATION SYSTEM</p>
        <h1>Online Exam Portal</h1>
        {view === 'student' && !selectedExam && (
          <p className="intro">
            View your available examinations and complete them online.
          </p>
        )}
      </header>

      {/* Hidden during an exam so a student can't lose their attempt by switching. */}
      {!attemptingExam && (
        <nav className="tabs" aria-label="Portal view">
          <button
            className={`tab ${view === 'student' ? 'tab-active' : ''}`}
            aria-pressed={view === 'student'}
            onClick={() => setView('student')}
          >
            Student
          </button>
          <button
            className={`tab ${view === 'teacher' ? 'tab-active' : ''}`}
            aria-pressed={view === 'teacher'}
            onClick={() => setView('teacher')}
          >
            Teacher: Question Bank
          </button>
        </nav>
      )}

      {view === 'teacher' ? (
        <QuestionBank questions={bank} onDelete={deleteQuestion} />
      ) : selectedExam ? (
        // key forces a completely fresh attempt (answers, timer) per exam start
        <ExamAttempt
          key={selectedExam.id}
          exam={selectedExam}
          onExit={() => setSelectedExam(null)}
        />
      ) : (
        <ExamList exams={exams} onStart={setSelectedExam} />
      )}
    </main>
  );
}