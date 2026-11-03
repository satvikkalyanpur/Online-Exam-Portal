// US20: backup and recovery, for administrators.
import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { api } from '../api';
import { formatDateTime } from '../format';
import ConfirmDialog from './ConfirmDialog';

type BackupFile = {
  format: string;
  version: number;
  createdAt: string;
  counts: Record<string, number>;
  data: unknown;
};

export default function Backup() {
  const [downloading, setDownloading] = useState(false);
  const [file, setFile] = useState<{ name: string; backup: BackupFile } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function download() {
    setDownloading(true);
    setError('');
    setNotice('');
    try {
      const backup = await api<BackupFile>('/backup');
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `exam-portal-backup-${backup.createdAt.slice(0, 16).replace(/[-:T]/g, '')}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice(
        `Backup downloaded: ${backup.counts.exams} exams, ${backup.counts.questions} questions and ` +
          `${backup.counts.attempts} attempts. Keep the file somewhere safe and private.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the backup.');
    } finally {
      setDownloading(false);
    }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setError('');
    setNotice('');
    setFile(null);
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) return;
    try {
      const backup = JSON.parse(await chosen.text()) as BackupFile;
      const valid =
        backup?.format === 'online-exam-portal-backup' &&
        backup.counts &&
        typeof backup.createdAt === 'string' &&
        !Number.isNaN(new Date(backup.createdAt).getTime());
      if (!valid) throw new Error('not a backup');
      setFile({ name: chosen.name, backup });
    } catch {
      setError(`"${chosen.name}" is not an Online Exam Portal backup file.`);
    }
  }

  async function restore() {
    if (!file) return;
    setRestoring(true);
    setError('');
    try {
      const result = await api<{ counts: Record<string, number> }>('/backup/restore', {
        method: 'POST',
        body: file.backup,
      });
      setNotice(
        `Backup restored: ${result.counts.exams} exams, ${result.counts.questions} questions and ` +
          `${result.counts.attempts} attempts with their answers and results.`
      );
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The backup could not be restored.');
    } finally {
      setRestoring(false);
      setConfirming(false);
    }
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h1>Backup and recovery</h1>
          <p className="muted">Save a copy of all examination and result data, or restore it from a saved copy.</p>
        </div>
      </div>

      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      <div className="backup-grid">
        <div className="panel">
          <h2>1. Create a backup</h2>
          <p>
            Downloads one file containing every examination, question, student attempt, answer and result, plus the
            user accounts they belong to (passwords stay encrypted).
          </p>
          <button className="primary" onClick={download} disabled={downloading}>
            {downloading ? 'Preparing…' : 'Download backup'}
          </button>
        </div>

        <div className="panel">
          <h2>2. Restore from a backup</h2>
          <p>
            Replaces the current examinations, questions, attempts and results with the ones in the file. The file
            is checked completely first; if anything is wrong, nothing is changed.
          </p>
          <label className="file-pick secondary">
            Choose backup file…
            <input type="file" accept=".json,application/json" onChange={chooseFile} />
          </label>

          {file && (
            <div className="backup-preview">
              <p>
                <strong>{file.name}</strong>
                <br />
                Created {formatDateTime(file.backup.createdAt)}: {file.backup.counts.exams} exams,{' '}
                {file.backup.counts.questions} questions, {file.backup.counts.attempts} attempts.
              </p>
              <button className="danger-solid" onClick={() => setConfirming(true)}>
                Restore this backup
              </button>
            </div>
          )}
        </div>
      </div>

      {confirming && file && (
        <ConfirmDialog
          title="Restore this backup?"
          confirmLabel="Restore"
          danger
          busy={restoring}
          onConfirm={restore}
          onCancel={() => setConfirming(false)}
        >
          <p>
            All current examinations, questions, attempts and results will be replaced by the ones saved on{' '}
            {formatDateTime(file.backup.createdAt)}. Anything added since then will be lost.
          </p>
          <p>Tip: download a backup of the current data first.</p>
        </ConfirmDialog>
      )}
    </section>
  );
}
