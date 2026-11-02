import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from './prisma.js';
import { logActivity } from './activityLog.js';

type AuthedRequest = Request & { user?: { id: string; role: string } };

export async function createSubmission(req: Request, res: Response) {
  try {
    const user = (req as AuthedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const {
      attemptId,
      examRef,
      examTitle,
      answers,
      score,
      totalMarks,
      autoSubmitted,
    } = req.body ?? {};

    if (
      (attemptId !== undefined &&
        (typeof attemptId !== 'string' ||
          !attemptId ||
          attemptId.length > 64)) ||
      !Number.isInteger(examRef) ||
      typeof examTitle !== 'string' ||
      typeof answers !== 'object' ||
      answers === null ||
      Array.isArray(answers) ||
      !Number.isInteger(score) ||
      !Number.isInteger(totalMarks) ||
      score < 0 ||
      totalMarks < 0 ||
      score > totalMarks
    ) {
      return res.status(400).json({ error: 'Invalid submission.' });
    }

    // After a network loss the client sends the same submission again until
    // it gets an answer. The same attemptId is the same submission, so it is
    // stored only once and every repeat gets the original back.
    const findExisting = () =>
      attemptId
        ? prisma.submission.findUnique({ where: { attemptId } })
        : Promise.resolve(null);

    const replyWith = (
      existing: { id: string; studentId: string; submittedAt: Date },
    ) =>
      existing.studentId === user.id
        ? res.status(200).json({
            id: existing.id,
            submittedAt: existing.submittedAt,
            duplicate: true,
          })
        : res.status(409).json({ error: 'Submission id already in use.' });

    const existing = await findExisting();
    if (existing) return replyWith(existing);

    let submission;
    try {
      submission = await prisma.submission.create({
        data: {
          attemptId: attemptId ?? null,
          studentId: user.id,
          examRef,
          examTitle: examTitle.slice(0, 200),
          answers,
          score,
          totalMarks,
          autoSubmitted: autoSubmitted === true,
        },
      });
    } catch (error) {
      // Two copies of the same request arrived together; the other one won.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const winner = await findExisting();
        if (winner) return replyWith(winner);
      }
      throw error;
    }

    await logActivity(user.id, 'EXAM_SUBMIT', {
      submissionId: submission.id,
      examRef,
      examTitle: submission.examTitle,
      score,
      totalMarks,
      autoSubmitted: autoSubmitted === true,
    });

    return res.status(201).json({
      id: submission.id,
      submittedAt: submission.submittedAt,
    });
  } catch (error) {
    console.error('Failed to store submission:', error);
    return res.status(500).json({ error: 'Unable to store the submission.' });
  }
}
