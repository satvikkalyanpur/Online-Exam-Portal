import type { Exam } from '../types';

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
        {exams.map((exam) => (
          <article className="exam-card" key={exam.id}>
            <div>
              <span className="status">Available</span>
              <h3>{exam.title}</h3>
              <p>{exam.subject}</p>
              <p>
                {exam.questions.length} questions · {exam.duration} minutes
              </p>
            </div>

            <button className="submit-button" onClick={() => onStart(exam)}>
              Start examination
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}