// US01: the login screen.
import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type { User } from '../types';

type LoginProps = {
  onLogin: (user: User, token: string) => void;
  /** Shown when the user was logged out automatically (e.g. expired session). */
  message?: string;
};

const DEMO_ACCOUNTS = [
  { label: 'Student', email: 'student@example.com', password: 'Student@123' },
  { label: 'Teacher', email: 'teacher@example.com', password: 'Teacher@123' },
  { label: 'Admin', email: 'admin@example.com', password: 'Admin@123' },
];

export default function Login({ onLogin, message }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const data = await api<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      onLogin(data.user, data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <form className="panel login-card" onSubmit={handleSubmit} noValidate>
        <p className="eyebrow">ONLINE EXAMINATION SYSTEM</p>
        <h1>Log in</h1>
        <p className="muted">Use your registered email and password.</p>

        {message && (
          <div className="notice notice-warning" role="status">
            {message}
          </div>
        )}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="primary full" disabled={loading}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>

        {import.meta.env.DEV && (
          <div className="demo-accounts">
            <p>Test accounts (development only):</p>
            <div className="demo-buttons">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="secondary small"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                    setError('');
                  }}
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </main>
  );
}
