import type { Answers, Exam } from '../types';

const API_URL = 'http://localhost:4000';

/** Number of correct answers and the number of questions. */
export function calculateScore(exam: Exam, answers: Answers) {
  const score = exam.questions.filter(
    (question) => answers[question.id] === question.answer
  ).length;
  return { score, totalMarks: exam.questions.length };
}

/** Store the submission on the server. Returns true when it was stored. */
export async function submitAttempt(
  exam: Exam,
  answers: Answers,
  autoSubmitted: boolean
): Promise<boolean> {
  const token = localStorage.getItem('token');
  if (!token) return false;

  try {
    const { score, totalMarks } = calculateScore(exam, answers);
    const response = await fetch(`${API_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        examRef: exam.id,
        examTitle: exam.title,
        answers,
        score,
        totalMarks,
        autoSubmitted,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}