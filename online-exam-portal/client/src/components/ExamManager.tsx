// US04: administrators create, edit, schedule and publish examinations.
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type { Exam, ExamSummary } from '../types';
import { formatDuration, formatSchedule, plural, toDateTimeLocal } from '../format';

type Draft = {
  title: string;
  subject: string;
  description: string;
  durationMinutes: string;
  totalMarks: string;
  startAt: string;
  endAt: string;
  publish: boolean;
};

function emptyDraft(): Draft {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start);
  end.setHours(12);
  return {
    title: '',
    subject: '',
    description: '',
    durationMinutes: '60',
    totalMarks: '100',
    startAt: toDateTimeLocal(start),
    endAt: toDateTimeLocal(end),
    publish: true,
  };
}

function draftFrom(exam: Exam): Draft {
  return {
    title: exam.title,
    subject: exam.subject,
    description: exam.description ?? '',
    durationMinutes: String(exam.durationMinutes),
    totalMarks: String(exam.totalMarks),
    startAt: toDateTimeLocal(new Date(exam.startAt)),
    endAt: toDateTimeLocal(new Date(exam.endAt)),
    publish: exam.status === 'PUBLISHED',
  };
}

function validate(draft: Draft): string | null {
  if (!draft.title.trim()) return 'Enter the examination title.';
  if (!draft.subject.trim()) return 'Enter the subject.';
  const duration = Number(draft.durationMinutes);
  if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
    return 'Duration must be a whole number of minutes from 1 to 1440.';
  }
  const marks = Number(draft.totalMarks);
  if (!Number.isInteger(marks) || marks < 1) return 'Total marks must be a positive whole number.';
  if (!draft.startAt || !draft.endAt) return 'Enter the schedule start and end.';
  const start = new Date(draft.startAt).getTime();
  const end = new Date(draft.endAt).getTime();
  if (end <= start) return 'The schedule must end after it starts.';
  if (end - start < duration * 60_000) return 'The schedule must be at least as long as the duration.';
  return null;
}

