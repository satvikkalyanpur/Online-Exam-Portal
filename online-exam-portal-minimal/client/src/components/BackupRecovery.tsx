
































import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
 
const API = '/api';
 
export default function BackupRecovery() {
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<{ name: string; rows: number }[]>([]);
 
  async function loadStatus(t: string) {
    try {
      const res = await fetch(`${API}/admin/data/status`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) setStatus((await res.json()).models ?? []);
    } catch {
      /* status is informational only */
    }
  }
  useEffect(() => {
    if (token) void loadStatus(token);
  }, [token]);
 
  async function login(e: { preventDefault(): void }) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identity, username: identity, password }),
      });
      const data = await res.json().catch(() => ({}));
      const t = data.token ?? data.accessToken;
      if (!res.ok || !t) throw new Error(data.error ?? data.message ?? 'Login failed.');
      setToken(t);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  }
 
  async function download() {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const res = await fetch(`${API}/admin/data/backup`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) throw new Error('Administrator access is required.');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Backup failed.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exam-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice('Backup downloaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup failed.');
    } finally {
      setBusy(false);
    }
  }
 
  async function restore() {
    if (!file) return;
    setConfirming(false);
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const body = JSON.parse(await file.text());
      const res = await fetch(`${API}/admin/data/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Restore failed.');
      const summary = Object.entries((data.counts ?? {}) as Record<string, { restored: number }>)
        .map(([k, v]) => `${k}: ${v.restored}`)
        .join(', ');
      if (token) void loadStatus(token);
      setNotice(`Restore completed. ${summary}`);
      setFile(null);
    } catch (err) {
      setError(err instanceof SyntaxError ? 'The selected file is not valid JSON.' : err instanceof Error ? err.message : 'Restore failed.');
    } finally {
      setBusy(false);
    }
  }
 
  return (
    <section className="panel backup-panel">
      <div className="backup-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h2>Backup &amp; Recovery</h2>
          <p className="intro">Download a copy of examination and result data, or restore it from a previous backup.</p>
        </div>
        <span className="backup-lock" aria-hidden="true">🔒</span>
      </div>
 
      <div className="backup-scope">
        <h3>What is included</h3>
        <p>Exams, questions, results and related records. User accounts and passwords are never exported or changed.</p>
        {status.length > 0 && (
          <p className="intro">{status.map((m) => `${m.name}: ${m.rows}`).join(' · ')}</p>
        )}
      </div>
 
      {!token ? (
        <form className="backup-login" onSubmit={login}>
          <h3>Administrator sign-in</h3>
          <p className="intro">Only administrators can back up or restore data.</p>
          <input placeholder="Email or username" value={identity} onChange={(e) => setIdentity(e.target.value)} required autoComplete="username" />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          <button className="submit-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      ) : (
        <>
          <div className="backup-session">
            <p className="intro">Signed in as administrator.</p>
            <button className="secondary" onClick={() => { setToken(null); setNotice(''); setError(''); setFile(null); }}>Sign out</button>
          </div>
          <div className="backup-actions">
            <div className="backup-action-card">
              <span className="backup-icon" aria-hidden="true">↓</span>
              <h3>Back up data</h3>
              <p>Saves a JSON file you can keep somewhere safe.</p>
              <button className="submit-button" onClick={download} disabled={busy}>Download backup</button>
            </div>
            <div className="backup-action-card">
              <span className="backup-icon" aria-hidden="true">↑</span>
              <h3>Restore data</h3>
              <p>Replaces current exam and result data with the backup. If anything fails, nothing is changed.</p>
              <label className="file-label" htmlFor="backup-file">Backup file</label>
              <input id="backup-file" type="file" accept="application/json,.json" onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)} />
              {file && <span className="selected-file intro">{file.name}</span>}
              <button className="danger-solid" onClick={() => setConfirming(true)} disabled={!file || busy}>Restore from file</button>
            </div>
          </div>
        </>
      )}
 
      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <p className="backup-error" role="alert">{error}</p>}
 
      {confirming && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="restore-title">
          <div className="dialog">
            <h3 id="restore-title">Restore this backup?</h3>
            <p>Current exam and result data will be replaced with the contents of:</p>
            <p className="dialog-question">{file?.name}</p>
            <div className="dialog-actions">
              <button className="secondary" onClick={() => setConfirming(false)}>Cancel</button>
              <button className="danger-solid" onClick={restore}>Replace data</button>
            </div>
          </div>
        </div>
      )}
      <p className="backup-safety-note">Keep backup files private. They contain student results.</p>
    </section>
  );
}
 

