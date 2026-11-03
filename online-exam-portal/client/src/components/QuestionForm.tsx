// US05 (add) and US06 (edit) share this form.
import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import { OPTION_KEYS } from '../types';
import type { BankQuestion, ExamSummary, OptionKey } from '../types';

interface QuestionFormProps {
  /** The question being edited, or null to add a new one. */
  question: BankQuestion | null;
  exams: ExamSummary[];
  onSaved: (question: BankQuestion, message: string) => void;
  onCancel: () => void;
}

type Draft = {
  text: string;
  options: Record<OptionKey, string>;
  correctOption: OptionKey | '';
  marks: string;
  examIds: string[];
};

function toDraft(question: BankQuestion | null): Draft {
  if (!question) {
    return { text: '', options: { A: '', B: '', C: '', D: '' }, correctOption: '', marks: '1', examIds: [] };
  }
  return {
    text: question.text,
    options: { A: question.optionA, B: question.optionB, C: question.optionC, D: question.optionD },
    correctOption: question.correctOption,
    marks: String(question.marks),
    examIds: question.exams.map((e) => e.id),
  };
}

export default function QuestionForm({ question, exams, onSaved, onCancel }: QuestionFormProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(question));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const editing = question !== null;

  function validate(): string | null {
    if (!draft.text.trim()) return 'Enter the question text.';
    for (const key of OPTION_KEYS) {
      if (!draft.options[key].trim()) return `Enter option ${key}.`;
    }
    if (!draft.correctOption) return 'Choose the correct option.';
    const marks = Number(draft.marks);
    if (!Number.isInteger(marks) || marks < 1 || marks > 1000)
      return 'Marks must be a whole number from 1 to 1000.';
    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setSaving(true);

    const body = {
      text: draft.text,
      optionA: draft.options.A,
      optionB: draft.options.B,
      optionC: draft.options.C,
      optionD: draft.options.D,
      correctOption: draft.correctOption,
      marks: Number(draft.marks),
      examIds: draft.examIds,
    };

    try {
      const data = await api<{ question: BankQuestion; message: string }>(
        editing ? `/questions/${question.id}` : '/questions',
        { method: editing ? 'PUT' : 'POST', body }
      );
      onSaved(data.question, data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the question.');
    } finally {
      setSaving(false);
    }
  }

  function toggleExam(examId: string) {
    setDraft((d) => ({
      ...d,
      examIds: d.examIds.includes(examId) ? d.examIds.filter((id) => id !== examId) : [...d.examIds, examId],
    }));
  }

  return (
    <form className="panel form-panel" onSubmit={handleSubmit} noValidate>
      <h2>{editing ? 'Edit question' : 'Add a question'}</h2>

      <label className="field">
        <span>Question</span>
        <textarea
          rows={3}
          value={draft.text}
          onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          autoFocus
        />
      </label>

      <fieldset className="field-group">
        <legend>Options — select the correct answer</legend>
        {OPTION_KEYS.map((key) => (
          <div className="option-row" key={key}>
            <label className="correct-pick" title={`Mark option ${key} as correct`}>
              <input
                type="radio"
                name="correctOption"
                checked={draft.correctOption === key}
                onChange={() => setDraft({ ...draft, correctOption: key })}
              />
              <span className="option-key">{key}</span>
            </label>
            <input
              type="text"
              aria-label={`Option ${key}`}
              placeholder={`Option ${key}`}
              value={draft.options[key]}
              onChange={(e) => setDraft({ ...draft, options: { ...draft.options, [key]: e.target.value } })}
            />
          </div>
        ))}
      </fieldset>

      <label className="field field-narrow">
        <span>Marks</span>
        <input
          type="number"
          min={1}
          max={1000}
          value={draft.marks}
          onChange={(e) => setDraft({ ...draft, marks: e.target.value })}
        />
      </label>

      <fieldset className="field-group">
        <legend>Use in examinations (optional)</legend>
        {exams.length === 0 ? (
          <p className="muted small-text">
            No examinations exist yet. The question stays in the bank for future exams.
          </p>
        ) : (
          <div className="checkbox-list">
            {exams.map((exam) => (
              <label key={exam.id} className="checkbox">
                <input
                  type="checkbox"
                  checked={draft.examIds.includes(exam.id)}
                  onChange={() => toggleExam(exam.id)}
                />
                <span>
                  {exam.title} <span className="muted">({exam.subject})</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="button" className="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Add question'}
        </button>
      </div>
    </form>
  );
}
