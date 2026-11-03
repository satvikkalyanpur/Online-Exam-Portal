// US13: submitting an attempt (by the student or when time runs out).
// US14: marking the answers against the answer key and storing the score.
import { AttemptStatus } from './generated/prisma/client.js';
import type { Prisma } from './generated/prisma/client.js';
import prisma from './prisma.js';
import { logActivity } from './activityLog.js';

/**
 * Answers that arrive this long after the deadline are still accepted, to allow
 * for network delay. After that the attempt is closed and marked automatically.
 */
export const DEADLINE_GRACE_MS = 15_000;

/**
 * Submits and marks an attempt. Returns false if it was already submitted, so
 * calling it twice (a double click, or a retry after a lost connection) is harmless.
 */
export async function submitAttempt(attemptId: string, auto: boolean): Promise<boolean> {
  const submitted = await prisma.$transaction(async (tx) => {
    // Only one request can move the attempt out of IN_PROGRESS.
    const { count } = await tx.attempt.updateMany({
      where: { id: attemptId, status: AttemptStatus.IN_PROGRESS },
      data: { status: AttemptStatus.SUBMITTED, submittedAt: new Date(), autoSubmitted: auto },
    });
    if (count === 0) return false;

    const attempt = await tx.attempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: {
        answers: { select: { questionId: true, selectedOption: true } },
        exam: {
          select: { questions: { select: { question: { select: { id: true, correctOption: true, marks: true } } } } },
        },
      },
    });

    // Answers to questions that are no longer part of the exam are not marked or kept.
    const examQuestionIds = attempt.exam.questions.map(({ question }) => question.id);
    await tx.attemptAnswer.deleteMany({ where: { attemptId, questionId: { notIn: examQuestionIds } } });

    const chosen = new Map(attempt.answers.map((a) => [a.questionId, a.selectedOption]));
    let score = 0;
    let maxScore = 0;

    for (const { question } of attempt.exam.questions) {
      const selected = chosen.get(question.id) ?? null;
      const isCorrect = selected === question.correctOption;
      maxScore += question.marks;
      if (isCorrect) score += question.marks;

      await tx.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId: question.id } },
        create: { attemptId, questionId: question.id, selectedOption: null, isCorrect: false },
        update: { isCorrect },
      });
    }

    await tx.attempt.update({ where: { id: attemptId }, data: { score, maxScore } });
    return true;
  });

  if (submitted) {
    const attempt = await prisma.attempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { studentId: true, score: true, maxScore: true, exam: { select: { title: true } } },
    });
    await logActivity(
      attempt.studentId,
      'EXAM_SUBMITTED',
      `${auto ? 'Automatically submitted' : 'Submitted'} "${attempt.exam.title}", score ${attempt.score}/${attempt.maxScore}`
    );
  }
  return submitted;
}

/**
 * Submits every attempt whose time ran out while the student was away (for
 * example, the browser was closed). Called before showing exams, results,
 * reports and statistics, so they never show a stale "in progress" attempt.
 */
export async function submitExpiredAttempts(where: Prisma.AttemptWhereInput = {}) {
  const expired = await prisma.attempt.findMany({
    where: {
      ...where,
      status: AttemptStatus.IN_PROGRESS,
      expiresAt: { lt: new Date(Date.now() - DEADLINE_GRACE_MS) },
    },
    select: { id: true },
  });
  for (const { id } of expired) {
    await submitAttempt(id, true);
  }
}
