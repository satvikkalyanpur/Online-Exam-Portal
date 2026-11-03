// US21: the activity log, for administrators.
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ActivityEntry } from '../types';
import { formatDateTime } from '../format';

/** LOGIN_FAILED → "Login failed" */
function actionLabel(action: string) {
  const text = action.toLowerCase().replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function ActivityLog() {
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState('');

  // Wait until typing pauses before searching.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (action) params.set('action', action);
    if (query) params.set('search', query);
    api<{ actions: string[]; logs: ActivityEntry[] }>(`/activity?${params}`)
      .then((data) => {
        setActions(data.actions);
        setLogs(data.logs);
        setError('');
      })
      .catch((err: Error) => setError(err.message));
  }, [action, query]);

  return (
    <section>
      <div className="section-head">
        <div>
          <h1>Activity log</h1>
          <p className="muted">Logins, exam starts and submissions, and changes to exams, questions and backups. Newest first.</p>
        </div>
      </div>

      <div className="toolbar">
        <label className="field field-inline">
          <span>Activity</span>
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All activity</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)}
              </option>
            ))}
          </select>
        </label>
        <label className="field field-inline">
          <span>Search</span>
          <input type="search" placeholder="Name, email or details" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>

      {error && <div className="notice notice-error">{error}</div>}
      {!logs && !error && <p className="muted">Loading activity…</p>}
      {logs?.length === 0 && <div className="empty">No activity matches.</div>}

      {logs && logs.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Activity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="nowrap">{formatDateTime(log.createdAt)}</td>
                  <td>
                    {log.user ? (
                      <>
                        {log.user.name}
                        <div className="muted small-text">{log.user.email}</div>
                      </>
                    ) : (
                      <span className="muted">Unknown user</span>
                    )}
                  </td>
                  <td>
                    <span className={`log-action log-${log.action.toLowerCase()}`}>{actionLabel(log.action)}</span>
                  </td>
                  <td>{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {logs && logs.length === 300 && <p className="muted small-text">Showing the latest 300 entries.</p>}
    </section>
  );
}
