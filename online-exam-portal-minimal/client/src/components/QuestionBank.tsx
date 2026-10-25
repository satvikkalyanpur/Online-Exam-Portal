import { useEffect, useRef, useState } from 'react';
import type { BankQuestion } from '../data/questionBank';

interface QuestionBankProps {
  questions: BankQuestion[];
  onDelete: (questionId: number) => void;
}

export default function QuestionBank({ questions, onDelete }: QuestionBankProps) {
  // The question the teacher has selected for deletion (awaiting confirmation).
  const [pending, setPending] = useState<BankQuestion | null>(null);
  const [notice, setNotice] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);

  // While the confirmation dialog is open: focus the safe option (Cancel)
  // and let Escape close the dialog.
  useEffect(() => {
    if (!pending) return;

    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPending(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pending]);

  function requestDelete(question: BankQuestion) {
    setNotice('');
    setPending(question);
  }

  function confirmDelete() {
    if (!pending) return;
    onDelete(pending.id);
    setNotice(`Question deleted: ${pending.text}`);
    setPending(null);
  }

  return (
    <section className="panel">
      <h2>Question Bank</h2>
      <p>
        {questions.length === 0
          ? 'The question bank is empty.'
          : `${questions.length} question${questions.length > 1 ? 's' : ''} in the question bank. Select a question to delete it.`}
      </p>

      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}

      {questions.length === 0 ? (
        <div className="empty">No questions available.</div>
      ) : (
        <ul className="bank-list">
          {questions.map((question, index) => (
            <li className="bank-item" key={question.id}>
              <div className="bank-content">
                <p className="eyebrow">{question.subject}</p>
                <h3>
                  {index + 1}. {question.text}
                </h3>
                <ul className="bank-options">
                  {question.options.map((option) => (
                    <li
                      key={option}
                      className={option === question.answer ? 'bank-correct' : ''}
                    >
                      {option}
                      {option === question.answer && ' (correct answer)'}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                className="danger"
                onClick={() => requestDelete(question)}
                aria-label={`Delete question: ${question.text}`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <div className="overlay" onClick={() => setPending(null)}>
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-dialog-title">Delete this question?</h3>
            <p className="dialog-question">{pending.text}</p>
            <p>This will remove it from the question bank. This cannot be undone.</p>

            <div className="dialog-actions">
              <button
                className="secondary"
                ref={cancelRef}
                onClick={() => setPending(null)}
              >
                Cancel
              </button>
              <button className="danger-solid" onClick={confirmDelete}>
                Delete question
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}