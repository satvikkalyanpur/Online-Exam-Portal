import { useState } from 'react';
import { exams } from './data/exams';
import type { Exam } from './types';
import ExamList from './components/Examlist';
import ExamAttempt from './components/Examattempt';

export default function App() {
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  return (
    <main className="page">
      <header>
        <p className="eyebrow">ONLINE EXAMINATION SYSTEM</p>
        <h1>Online Exam Portal</h1>
        {!selectedExam && (
          <p className="intro">
            View your available examinations and complete them online.
          </p>
        )}
      </header>

      {selectedExam ? (
        // key forces a completely fresh attempt (answers, timer) per exam start
        <ExamAttempt
          key={selectedExam.id}
          exam={selectedExam}
          onExit={() => setSelectedExam(null)}
        />
      ) : (
        <ExamList exams={exams} onStart={setSelectedExam} />
      )}
    </main>
  );
}