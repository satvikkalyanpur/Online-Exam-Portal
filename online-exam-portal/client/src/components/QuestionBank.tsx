// US05 add, US06 edit and US07 delete: the teacher's question bank.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { OPTION_KEYS } from '../types';
import type { BankQuestion, ExamSummary } from '../types';
import { plural } from '../format';
import QuestionForm from './QuestionForm';
import ConfirmDialog from './ConfirmDialog';

const NO_EXAM = '__none__';

export default function QuestionBank() {
  const [questions, setQuestions] = useState<BankQuestion[] | null>(null);
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('');

  // null = no form open; 'new' = add form; a question = edit form
  const [editing, setEditing] = useState<BankQuestion | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<BankQuestion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    Promise.all([api<BankQuestion[]>('/questions'), api<ExamSummary[]>('/exams')])
      .then(([q, e]) => {
        setQuestions(q);
        setExams(e);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const visible = useMemo(() => {
    if (!questions) return [];
    if (!filter) return questions;
    if (filter === NO_EXAM) return questions.filter((q) => q.exams.length === 0);
    return questions.filter((q) => q.exams.some((e) => e.id === filter));
  }, [questions, filter]);

  function handleSaved(saved: BankQuestion, message: string) {
    setQuestions((list) => {
      if (!list) return [saved];
      const exists = list.some((q) => q.id === saved.id);
      return exists ? list.map((q) => (q.id === saved.id ? saved : q)) : [saved, ...list];
    });
    setNotice(message);
    setEditing(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api(`/questions/${toDelete.id}`, { method: 'DELETE' });
      setQuestions((list) => list?.filter((q) => q.id !== toDelete.id) ?? null);
      setNotice('Question deleted from the question bank.');
      setToDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the question.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h1>Question Bank</h1>
          <p className="muted">
            {questions ? `${plural(questions.length, 'question')} in the bank.` : 'Loading…'}
          </p>
        </div>
        {editing === null && (
          <button
            className="primary"
            onClick={() => {
              setNotice('');
              setEditing('new');
            }}
          >
            + Add question
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
        <QuestionForm
          key={editing === 'new' ? 'new' : editing.id}
          question={editing === 'new' ? null : editing}
          exams={exams}
          onSaved={handleSaved}
          onCancel={() => setEditing(null)}
        />
      )}

      {questions && questions.length > 0 && (
        <div className="toolbar">
          <label className="field field-inline">
            <span>Show</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All questions</option>
              <option value={NO_EXAM}>Not used in any exam</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {questions && questions.length === 0 && (
        <div className="empty">The question bank is empty. Add your first question.</div>
      )}
      {questions && questions.length > 0 && visible.length === 0 && (
        <div className="empty">No questions match this filter.</div>
      )}

      <ul className="bank-list">
        {visible.map((question) => (
          <li className="panel bank-item" key={question.id}>
            <div className="bank-content">
              <p className="question-text">{question.text}</p>
              <ul className="bank-options">
                {OPTION_KEYS.map((key) => {
                  const correct = question.correctOption === key;
                  return (
                    <li key={key} className={correct ? 'bank-correct' : ''}>
                      <span className="option-key">{key}</span>
                      {question[`option${key}`]}
                      {correct && <span className="correct-tag">Correct</span>}
                    </li>
                  );
                })}
              </ul>
              <div className="bank-meta">
                <span>{plural(question.marks, 'mark')}</span>
                {question.exams.length === 0 ? (
                  <span className="chip chip-muted">Not used in an exam yet</span>
                ) : (
                  question.exams.map((exam) => (
                    <span className="chip" key={exam.id}>
                      {exam.title}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="bank-actions">
              <button
                className="secondary small"
                onClick={() => {
                  setNotice('');
                  setEditing(question);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                aria-label={`Edit question: ${question.text}`}
              >
                Edit
              </button>
              <button
                className="danger small"
                onClick={() => {
                  setDeleteError('');
                  setToDelete(question);
                }}
                aria-label={`Delete question: ${question.text}`}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {toDelete && (
        <ConfirmDialog
          title="Delete this question?"
          confirmLabel="Delete question"
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        >
          <p className="dialog-question">{toDelete.text}</p>
          <p>
            This removes it from the question bank
            {toDelete.exams.length > 0 && ` and from ${plural(toDelete.exams.length, 'examination')}`}. This
            cannot be undone.
          </p>
          {deleteError && <p className="form-error">{deleteError}</p>}
        </ConfirmDialog>
      )}
    </section>
  );
}
