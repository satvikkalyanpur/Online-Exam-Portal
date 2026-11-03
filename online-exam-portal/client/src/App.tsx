import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api';
import type { Role, User } from './types';
import Login from './components/Login';
import ExamList from './components/ExamList';
import ExamAttempt from './components/ExamAttempt';
import Results from './components/Results';
import QuestionBank from './components/QuestionBank';
import ExamManager from './components/ExamManager';
import PerformanceReports from './components/PerformanceReports';
import AdminStatistics from './components/AdminStatistics';
import ActivityLog from './components/ActivityLog';
import Backup from './components/Backup';

const ROLE_LABEL: Record<Role, string> = {
  STUDENT: 'Student',
  TEACHER: 'Teacher',
  ADMIN: 'Administrator',
};

// The screens each role can open. The server enforces the same rules (US02).
const TABS = {
  STUDENT: ['Examinations', 'My results'],
  TEACHER: ['Question bank'],
  ADMIN: ['Examinations', 'Reports', 'Statistics', 'Activity log', 'Backup'],
} as const;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(() => getToken() !== null);
  const [sessionMessage, setSessionMessage] = useState('');

  const logout = useCallback((message = '') => {
    setToken(null);
    setUser(null);
    setSessionMessage(message);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler((message) => logout(message));
  }, [logout]);

  // Restore the session after a page refresh.
  useEffect(() => {
    if (!getToken()) return;
    api<{ user: User }>('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => setToken(null))
      .finally(() => setChecking(false));
  }, []);

  function handleLogin(loggedIn: User, token: string) {
    setToken(token);
    setSessionMessage('');
    setUser(loggedIn);
  }

  async function handleLogout() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // Logging out works even if the server can't be reached.
    }
    logout();
  }

  if (checking) {
    return (
      <main className="page">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (!user) return <Login onLogin={handleLogin} message={sessionMessage} />;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              OE
            </span>
            <span className="brand-name">Online Exam Portal</span>
          </div>
          <div className="account">
            <span className="account-name">
              <span className="account-text">{user.name}</span>
              <span className={`role-badge role-${user.role.toLowerCase()}`}>{ROLE_LABEL[user.role]}</span>
            </span>
            <button className="secondary small" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* key: a different user gets a fresh set of screens */}
      <RoleArea key={user.id} role={user.role} />
    </div>
  );
}

function RoleArea({ role }: { role: Role }) {
  const tabs: readonly string[] = TABS[role];
  const [tab, setTab] = useState(tabs[0]);
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [openResultId, setOpenResultId] = useState<string | null>(null);

  function showResult(attemptId: string) {
    setActiveExamId(null);
    setOpenResultId(attemptId);
    setTab('My results');
  }

  // While a student is taking an exam, nothing else is shown.
  if (activeExamId) {
    return (
      <main className="page">
        <ExamAttempt key={activeExamId} examId={activeExamId} onExit={() => setActiveExamId(null)} onViewResult={showResult} />
      </main>
    );
  }

  return (
    <>
      {tabs.length > 1 && (
        <nav className="tabs" aria-label="Sections">
          <div className="tabs-inner">
            {tabs.map((name) => (
              <button
                key={name}
                className={`tab ${tab === name ? 'tab-active' : ''}`}
                aria-current={tab === name ? 'page' : undefined}
                onClick={() => {
                  setTab(name);
                  setOpenResultId(null);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </nav>
      )}

      <main className="page">
        {role === 'STUDENT' && tab === 'Examinations' && (
          <ExamList onStart={setActiveExamId} onViewResult={showResult} />
        )}
        {role === 'STUDENT' && tab === 'My results' && (
          <Results openId={openResultId} onOpen={setOpenResultId} />
        )}
        {role === 'TEACHER' && <QuestionBank />}
        {role === 'ADMIN' && tab === 'Examinations' && <ExamManager />}
        {role === 'ADMIN' && tab === 'Reports' && <PerformanceReports />}
        {role === 'ADMIN' && tab === 'Statistics' && <AdminStatistics />}
        {role === 'ADMIN' && tab === 'Activity log' && <ActivityLog />}
        {role === 'ADMIN' && tab === 'Backup' && <Backup />}
      </main>
    </>
  );
}
