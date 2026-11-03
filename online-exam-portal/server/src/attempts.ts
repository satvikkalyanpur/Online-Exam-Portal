// US08 attend an exam, US09 timer, US10 auto-save, US12 schedule check,
// US13 auto-submit, US19 safe retries after a lost connection.
import type { Request, Response } from 'express';
import { AttemptStatus, ExamStatus, Prisma } from './generated/prisma/client.js';
import prisma from './prisma.js';
import { HttpError, OPTION_KEYS, isOptionKey, percentage } from './http.js';
import { DEADLINE_GRACE_MS, submitAttempt } from './grading.js';
import { logActivity } from './activityLog.js';

/** Loads an attempt and checks it belongs to the logged-in student. */
async function findOwnAttempt(attemptId: string, studentId: string) {
  const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.studentId !== studentId) {
    throw new HttpError(404, 'Examination attempt not found.');
  }
  return attempt;
}

function isPastDeadline(expiresAt: Date) {
  return Date.now() > expiresAt.getTime() + DEADLINE_GRACE_MS;
}

/** Everything the exam screen needs. Correct answers are never included. */
async function attemptView(attemptId: string) {
  const attempt = await prisma.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      answers: { select: { questionId: true, selectedOption: true } },
      exam: {
        select: {
          id: true,
          title: true,
          subject: true,
          durationMinutes: true,
          totalMarks: true,
          questions: {
            select: {
              question: {
                select: {
                  id: true,
                  text: true,
                  optionA: true,
                  optionB: true,
                  optionC: true,
                  optionD: true,
                  marks: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const questions = attempt.exam.questions
    .map((link) => link.question)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
    .map((q) => ({
      id: q.id,
      text: q.text,
      marks: q.marks,
      options: OPTION_KEYS.map((key) => ({ key, text: q[`option${key}`] })),
    }));

  const answers: Record<string, string> = {};
  for (const answer of attempt.answers) {
    if (answer.selectedOption) answers[answer.questionId] = answer.selectedOption;
  }
  const { exam } = attempt;

  return {
    // Lets the browser correct for its own clock being wrong.
    serverTime: new Date().toISOString(),
    attempt: {
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      submittedAt: attempt.submittedAt,
    },
    exam: {
      id: exam.id,
      title: exam.title,
      subject: exam.subject,
      durationMinutes: exam.durationMinutes,
      totalMarks: exam.totalMarks,
    },
    questions,
    answers,
  };
}

/** The result shown straight after submitting. */
async function submissionSummary(attemptId: string) {
  const attempt = await prisma.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    select: {
      id: true,
      score: true,
      maxScore: true,
      autoSubmitted: true,
      submittedAt: true,
      answers: { select: { selectedOption: true } },
    },
  });
  const score = attempt.score ?? 0;
  const maxScore = attempt.maxScore ?? 0;
  return {
    attemptId: attempt.id,
    score,
    maxScore,
    percentage: percentage(score, maxScore),
    answeredCount: attempt.answers.filter((a) => a.selectedOption).length,
    totalQuestions: attempt.answers.length,
    autoSubmitted: attempt.autoSubmitted,
    submittedAt: attempt.submittedAt,
  };
}

/**
 * POST /api/exams/:id/attempt — start the exam, or resume the attempt already
 * in progress (same deadline, saved answers restored).
 */
export async function startOrResumeAttempt(req: Request, res: Response) {
  const student = req.user!;
  const examId = String(req.params.id);

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      status: true,
      startAt: true,
      endAt: true,
      durationMinutes: true,
      _count: { select: { questions: true } },
    },
  });
  if (!exam) throw new HttpError(404, 'This examination is not available.');

  let attempt = await prisma.attempt.findUnique({
    where: { examId_studentId: { examId, studentId: student.id } },
  });

  if (attempt?.status === AttemptStatus.IN_PROGRESS && isPastDeadline(attempt.expiresAt)) {
    await submitAttempt(attempt.id, true);
    throw new HttpError(409, 'Your time for this examination has run out, so it was submitted automatically.');
  }
  if (attempt?.status === AttemptStatus.SUBMITTED) {
    throw new HttpError(409, 'You have already submitted this examination.');
  }
  // A student already in the middle of the exam can carry on even if it was moved back to draft.
  if (!attempt && exam.status !== ExamStatus.PUBLISHED) {
    throw new HttpError(404, 'This examination is not available.');
  }

  let resumed = attempt !== null;
  if (!attempt) {
    // US12: the schedule is checked on the server, not just in the browser.
    const now = new Date();
    if (now < exam.startAt) {
      throw new HttpError(403, 'This examination has not started yet.', { opensAt: exam.startAt });
    }
    if (now >= exam.endAt) {
      throw new HttpError(403, 'This examination has closed.');
    }
    if (exam._count.questions === 0) {
      throw new HttpError(409, 'This examination has no questions yet.');
    }

    // The attempt ends after the exam's duration, or when the exam closes, whichever is first.
    const endsAt = Math.min(now.getTime() + exam.durationMinutes * 60_000, exam.endAt.getTime());
    try {
      attempt = await prisma.attempt.create({
        data: { examId, studentId: student.id, expiresAt: new Date(endsAt) },
      });
      await logActivity(student.id, 'EXAM_STARTED', `Started "${exam.title}"`);
    } catch (error) {
      // Two "start" clicks at once: the other request created it first, so use that one.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        attempt = await prisma.attempt.findUniqueOrThrow({
          where: { examId_studentId: { examId, studentId: student.id } },
        });
        resumed = true;
      } else {
        throw error;
      }
    }
  }

  res.status(resumed ? 200 : 201).json({ ...(await attemptView(attempt.id)), resumed });
}

