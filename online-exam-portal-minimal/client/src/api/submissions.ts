import type { Answers, Exam } from '../types';

const API_URL = 'http://localhost:4000';
const PENDING_PREFIX = 'exam-portal:pending-submission:v1:';

interface SubmissionPayload {
  attemptId: string;
  examRef: number;
  examTitle: string;
  answers: Answers;
  score: number;
  totalMarks: number;
  autoSubmitted: boolean;
}

/** Number of correct answers and the number of questions. */
export function calculateScore(exam: Exam, answers: Answers) {
  const score = exam.questions.filter(
    (question) => answers[question.id] === question.answer
  ).length;
  return { score, totalMarks: exam.questions.length };
}

/** A new random id that identifies one exam attempt. */
export function newAttemptId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function savePending(payload: SubmissionPayload) {
  try {
    localStorage.setItem(
      `${PENDING_PREFIX}${payload.attemptId}`,
      JSON.stringify(payload)
    );
  } catch {
    // Storage is full or blocked; the caller still reports the failure.
  }
}

function clearPending(attemptId: string) {
  try {
    localStorage.removeItem(`${PENDING_PREFIX}${attemptId}`);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

/** A failure worth retrying later (server trouble or an expired login). */
function isRetryable(status: number) {
  return status >= 500 || status === 401 || status === 408 || status === 429;
}

/**
 * Send one submission. The server treats the same attemptId as the same
 * submission, so sending it again after a lost response never creates a
 * duplicate. Returns true when the server has it.
 */
async function sendSubmission(payload: SubmissionPayload): Promise<boolean> {
  const token = localStorage.getItem('token');
  if (!token) return false;

  try {
    const response = await fetch(`${API_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      clearPending(payload.attemptId);
      return true;
    }
    // The server rejected it for good, so sending it again would never help.
    if (!isRetryable(response.status)) clearPending(payload.attemptId);
    return false;
  } catch {
    return false;
  }
}

/**
 * Store the submission on the server. If that fails, a copy is kept on this
 * device and sent again later by `flushPendingSubmissions`.
 */
export async function submitAttempt(
  exam: Exam,
  answers: Answers,
  autoSubmitted: boolean,
  attemptId: string
): Promise<boolean> {
  const { score, totalMarks } = calculateScore(exam, answers);
  const payload: SubmissionPayload = {
    attemptId,
    examRef: exam.id,
    examTitle: exam.title,
    answers,
    score,
    totalMarks,
    autoSubmitted,
  };

  // Keep a copy first, so it survives the tab closing mid-request.
  savePending(payload);
  return sendSubmission(payload);
}

let flushing = false;

/** Send every submission that could not be stored earlier. */
export async function flushPendingSubmissions(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PENDING_PREFIX)) keys.push(key);
    }

    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) await sendSubmission(JSON.parse(raw) as SubmissionPayload);
      } catch {
        // An unreadable entry is skipped; the others still get sent.
      }
    }
  } finally {
    flushing = false;
  }
}

/** Tell the server an exam attempt has started, for the activity log. */
export async function logExamStart(exam: Exam): Promise<void> {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    await fetch(`${API_URL}/api/activity/exam-start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ examRef: exam.id, examTitle: exam.title }),
    });
  } catch {
    // Logging must never get in the way of taking the exam.
  }
}
