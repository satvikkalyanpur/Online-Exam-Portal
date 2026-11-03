// US15: a student's own results.
import type { Request, Response } from 'express';
import { AttemptStatus } from './generated/prisma/client.js';
import prisma from './prisma.js';
import { HttpError, OPTION_KEYS, percentage } from './http.js';
import { submitExpiredAttempts } from './grading.js';

/** GET /api/results — every submitted exam of the logged-in student, newest first. */
export async function listMyResults(req: Request, res: Response) {
  const studentId = req.user!.id;
  await submitExpiredAttempts({ studentId });

  const attempts = await prisma.attempt.findMany({
    where: { studentId, status: AttemptStatus.SUBMITTED },
    orderBy: { submittedAt: 'desc' },
    select: {
      id: true,
      score: true,
      maxScore: true,
      submittedAt: true,
      autoSubmitted: true,
      exam: { select: { id: true, title: true, subject: true } },
    },
  });

  res.json(
    attempts.map((a) => ({
      ...a,
      score: a.score ?? 0,
      maxScore: a.maxScore ?? 0,
      percentage: percentage(a.score ?? 0, a.maxScore ?? 0),
    }))
  );
}

/**
 * GET /api/results/:attemptId — one result, question by question. The score is
 * shown straight away; which answers were right is only shown once the exam has
 * closed, so it can't be passed on to students who are still taking it.
 */
export async function getMyResult(req: Request, res: Response) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: String(req.params.attemptId) },
    select: {
      id: true,
      studentId: true,
      status: true,
      score: true,
      maxScore: true,
      submittedAt: true,
      autoSubmitted: true,
      exam: { select: { id: true, title: true, subject: true, endAt: true } },
      answers: {
        select: {
          selectedOption: true,
          isCorrect: true,
          question: {
            select: {
              id: true,
              text: true,
              optionA: true,
              optionB: true,
              optionC: true,
              optionD: true,
              correctOption: true,
              marks: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!attempt || attempt.studentId !== req.user!.id) {
    throw new HttpError(404, 'Result not found.');
  }
  if (attempt.status !== AttemptStatus.SUBMITTED) {
    throw new HttpError(409, 'This examination has not been submitted yet, so there is no result.');
  }

  // Until the exam closes, even "right" or "wrong" per question would give away answers.
  const answersVisible = Date.now() >= attempt.exam.endAt.getTime();
  const questions = attempt.answers
    .sort(
      (a, b) =>
        a.question.createdAt.getTime() - b.question.createdAt.getTime() || a.question.id.localeCompare(b.question.id)
    )
    .map(({ selectedOption, isCorrect, question: q }) => ({
      id: q.id,
      text: q.text,
      marks: q.marks,
      options: OPTION_KEYS.map((key) => ({ key, text: q[`option${key}`] })),
      selectedOption,
      isCorrect: answersVisible ? isCorrect === true : null,
      correctOption: answersVisible ? q.correctOption : null,
    }));

  const score = attempt.score ?? 0;
  const maxScore = attempt.maxScore ?? 0;
  res.json({
    id: attempt.id,
    exam: attempt.exam,
    score,
    maxScore,
    percentage: percentage(score, maxScore),
    submittedAt: attempt.submittedAt,
    autoSubmitted: attempt.autoSubmitted,
    answersVisible,
    questions,
  });
}
