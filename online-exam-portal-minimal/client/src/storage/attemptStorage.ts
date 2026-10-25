import type { Answers, Exam } from '../types';

/** Everything needed to resume an exam attempt after a refresh or tab close. */
export interface SavedAttempt {
  answers: Answers;
  /** Exam end time (ms since epoch), so the timer keeps running while away */
  deadline: number;
  currentIndex: number;
}

const PREFIX = 'exam-portal:attempt:v1:';
const keyFor = (examId: number) => `${PREFIX}${examId}`;

/** Save progress. Returns false if the browser refused (full or blocked storage). */
export function saveAttempt(examId: number, attempt: SavedAttempt): boolean {
  try {
    localStorage.setItem(keyFor(examId), JSON.stringify(attempt));
    return true;
  } catch {
    return false;
  }
}

/** Load saved progress, or null if there is none or it is unreadable. */
export function loadAttempt(examId: number): SavedAttempt | null {
  try {
    const raw = localStorage.getItem(keyFor(examId));
    if (!raw) return null;

    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;

    const { answers, deadline, currentIndex } = data as Record<string, unknown>;

    if (typeof deadline !== 'number' || !Number.isFinite(deadline)) return null;
    if (typeof answers !== 'object' || answers === null || Array.isArray(answers)) {
      return null;
    }

    const cleanAnswers: Answers = {};
    for (const [key, value] of Object.entries(answers)) {
      const questionId = Number(key);
      if (Number.isInteger(questionId) && typeof value === 'string') {
        cleanAnswers[questionId] = value;
      }
    }

    return {
      answers: cleanAnswers,
      deadline,
      currentIndex:
        typeof currentIndex === 'number' && Number.isInteger(currentIndex)
          ? currentIndex
          : 0,
    };
  } catch {
    return null;
  }
}

/** Remove saved progress (after submitting or leaving an exam). */
export function clearAttempt(examId: number): void {
  try {
    localStorage.removeItem(keyFor(examId));
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

export function hasSavedAttempt(examId: number): boolean {
  return loadAttempt(examId) !== null;
}

export interface RestoredAttempt extends SavedAttempt {
  /** true when progress was restored from a previous session */
  resumed: boolean;
}

/**
 * Build the starting state for an exam attempt: restore saved progress if
 * there is any, otherwise start fresh. Saved answers that no longer match a
 * question (e.g. the question was deleted) are dropped.
 */
export function restoreAttempt(exam: Exam): RestoredAttempt {
  const totalMs = exam.duration * 60 * 1000;
  const now = Date.now();
  const saved = loadAttempt(exam.id);

  if (!saved) {
    return { answers: {}, deadline: now + totalMs, currentIndex: 0, resumed: false };
  }

  const answers: Answers = {};
  for (const question of exam.questions) {
    const answer = saved.answers[question.id];
    if (answer !== undefined && question.options.includes(answer)) {
      answers[question.id] = answer;
    }
  }

  const lastIndex = Math.max(0, exam.questions.length - 1);

  return {
    answers,
    // Never allow more time than the exam's limit, even if the clock changed.
    deadline: Math.min(saved.deadline, now + totalMs),
    currentIndex: Math.min(Math.max(saved.currentIndex, 0), lastIndex),
    resumed: true,
  };
}