/** GET /api/attempts/:id — reload the current state of the student's own attempt. */
export async function getAttempt(req: Request, res: Response) {
  const attempt = await findOwnAttempt(String(req.params.id), req.user!.id);
  res.json({ ...(await attemptView(attempt.id)), resumed: true });
}

/**
 * PUT /api/attempts/:id/answers/:questionId — save or change one answer.
 * Saving the same answer twice gives the same result, so the browser can safely
 * resend answers that were queued while it was offline.
 */
export async function saveAnswer(req: Request, res: Response) {
  const attempt = await findOwnAttempt(String(req.params.id), req.user!.id);
  const questionId = String(req.params.questionId);
  const selectedOption = req.body?.selectedOption;

  if (!isOptionKey(selectedOption)) {
    throw new HttpError(400, 'Selected option must be A, B, C or D.');
  }
  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    throw new HttpError(409, 'This examination has already been submitted.');
  }
  if (isPastDeadline(attempt.expiresAt)) {
    await submitAttempt(attempt.id, true);
    throw new HttpError(409, 'Time is up. Answers can no longer be changed.');
  }

  const link = await prisma.examQuestion.findUnique({
    where: { questionId_examId: { questionId, examId: attempt.examId } },
  });
  if (!link) throw new HttpError(404, 'This question is not part of the examination.');

  // The attempt row is locked while saving, so an answer can never be stored after
  // the attempt has been submitted and marked (submitAttempt takes the same lock).
  const answer = await prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ status: string }[]>`
      SELECT status FROM \`Attempt\` WHERE id = ${attempt.id} FOR UPDATE`;
    if (row?.status !== AttemptStatus.IN_PROGRESS) {
      throw new HttpError(409, 'This examination has already been submitted.');
    }
    return tx.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId } },
      create: { attemptId: attempt.id, questionId, selectedOption },
      update: { selectedOption },
      select: { questionId: true, selectedOption: true, savedAt: true },
    });
  });

  res.json({ message: 'Answer saved.', answer });
}

/**
 * POST /api/attempts/:id/submit — submit and mark the exam. Body: { auto: true }
 * when the timer ran out. If the attempt was already submitted the existing
 * result is returned, so a repeated request never creates a second submission.
 */
export async function submit(req: Request, res: Response) {
  const attempt = await findOwnAttempt(String(req.params.id), req.user!.id);
  let alreadySubmitted = true;

  if (attempt.status === AttemptStatus.IN_PROGRESS) {
    const auto = req.body?.auto === true || Date.now() >= attempt.expiresAt.getTime();
    alreadySubmitted = !(await submitAttempt(attempt.id, auto));
  }

  res.json({ ...(await submissionSummary(attempt.id)), alreadySubmitted });
}
