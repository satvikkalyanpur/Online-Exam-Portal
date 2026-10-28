import { useMemo, useState } from 'react';
import { examDefinitions } from './data/exams';
import { initialQuestionBank } from './data/questionBank';
import type { BankQuestion } from './data/questionBank';
import type { Exam } from './types';
import ExamList from './components/ExamList';
import ExamAttempt from './components/ExamAttempt';
import QuestionBank from './components/QuestionBank';
import Login from './components/Login';
import type { LoggedInUser } from './components/Login';

type View = 'student' | 'teacher' | 'admin';

// Which screens each role may open.
const allowedViews: Record<string, View[]> = {
  STUDENT: ['student'],
  TEACHER: ['teacher'],
  ADMIN: ['teacher', 'admin'],
};

const viewLabels: Record<View, string> = {
  student: 'Student',
  teacher: 'Teacher: Question Bank',
  admin: 'Admin',
};

export default function App() {
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [view, setView] = useState<View>('student');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  // Question bank lives here so it is kept when switching between views.
  const [bank, setBank] = useState<BankQuestion[]>(initialQuestionBank);

  function deleteQuestion(questionId: number) {
    setBank((previous) => previous.filter((q) => q.id !== questionId));
  }

  function handleLogin(loggedIn: LoggedInUser) {
    setUser(loggedIn);
    setView((allowedViews[loggedIn.role] ?? ['student'])[0]);
  }

  function handleLogout() {
    localStorage.removeItem('token');
    setSelectedExam(null);
    setUser(null);
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

  // Show the login screen until the user has logged in.
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Only the screens allowed for this role can ever be shown.
  const permitted = allowedViews[user.role] ?? ['student'];
  const currentView: View = permitted.includes(view) ? view : permitted[0];
  const attemptingExam = currentView === 'student' && selectedExam !== null;

  return (
    <main className="page">
      <header>
        <p className="eyebrow">ONLINE EXAMINATION SYSTEM</p>
        <h1>Online Exam Portal</h1>
        <p className="intro">
          Signed in as {user.name} ({user.role})
        </p>
        {currentView === 'student' && !selectedExam && (
          <p className="intro">
            View your available examinations and complete them online.
          </p>
        )}
      </header>

      {/* Hidden during an exam so a student can't lose their attempt by switching. */}
      {!attemptingExam && (
        <nav className="tabs" aria-label="Portal view">
          {permitted.map((v) => (
            <button
              key={v}
              className={`tab ${currentView === v ? 'tab-active' : ''}`}
              aria-pressed={currentView === v}
              onClick={() => setView(v)}
            >
              {viewLabels[v]}
            </button>
          ))}
          <button className="tab" onClick={handleLogout}>
            Log out
          </button>
        </nav>
      )}

      {currentView === 'teacher' ? (
        <QuestionBank questions={bank} onDelete={deleteQuestion} />
      ) : currentView === 'admin' ? (
        <section>
          <h2>Administrator panel</h2>
          <p>
            Administrator-only area. User management will be added in a later story.
          </p>
        </section>
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