export default function ExamManager() {
  const [exams, setExams] = useState<ExamSummary[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // null = no form; 'new' = create; an exam = edit that exam
  const [editing, setEditing] = useState<ExamSummary | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api<ExamSummary[]>('/exams')
      .then(setExams)
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  function openForm(exam: ExamSummary | 'new') {
    setNotice('');
    setFormError('');
    setDraft(exam === 'new' ? emptyDraft() : draftFrom(exam));
    setEditing(exam);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = validate(draft);
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError('');
    setSaving(true);

    const body = {
      title: draft.title,
      subject: draft.subject,
      description: draft.description,
      durationMinutes: Number(draft.durationMinutes),
      totalMarks: Number(draft.totalMarks),
      // datetime-local is the admin's local time; send it as an exact moment.
      startAt: new Date(draft.startAt).toISOString(),
      endAt: new Date(draft.endAt).toISOString(),
      publish: draft.publish,
    };

    try {
      if (editing === 'new') {
        const data = await api<{ exam: Exam; message: string }>('/exams', { method: 'POST', body });
        setNotice(
          `${data.message} "${data.exam.title}" is ${data.exam.status === 'PUBLISHED' ? 'published' : 'saved as a draft'}. ` +
            'Teachers can now add questions to it.'
        );
      } else if (editing) {
        await api(`/exams/${editing.id}`, { method: 'PUT', body });
        if ((editing.status === 'PUBLISHED') !== draft.publish) {
          await api(`/exams/${editing.id}/status`, {
            method: 'PATCH',
            body: { status: draft.publish ? 'PUBLISHED' : 'DRAFT' },
          });
        }
        setNotice(`"${draft.title.trim()}" was updated.`);
      }
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the examination.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(exam: ExamSummary) {
    setBusyId(exam.id);
    setError('');
    try {
      const data = await api<{ message: string }>(`/exams/${exam.id}/status`, {
        method: 'PATCH',
        body: { status: exam.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' },
      });
      setNotice(`${data.message} (${exam.title})`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the status.');
    } finally {
      setBusyId(null);
    }
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <section>
      <div className="section-head">
        <div>
          <h1>Examinations</h1>
          <p className="muted">Create and schedule examinations. Teachers add the questions.</p>
        </div>
        {editing === null && (
          <button className="primary" onClick={() => openForm('new')}>
            + Create examination
          </button>
        )}
      </div>

      {error && <div className="notice notice-error">{error}</div>}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}

      {editing !== null && (
        <form className="panel form-panel" onSubmit={handleSubmit} noValidate>
          <h2>{editing === 'new' ? 'Create examination' : `Edit "${editing.title}"`}</h2>
          <div className="form-grid">
            <label className="field span-2">
              <span>Title</span>
              <input value={draft.title} onChange={(e) => set('title', e.target.value)} maxLength={150} autoFocus />
            </label>
            <label className="field span-2">
              <span>Subject</span>
              <input value={draft.subject} onChange={(e) => set('subject', e.target.value)} maxLength={100} />
            </label>
            <label className="field span-2">
              <span>
                Description <span className="muted">(optional)</span>
              </span>
              <textarea rows={2} value={draft.description} onChange={(e) => set('description', e.target.value)} />
            </label>
            <label className="field">
              <span>Duration (minutes)</span>
              <input
                type="number"
                min={1}
                max={1440}
                value={draft.durationMinutes}
                onChange={(e) => set('durationMinutes', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Total marks</span>
              <input type="number" min={1} value={draft.totalMarks} onChange={(e) => set('totalMarks', e.target.value)} />
            </label>
            <label className="field">
              <span>Opens</span>
              <input type="datetime-local" value={draft.startAt} onChange={(e) => set('startAt', e.target.value)} />
            </label>
            <label className="field">
              <span>Closes</span>
              <input type="datetime-local" value={draft.endAt} onChange={(e) => set('endAt', e.target.value)} />
            </label>
            <p className="muted small-text span-2 form-hint">
              Students can start any time between opening and closing. Each attempt lasts for the duration, but
              never runs past the closing time.
            </p>
            <label className="checkbox span-2">
              <input type="checkbox" checked={draft.publish} onChange={(e) => set('publish', e.target.checked)} />
              <span>Published (students can see it; otherwise it is a draft)</span>
            </label>
          </div>

          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}

          <div className="form-actions">
            <button type="button" className="secondary" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={saving}>
              {saving ? 'Saving…' : editing === 'new' ? 'Create examination' : 'Save changes'}
            </button>
          </div>
        </form>
      )}

      {!exams && !error && <p className="muted">Loading examinations…</p>}
      {exams?.length === 0 && <div className="empty">No examinations yet. Create the first one.</div>}

      <div className="exam-list">
        {exams?.map((exam) => (
          <article className="panel exam-card" key={exam.id}>
            <div className="exam-card-main">
              <div className="exam-card-top">
                <span className="subject">{exam.subject}</span>
                <span className={`status ${exam.status === 'PUBLISHED' ? '' : 'status-muted'}`}>
                  {exam.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                </span>
              </div>
              <h2>{exam.title}</h2>
              <dl className="facts">
                <div>
                  <dt>Duration</dt>
                  <dd>{formatDuration(exam.durationMinutes)}</dd>
                </div>
                <div>
                  <dt>Total marks</dt>
                  <dd>{exam.totalMarks}</dd>
                </div>
                <div>
                  <dt>Questions</dt>
                  <dd>{exam.questionCount}</dd>
                </div>
                <div>
                  <dt>Submitted</dt>
                  <dd>{exam.submittedCount}</dd>
                </div>
              </dl>
              <p className="schedule">
                <strong>Schedule:</strong> {formatSchedule(exam.startAt, exam.endAt)}
              </p>
              {exam.questionCount === 0 ? (
                <p className="hint-warning">No questions yet. A teacher needs to add questions before students can start it.</p>
              ) : (
                exam.questionMarks !== exam.totalMarks && (
                  <p className="hint-warning">
                    The {plural(exam.questionCount, 'question')} add up to {exam.questionMarks} marks, not{' '}
                    {exam.totalMarks}. Scores are out of {exam.questionMarks}.
                  </p>
                )
              )}
            </div>
            <div className="exam-card-action">
              <button className="secondary" onClick={() => openForm(exam)}>
                Edit
              </button>
              <button className="secondary" onClick={() => toggleStatus(exam)} disabled={busyId === exam.id}>
                {exam.status === 'PUBLISHED' ? 'Move to draft' : 'Publish'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
