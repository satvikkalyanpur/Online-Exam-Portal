import type { Exam } from '../types';
import { hasSavedAttempt } from '../storage/attemptStorage';

interface ExamListProps {
  exams: Exam[];
  onStart: (exam: Exam) => void;
}

export default function ExamList({ exams, onStart }: ExamListProps) {
  return (
    <section className="panel">
      <h2>Available Examinations</h2>
      <p>Select an examination to view its questions and begin.</p>

      <div className="exam-list">
        {exams.map((exam) => {
          // An exam whose questions were all deleted can't be started.
          const hasQuestions = exam.questions.length > 0;
          // An exam with auto-saved answers can be resumed.
          const inProgress = hasQuestions && hasSavedAttempt(exam.id);

          return (
            <article className="exam-card" key={exam.id}>
              <div>
                <span className={`status ${hasQuestions ? '' : 'status-unavailable'}`}>
                  {!hasQuestions ? 'Unavailable' : inProgress ? 'In progress' : 'Available'}
                </span>
                <h3>{exam.title}</h3>
                <p>{exam.subject}</p>
                <p>
                  {hasQuestions
                    ? `${exam.questions.length} questions · ${exam.duration} minutes`
                    : 'No questions available'}
                </p>
              </div>

              <button
                className="submit-button"
                disabled={!hasQuestions}
                onClick={() => onStart(exam)}
              >
                {inProgress ? 'Resume examination' : 'Start examination'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}